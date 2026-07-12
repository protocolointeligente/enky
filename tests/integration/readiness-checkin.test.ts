import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/infrastructure/database/prisma";
import { activateAthleteInvitation } from "@/modules/athletes/activate-invitation";
import { inviteAthlete } from "@/modules/athletes/invite-athlete";
import { registerTrainer } from "@/modules/identity/register-trainer";
import {
  getAthleteReadiness,
  getMyReadiness,
  submitReadinessCheckIn,
} from "@/modules/intelligence/readiness-checkin";
import { uniqueEmail } from "./helpers";

// Fase II (item 5) — questionário de prontidão. Upsert diário, classificação e
// isolamento por organização, contra o banco real.

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
    { email: uniqueEmail("readiness-athlete") },
    {
      userId: trainer.userId,
      trainerProfileId: trainer.trainerProfileId,
      organizationId: trainer.organizationId,
    },
  );
  createdAthleteProfileIds.push(invitation.athleteProfileId);
  const activation = await activateAthleteInvitation({
    token: invitation.rawToken,
    name: "Atleta Prontidão",
    password: VALID_PASSWORD,
  });
  createdUserIds.push(activation.userId);
  return { athleteProfileId: invitation.athleteProfileId, userId: activation.userId };
}

describe("Fase II — questionário de prontidão (readiness-checkin)", () => {
  it("faz upsert do check-in do dia (um por atleta/dia) e classifica", async () => {
    const trainer = await newTrainer("readiness-up");
    const athlete = await newActiveAthlete(trainer);
    const actor = {
      userId: athlete.userId,
      organizationId: trainer.organizationId,
      athleteProfileId: athlete.athleteProfileId,
    };
    const now = new Date();

    const first = await submitReadinessCheckIn(
      { sleepHours: 8, sleepQuality: 9, motivation: 9, fatigue: 1, soreness: 1, stress: 1 },
      actor,
      now,
    );
    expect(first.readiness.class).toBe("boa");
    expect(first.sleepHours).toBe(8);

    // Reenvio no mesmo dia corrige o check-in, sem criar linha nova.
    const second = await submitReadinessCheckIn(
      { fatigue: 9, soreness: 9, stress: 9, sleepHours: 4 },
      actor,
      now,
    );
    expect(second.id).toBe(first.id);
    expect(second.readiness.class).toBe("baixa");

    const count = await prisma.readinessCheckIn.count({
      where: { athleteId: athlete.athleteProfileId },
    });
    expect(count).toBe(1);

    const mine = await getMyReadiness(athlete.athleteProfileId);
    expect(mine).toHaveLength(1);
    expect(mine[0]?.readiness.class).toBe("baixa");
  });

  it("não vaza prontidão de atleta de outra organização para o treinador", async () => {
    const trainerA = await newTrainer("readiness-iso-a");
    const trainerB = await newTrainer("readiness-iso-b");
    const athlete = await newActiveAthlete(trainerA);
    await submitReadinessCheckIn(
      { sleepHours: 7, sleepQuality: 6, fatigue: 4 },
      {
        userId: athlete.userId,
        organizationId: trainerA.organizationId,
        athleteProfileId: athlete.athleteProfileId,
      },
      new Date(),
    );

    // Escopo do treinador B (outra org) não enxerga o check-in do atleta de A.
    const asB = await getAthleteReadiness(trainerB.organizationId, athlete.athleteProfileId);
    expect(asB).toHaveLength(0);

    const asA = await getAthleteReadiness(trainerA.organizationId, athlete.athleteProfileId);
    expect(asA).toHaveLength(1);
  });

  afterAll(async () => {
    if (createdOrganizationIds.length > 0) {
      await prisma.readinessCheckIn.deleteMany({
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
