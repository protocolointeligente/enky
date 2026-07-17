import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/infrastructure/database/prisma";
import { inviteAthlete } from "@/modules/athletes/invite-athlete";
import { registerTrainer } from "@/modules/identity/register-trainer";
import type { Insight } from "@/modules/intelligence/insight";
import { resolveInsight, upsertExposedInsights } from "@/modules/intelligence/insight-store";
import { uniqueEmail } from "./helpers";

// 02H — persistência do ciclo de vida do Insight (detecção→exposição→ação→
// resultado). Testa o store direto: o motor de atenção já tem cobertura
// unitária; o que é novo aqui é gravar, deduplicar e resolver com escopo.

const createdUserIds: string[] = [];
const createdOrganizationIds: string[] = [];
const createdTrainerProfileIds: string[] = [];
const createdAthleteProfileIds: string[] = [];

const VALID_PASSWORD = "correcthorse1";

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
  return { ...result, trainerProfileId: trainerProfile.id };
}

async function newAthlete(trainer: {
  userId: string;
  organizationId: string;
  trainerProfileId: string;
}) {
  const invitation = await inviteAthlete(
    { email: uniqueEmail("insight-athlete") },
    {
      userId: trainer.userId,
      trainerProfileId: trainer.trainerProfileId,
      organizationId: trainer.organizationId,
    },
  );
  createdAthleteProfileIds.push(invitation.athleteProfileId);
  return invitation.athleteProfileId;
}

function painInsight(athleteId: string): Insight {
  return {
    athleteId,
    athleteName: "Atleta",
    engine: "atencao",
    risk: "urgente",
    observacao: "Dor relatada nível 5 (joelho) em feedback recente.",
    interpretacao: "Dor é um sinal de segurança e se sobrepõe à progressão de carga.",
    acoesSugeridas: ["Considere revisar a próxima sessão intensa deste atleta."],
    confianca: "MEDIA",
    limitacoes: "Não é um diagnóstico.",
    dadosUsados: [{ label: "Dor (máx. recente)", value: "5" }],
    sinaisAusentes: ["Prontidão diária não respondida pelo atleta"],
    janela: "Últimos 28 dias",
    regras: ["seguranca:dor-relatada"],
  };
}

describe("02H — ciclo de vida do Insight (insight-store)", () => {
  it("grava a exposição, é idempotente e resolve preservando a decisão entre varreduras", async () => {
    const trainer = await newTrainer("insight-life");
    const athleteId = await newAthlete(trainer);
    const actor = { organizationId: trainer.organizationId, trainerProfileId: trainer.trainerProfileId };
    const now = new Date();

    // Detecção → exposição: primeira varredura grava o Insight como PENDING.
    const first = await upsertExposedInsights(actor, [painInsight(athleteId)]);
    expect(first).toHaveLength(1);
    expect(first[0]?.id).not.toBeNull();
    expect(first[0]?.status).toBe("PENDING");
    expect(first[0]?.outcome).toBeNull();
    const insightId = first[0]!.id!;

    // Idempotência: nova varredura da mesma situação ⇒ mesma linha, sem duplicar.
    const second = await upsertExposedInsights(actor, [painInsight(athleteId)]);
    expect(second[0]?.id).toBe(insightId);
    const count = await prisma.insight.count({
      where: { organizationId: trainer.organizationId, trainerId: trainer.trainerProfileId },
    });
    expect(count).toBe(1);

    // Ação: o treinador aceita.
    const accepted = await resolveInsight(
      insightId,
      { ...actor, userId: trainer.userId },
      { status: "ACCEPTED" },
      now,
    );
    expect(accepted.status).toBe("ACCEPTED");
    expect(accepted.resolvedById).toBe(trainer.userId);
    expect(accepted.resolvedAt).not.toBeNull();

    // A decisão sobrevive à próxima varredura (não volta para PENDING).
    const third = await upsertExposedInsights(actor, [painInsight(athleteId)]);
    expect(third[0]?.status).toBe("ACCEPTED");

    // Resultado: registrado depois, sem alterar o status.
    const withOutcome = await resolveInsight(
      insightId,
      { ...actor, userId: trainer.userId },
      { outcome: "Atleta liberado após avaliação." },
      now,
    );
    expect(withOutcome.status).toBe("ACCEPTED");
    expect(withOutcome.outcome).toBe("Atleta liberado após avaliação.");
  });

  it("não deixa outro treinador resolver um Insight fora do seu escopo", async () => {
    const trainerA = await newTrainer("insight-iso-a");
    const trainerB = await newTrainer("insight-iso-b");
    const athleteId = await newAthlete(trainerA);
    const actorA = {
      organizationId: trainerA.organizationId,
      trainerProfileId: trainerA.trainerProfileId,
    };
    const [exposed] = await upsertExposedInsights(actorA, [painInsight(athleteId)]);

    await expect(
      resolveInsight(
        exposed!.id!,
        {
          organizationId: trainerB.organizationId,
          trainerProfileId: trainerB.trainerProfileId,
          userId: trainerB.userId,
        },
        { status: "IGNORED" },
        new Date(),
      ),
    ).rejects.toThrow(/não encontrado/i);
  });

  afterAll(async () => {
    if (createdOrganizationIds.length > 0) {
      await prisma.insight.deleteMany({
        where: { organizationId: { in: createdOrganizationIds } },
      });
    }
    if (createdUserIds.length > 0 || createdOrganizationIds.length > 0) {
      await prisma.auditLog.deleteMany({
        where: {
          OR: [{ userId: { in: createdUserIds } }, { organizationId: { in: createdOrganizationIds } }],
        },
      });
    }
    if (createdOrganizationIds.length > 0) {
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
});
