import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/infrastructure/database/prisma";
import { activateAthleteInvitation } from "@/modules/athletes/activate-invitation";
import { inviteAthlete } from "@/modules/athletes/invite-athlete";
import { revokeInvitation } from "@/modules/athletes/revoke-invitation";
import { listTrainerAthletes } from "@/modules/athletes/list-trainer-athletes";
import { registerTrainer } from "@/modules/identity/register-trainer";
import { uniqueEmail } from "./helpers";

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

function actorOf(trainer: { organizationId: string; trainerProfileId: string }) {
  return { organizationId: trainer.organizationId, trainerProfileId: trainer.trainerProfileId };
}

async function invite(
  trainer: { userId: string; organizationId: string; trainerProfileId: string },
  prefix: string,
) {
  const result = await inviteAthlete(
    { email: uniqueEmail(prefix) },
    {
      userId: trainer.userId,
      trainerProfileId: trainer.trainerProfileId,
      organizationId: trainer.organizationId,
    },
  );
  createdAthleteProfileIds.push(result.athleteProfileId);
  return result;
}

describe("Fase 02D — roster de atletas (listTrainerAthletes)", () => {
  it("marca um convite recém-criado como PENDING e permite reenvio/revogação", async () => {
    const trainer = await newTrainer("roster-pending");
    const invitation = await invite(trainer, "pending-athlete");

    const roster = await listTrainerAthletes(actorOf(trainer));
    const entry = roster.find((row) => row.athleteProfileId === invitation.athleteProfileId);

    expect(entry?.status).toBe("PENDING");
    expect(entry?.invitationId).toBe(invitation.invitationId);
    expect(entry?.canResend).toBe(true);
    expect(entry?.canRevoke).toBe(true);
    expect(entry?.name).toBeNull();
  });

  it("marca um convite vencido como EXPIRED", async () => {
    const trainer = await newTrainer("roster-expired");
    const invitation = await invite(trainer, "expired-athlete");
    await prisma.athleteInvitation.update({
      where: { id: invitation.invitationId },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const roster = await listTrainerAthletes(actorOf(trainer));
    const entry = roster.find((row) => row.athleteProfileId === invitation.athleteProfileId);
    expect(entry?.status).toBe("EXPIRED");
    // Ainda acionável — o treinador pode reenviar para gerar um novo token.
    expect(entry?.canResend).toBe(true);
  });

  it("marca um convite revogado como REVOKED sem ações disponíveis", async () => {
    const trainer = await newTrainer("roster-revoked");
    const invitation = await invite(trainer, "revoked-athlete");
    await revokeInvitation(invitation.invitationId, {
      userId: trainer.userId,
      organizationId: trainer.organizationId,
    });

    const roster = await listTrainerAthletes(actorOf(trainer));
    const entry = roster.find((row) => row.athleteProfileId === invitation.athleteProfileId);
    expect(entry?.status).toBe("REVOKED");
    expect(entry?.canResend).toBe(false);
    expect(entry?.canRevoke).toBe(false);
  });

  it("marca um atleta ativado como ACTIVE com nome e e-mail preenchidos", async () => {
    const trainer = await newTrainer("roster-active");
    const invitation = await invite(trainer, "active-athlete");
    const activation = await activateAthleteInvitation({
      token: invitation.rawToken,
      name: "Atleta Ativo",
      password: VALID_PASSWORD,
    });
    createdUserIds.push(activation.userId);

    const roster = await listTrainerAthletes(actorOf(trainer));
    const entry = roster.find((row) => row.athleteProfileId === invitation.athleteProfileId);
    expect(entry?.status).toBe("ACTIVE");
    expect(entry?.name).toBe("Atleta Ativo");
    expect(entry?.email).not.toBeNull();
    expect(entry?.canResend).toBe(false);
  });

  it("não vaza atletas de outra organização", async () => {
    const trainerA = await newTrainer("roster-iso-a");
    const trainerB = await newTrainer("roster-iso-b");
    const invitation = await invite(trainerA, "iso-athlete");

    const rosterB = await listTrainerAthletes(actorOf(trainerB));
    expect(
      rosterB.find((row) => row.athleteProfileId === invitation.athleteProfileId),
    ).toBeUndefined();
  });

  afterAll(async () => {
    if (createdUserIds.length > 0 || createdOrganizationIds.length > 0) {
      await prisma.auditLog.deleteMany({
        where: {
          OR: [
            { userId: { in: createdUserIds } },
            { organizationId: { in: createdOrganizationIds } },
          ],
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
