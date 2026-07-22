import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/infrastructure/database/prisma";
import { activateAthleteInvitation } from "@/modules/athletes/activate-invitation";
import { inviteAthlete } from "@/modules/athletes/invite-athlete";
import { registerTrainer } from "@/modules/identity/register-trainer";
import {
  generateAthleteReport,
  getAthleteReport,
  getAthleteReportDocument,
  getTrainerReportDocument,
  listAthleteReportDocuments,
  listTrainerReportDocuments,
  revokeReport,
  shareReport,
} from "@/modules/reports/report-service";
import { renderReportPdf } from "@/modules/reports/report-pdf";
import { uniqueEmail } from "./helpers";

// Fase 8 — relatório premium: autorização do ciclo publicar → baixar → revogar.
// O que este arquivo protege é a fronteira: o atleta vê SÓ o publicado, o PDF
// não é porta lateral para o que a tela esconde, e nada atravessa organização.

const createdUserIds: string[] = [];
const createdOrganizationIds: string[] = [];
const createdTrainerProfileIds: string[] = [];
const createdAthleteProfileIds: string[] = [];

const VALID_PASSWORD = "correcthorse1";
const PERIOD = { periodStart: "2026-07-01", periodEnd: "2026-07-12" };

async function newTrainer(prefix: string) {
  const result = await registerTrainer({
    name: `${prefix} Trainer`,
    email: uniqueEmail(prefix),
    password: VALID_PASSWORD,
  });
  createdUserIds.push(result.userId);
  createdOrganizationIds.push(result.organizationId);
  const trainerProfile = await prisma.trainerProfile.findUniqueOrThrow({
    where: { userId: result.userId },
  });
  createdTrainerProfileIds.push(trainerProfile.id);
  return {
    userId: result.userId,
    organizationId: result.organizationId,
    trainerProfileId: trainerProfile.id,
  };
}

async function newActiveAthlete(trainer: {
  userId: string;
  organizationId: string;
  trainerProfileId: string;
}) {
  const invitation = await inviteAthlete(
    { email: uniqueEmail("premium-athlete") },
    {
      userId: trainer.userId,
      trainerProfileId: trainer.trainerProfileId,
      organizationId: trainer.organizationId,
    },
  );
  createdAthleteProfileIds.push(invitation.athleteProfileId);
  const activation = await activateAthleteInvitation({
    token: invitation.rawToken,
    name: "Atleta Premium",
    password: VALID_PASSWORD,
  });
  createdUserIds.push(activation.userId);
  return invitation.athleteProfileId;
}

describe("Fase 8 — revogar compartilhamento", () => {
  it("tira o relatório do atleta e o devolve ao republicar", async () => {
    const trainer = await newTrainer("report-revoke");
    const athleteId = await newActiveAthlete(trainer);

    const report = await generateAthleteReport(athleteId, PERIOD, trainer);
    await shareReport(report.id, trainer, new Date());
    expect(await listAthleteReportDocuments(trainer.organizationId, athleteId)).toHaveLength(1);

    const revoked = await revokeReport(report.id, trainer);
    expect(revoked.status).toBe("REVOKED");
    expect(revoked.sharedAt).toBeNull();

    // Some da lista E do acesso direto por id — não basta esconder da listagem.
    expect(await listAthleteReportDocuments(trainer.organizationId, athleteId)).toHaveLength(0);
    await expect(getAthleteReport(report.id, trainer.organizationId, athleteId)).rejects.toThrow(
      /não encontrado/i,
    );

    // O treinador continua enxergando no histórico dele.
    const trainerView = await listTrainerReportDocuments(athleteId, trainer);
    expect(trainerView).toHaveLength(1);
    expect(trainerView[0]?.document.statusLabel).toBe("Compartilhamento revogado");

    // Revogado pode voltar a ser compartilhado.
    const reshared = await shareReport(report.id, trainer, new Date());
    expect(reshared.status).toBe("PUBLISHED");
    expect(await listAthleteReportDocuments(trainer.organizationId, athleteId)).toHaveLength(1);
  });

  it("recusa revogar o que não está compartilhado", async () => {
    const trainer = await newTrainer("report-revoke-draft");
    const athleteId = await newActiveAthlete(trainer);
    const report = await generateAthleteReport(athleteId, PERIOD, trainer);

    await expect(revokeReport(report.id, trainer)).rejects.toThrow(/compartilhados/i);
  });

  it("não deixa treinador de outra organização revogar", async () => {
    const trainerA = await newTrainer("report-revoke-a");
    const trainerB = await newTrainer("report-revoke-b");
    const athleteId = await newActiveAthlete(trainerA);

    const report = await generateAthleteReport(athleteId, PERIOD, trainerA);
    await shareReport(report.id, trainerA, new Date());

    await expect(revokeReport(report.id, trainerB)).rejects.toThrow(/não encontrado/i);

    // E o relatório segue publicado para o atleta de A.
    const still = await getAthleteReport(report.id, trainerA.organizationId, athleteId);
    expect(still.status).toBe("PUBLISHED");
  });
});

describe("Fase 8 — autorização do PDF", () => {
  it("nega ao atleta o PDF de rascunho e de revogado, libera o publicado", async () => {
    const trainer = await newTrainer("report-pdf-auth");
    const athleteId = await newActiveAthlete(trainer);
    const report = await generateAthleteReport(athleteId, PERIOD, trainer);

    // DRAFT: o treinador baixa (é o que ele revisa), o atleta não.
    await expect(
      getAthleteReportDocument(report.id, trainer.organizationId, athleteId),
    ).rejects.toThrow(/não encontrado/i);
    await expect(getTrainerReportDocument(report.id, trainer)).resolves.toBeTruthy();

    await shareReport(report.id, trainer, new Date());
    const document = await getAthleteReportDocument(report.id, trainer.organizationId, athleteId);
    expect(document.athleteName).toBe("Atleta Premium");

    const pdf = await renderReportPdf(document);
    expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");

    // Revogado: a porta do PDF fecha junto com a da tela.
    await revokeReport(report.id, trainer);
    await expect(
      getAthleteReportDocument(report.id, trainer.organizationId, athleteId),
    ).rejects.toThrow(/não encontrado/i);
  });

  it("não entrega o PDF de um atleta a outra organização", async () => {
    const trainerA = await newTrainer("report-pdf-iso-a");
    const trainerB = await newTrainer("report-pdf-iso-b");
    const athleteId = await newActiveAthlete(trainerA);

    const report = await generateAthleteReport(athleteId, PERIOD, trainerA);
    await shareReport(report.id, trainerA, new Date());

    await expect(getTrainerReportDocument(report.id, trainerB)).rejects.toThrow(/não encontrado/i);
    await expect(
      getAthleteReportDocument(report.id, trainerB.organizationId, athleteId),
    ).rejects.toThrow(/não encontrado/i);
  });
});

describe("Fase 8 — documento premium sobre dado real", () => {
  it("declara insuficiência quando o atleta não tem histórico", async () => {
    const trainer = await newTrainer("report-empty");
    const athleteId = await newActiveAthlete(trainer);
    const report = await generateAthleteReport(athleteId, PERIOD, trainer);

    const document = await getTrainerReportDocument(report.id, trainer);
    const load = document.sections.find((s) => s.id === "estado-de-carga");
    const readiness = document.sections.find((s) => s.id === "prontidao");

    // Atleta recém-criado não tem treino nem check-in: o relatório precisa
    // DIZER isso, não exibir zeros com cara de leitura.
    expect(load?.stats).toEqual([]);
    expect(load?.notice).toContain("Dados insuficientes");
    expect(readiness?.notice).toContain("Dados insuficientes");
    expect(document.sections.find((s) => s.id === "aderencia")?.notice).toContain(
      "Sem sessões previstas",
    );
  });

  it("registra GENERATE, SHARE e REVOKE na auditoria", async () => {
    const trainer = await newTrainer("report-audit");
    const athleteId = await newActiveAthlete(trainer);
    const report = await generateAthleteReport(athleteId, PERIOD, trainer);
    await shareReport(report.id, trainer, new Date());
    await revokeReport(report.id, trainer);

    const logs = await prisma.auditLog.findMany({
      where: { entityName: "Report", entityId: report.id },
      select: { action: true },
    });
    expect(logs.map((l) => l.action).sort()).toEqual([
      "GENERATE_REPORT",
      "REVOKE_REPORT",
      "SHARE_REPORT",
    ]);
  });
});

afterAll(async () => {
  if (createdOrganizationIds.length > 0) {
    await prisma.report.deleteMany({ where: { organizationId: { in: createdOrganizationIds } } });
    await prisma.auditLog.deleteMany({
      where: {
        OR: [
          { userId: { in: createdUserIds } },
          { organizationId: { in: createdOrganizationIds } },
        ],
      },
    });
    await prisma.organization.deleteMany({ where: { id: { in: createdOrganizationIds } } });
  }
  if (createdTrainerProfileIds.length > 0) {
    await prisma.trainerProfile.deleteMany({ where: { id: { in: createdTrainerProfileIds } } });
  }
  if (createdAthleteProfileIds.length > 0) {
    await prisma.athleteProfile.deleteMany({ where: { id: { in: createdAthleteProfileIds } } });
  }
  if (createdUserIds.length > 0) {
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  }
  await prisma.$disconnect();
});
