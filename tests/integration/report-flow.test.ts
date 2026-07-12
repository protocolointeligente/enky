import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/infrastructure/database/prisma";
import { activateAthleteInvitation } from "@/modules/athletes/activate-invitation";
import { inviteAthlete } from "@/modules/athletes/invite-athlete";
import { registerTrainer } from "@/modules/identity/register-trainer";
import {
  generateAthleteReport,
  getAthleteReport,
  listAthleteReports,
  shareReport,
} from "@/modules/reports/report-service";
import { uniqueEmail } from "./helpers";

// Item 6 — relatório simples. Gera (rascunho) → compartilha (publica) → atleta
// só enxerga depois de compartilhado. Isolamento por organização.

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

async function newActiveAthlete(trainer: {
  userId: string;
  organizationId: string;
  trainerProfileId: string;
}) {
  const invitation = await inviteAthlete(
    { email: uniqueEmail("report-athlete") },
    {
      userId: trainer.userId,
      trainerProfileId: trainer.trainerProfileId,
      organizationId: trainer.organizationId,
    },
  );
  createdAthleteProfileIds.push(invitation.athleteProfileId);
  const activation = await activateAthleteInvitation({
    token: invitation.rawToken,
    name: "Atleta Relatório",
    password: VALID_PASSWORD,
  });
  createdUserIds.push(activation.userId);
  return invitation.athleteProfileId;
}

const PERIOD = { periodStart: "2026-07-01", periodEnd: "2026-07-12" };

describe("Item 6 — fluxo de relatório (report-service)", () => {
  it("gera rascunho invisível ao atleta e o revela após compartilhar", async () => {
    const trainer = await newTrainer("report-flow");
    const athleteId = await newActiveAthlete(trainer);
    const actor = {
      userId: trainer.userId,
      organizationId: trainer.organizationId,
      trainerProfileId: trainer.trainerProfileId,
    };

    const report = await generateAthleteReport(athleteId, PERIOD, actor);
    expect(report.status).toBe("DRAFT");
    expect(report.insights).toBeTruthy();
    expect(report.metricsSnapshot).toBeTruthy();

    // Rascunho não vaza para o atleta.
    const before = await listAthleteReports(trainer.organizationId, athleteId);
    expect(before).toHaveLength(0);

    const shared = await shareReport(report.id, actor, new Date());
    expect(shared.status).toBe("PUBLISHED");
    expect(shared.sharedAt).not.toBeNull();

    const after = await listAthleteReports(trainer.organizationId, athleteId);
    expect(after).toHaveLength(1);
    const fetched = await getAthleteReport(report.id, trainer.organizationId, athleteId);
    expect(fetched.id).toBe(report.id);
  });

  it("recusa compartilhar duas vezes e não vaza entre organizações", async () => {
    const trainerA = await newTrainer("report-iso-a");
    const trainerB = await newTrainer("report-iso-b");
    const athleteId = await newActiveAthlete(trainerA);
    const actorA = {
      userId: trainerA.userId,
      organizationId: trainerA.organizationId,
      trainerProfileId: trainerA.trainerProfileId,
    };
    const report = await generateAthleteReport(athleteId, PERIOD, actorA);
    await shareReport(report.id, actorA, new Date());

    // Já publicado: recompartilhar é conflito.
    await expect(shareReport(report.id, actorA, new Date())).rejects.toThrow(/rascunho/i);

    // Escopo da org de B não alcança o relatório do atleta de A.
    await expect(
      getAthleteReport(report.id, trainerB.organizationId, athleteId),
    ).rejects.toThrow(/não encontrado/i);
  });

  afterAll(async () => {
    if (createdOrganizationIds.length > 0) {
      await prisma.report.deleteMany({ where: { organizationId: { in: createdOrganizationIds } } });
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
