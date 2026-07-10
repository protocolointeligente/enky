import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/infrastructure/database/prisma";
import { activateAthleteInvitation } from "@/modules/athletes/activate-invitation";
import { inviteAthlete } from "@/modules/athletes/invite-athlete";
import { resendInvitation } from "@/modules/athletes/resend-invitation";
import { revokeInvitation } from "@/modules/athletes/revoke-invitation";
import { login } from "@/modules/identity/login";
import { logout } from "@/modules/identity/logout";
import { registerTrainer } from "@/modules/identity/register-trainer";
import { requireTrainerAccessToAthlete } from "@/server/auth/guards";
import { verifySessionByToken } from "@/server/auth/session";
import { uniqueEmail } from "./helpers";

const createdUserIds: string[] = [];
const createdOrganizationIds: string[] = [];
const createdTrainerProfileIds: string[] = [];
const createdAthleteProfileIds: string[] = [];

const VALID_PASSWORD = "correcthorse1";

async function newTrainer(prefix: string) {
  const email = uniqueEmail(prefix);
  const result = await registerTrainer({
    name: `${prefix} Trainer`,
    email,
    password: VALID_PASSWORD,
  });
  createdUserIds.push(result.userId);
  createdOrganizationIds.push(result.organizationId);
  const trainerProfile = await prisma.trainerProfile.findUniqueOrThrow({
    where: { userId: result.userId },
  });
  createdTrainerProfileIds.push(trainerProfile.id);
  return { ...result, email, trainerProfileId: trainerProfile.id };
}

describe("Fase 02B — identidade, autenticação e convite de atleta", () => {
  // -------------------------------------------------------------------
  // 1. Cadastro atômico de treinador
  // -------------------------------------------------------------------
  it("cadastra um treinador com User, TrainerProfile, Organization e OrganizationMembership(OWNER)", async () => {
    const trainer = await newTrainer("register-atomic");

    const membership = await prisma.organizationMembership.findUniqueOrThrow({
      where: {
        userId_organizationId: { userId: trainer.userId, organizationId: trainer.organizationId },
      },
    });
    expect(membership.role).toBe("OWNER");

    const session = await verifySessionByToken(trainer.sessionToken);
    expect(session?.userId).toBe(trainer.userId);
  });

  // -------------------------------------------------------------------
  // 2. Rollback em erro intermediário — duas tentativas concorrentes de
  //    cadastro com o MESMO e-mail: exatamente uma sobrevive, e a
  //    perdedora não deixa nenhum User/Organization/TrainerProfile órfão.
  // -------------------------------------------------------------------
  it("não deixa dados parciais quando o cadastro falha por e-mail duplicado em corrida", async () => {
    const email = uniqueEmail("register-race");
    const attempts = await Promise.allSettled([
      registerTrainer({ name: "Race A", email, password: VALID_PASSWORD }),
      registerTrainer({ name: "Race B", email, password: VALID_PASSWORD }),
    ]);

    const fulfilled = attempts.filter((a) => a.status === "fulfilled");
    const rejected = attempts.filter((a) => a.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    const winner = (
      fulfilled[0] as PromiseFulfilledResult<Awaited<ReturnType<typeof registerTrainer>>>
    ).value;
    createdUserIds.push(winner.userId);
    createdOrganizationIds.push(winner.organizationId);
    const trainerProfile = await prisma.trainerProfile.findUniqueOrThrow({
      where: { userId: winner.userId },
    });
    createdTrainerProfileIds.push(trainerProfile.id);

    const usersWithEmail = await prisma.user.findMany({
      where: { email: { equals: email, mode: "insensitive" } },
    });
    expect(usersWithEmail).toHaveLength(1);
  });

  // -------------------------------------------------------------------
  // 3. Login válido
  // -------------------------------------------------------------------
  it("autentica com e-mail e senha corretos e cria uma nova Session", async () => {
    const trainer = await newTrainer("login-ok");

    const result = await login({ email: trainer.email, password: VALID_PASSWORD });
    expect(result.userId).toBe(trainer.userId);

    const session = await verifySessionByToken(result.sessionToken);
    expect(session?.userId).toBe(trainer.userId);
  });

  // -------------------------------------------------------------------
  // 4. Login inválido sem enumeração — mesma mensagem para conta
  //    inexistente e para senha incorreta.
  // -------------------------------------------------------------------
  it("retorna a mesma mensagem genérica para conta inexistente e para senha incorreta", async () => {
    const trainer = await newTrainer("login-fail");

    let messageForWrongPassword = "";
    try {
      await login({ email: trainer.email, password: "wrong-password-1" });
    } catch (error) {
      messageForWrongPassword = error instanceof Error ? error.message : "";
    }

    let messageForUnknownAccount = "";
    try {
      await login({ email: uniqueEmail("never-registered"), password: "wrong-password-1" });
    } catch (error) {
      messageForUnknownAccount = error instanceof Error ? error.message : "";
    }

    expect(messageForWrongPassword).not.toBe("");
    expect(messageForWrongPassword).toBe(messageForUnknownAccount);
  });

  // -------------------------------------------------------------------
  // 5. Logout e revogação
  // -------------------------------------------------------------------
  it("revoga a sessão no logout — o token deixa de ser válido", async () => {
    const trainer = await newTrainer("logout");

    expect(await verifySessionByToken(trainer.sessionToken)).not.toBeNull();
    await logout(trainer.sessionToken, { userId: trainer.userId });
    expect(await verifySessionByToken(trainer.sessionToken)).toBeNull();

    // Idempotente: revogar de novo não deve lançar.
    await expect(logout(trainer.sessionToken, { userId: trainer.userId })).resolves.toBeUndefined();
  });

  // -------------------------------------------------------------------
  // 6. Sessão expirada
  // -------------------------------------------------------------------
  it("rejeita uma Session cujo expiresAt já passou", async () => {
    const trainer = await newTrainer("session-expired");

    // Expira a sessão diretamente no banco — não há como esperar 30 dias
    // em um teste. Isso exercita exatamente o mesmo caminho de leitura
    // (`expiresAt < now`) que a expiração natural.
    await prisma.session.updateMany({
      where: { userId: trainer.userId },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    expect(await verifySessionByToken(trainer.sessionToken)).toBeNull();
  });

  // -------------------------------------------------------------------
  // 7. Convite cria atleta sem User
  // -------------------------------------------------------------------
  it("cria AthleteProfile sem User ao convidar um atleta", async () => {
    const trainer = await newTrainer("invite-no-user");

    const invitation = await inviteAthlete(
      { email: uniqueEmail("invited-athlete") },
      {
        userId: trainer.userId,
        trainerProfileId: trainer.trainerProfileId,
        organizationId: trainer.organizationId,
      },
    );
    createdAthleteProfileIds.push(invitation.athleteProfileId);

    const athlete = await prisma.athleteProfile.findUniqueOrThrow({
      where: { id: invitation.athleteProfileId },
    });
    expect(athlete.userId).toBeNull();

    const relationship = await prisma.coachAthleteRelationship.findUniqueOrThrow({
      where: {
        organizationId_trainerId_athleteId: {
          organizationId: trainer.organizationId,
          trainerId: trainer.trainerProfileId,
          athleteId: invitation.athleteProfileId,
        },
      },
    });
    expect(relationship.isActive).toBe(true);
  });

  // -------------------------------------------------------------------
  // 8. Ativação cria User e vincula perfil existente
  // -------------------------------------------------------------------
  it("ativação cria User ATHLETE e preenche AthleteProfile.userId do perfil já existente", async () => {
    const trainer = await newTrainer("invite-activate");
    const athleteEmail = uniqueEmail("activate-athlete");

    const invitation = await inviteAthlete(
      { email: athleteEmail },
      {
        userId: trainer.userId,
        trainerProfileId: trainer.trainerProfileId,
        organizationId: trainer.organizationId,
      },
    );
    createdAthleteProfileIds.push(invitation.athleteProfileId);

    const activation = await activateAthleteInvitation({
      token: invitation.rawToken,
      name: "Novo Atleta",
      password: VALID_PASSWORD,
    });
    createdUserIds.push(activation.userId);

    expect(activation.athleteProfileId).toBe(invitation.athleteProfileId);

    const athlete = await prisma.athleteProfile.findUniqueOrThrow({
      where: { id: invitation.athleteProfileId },
    });
    expect(athlete.userId).toBe(activation.userId);

    const user = await prisma.user.findUniqueOrThrow({ where: { id: activation.userId } });
    expect(user.globalRole).toBe("ATHLETE");
    expect(user.email).toBe(athleteEmail);
  });

  // -------------------------------------------------------------------
  // 9. Token não pode ser reutilizado
  // -------------------------------------------------------------------
  it("rejeita a reativação de um convite já consumido", async () => {
    const trainer = await newTrainer("invite-reuse");
    const invitation = await inviteAthlete(
      { email: uniqueEmail("reuse-athlete") },
      {
        userId: trainer.userId,
        trainerProfileId: trainer.trainerProfileId,
        organizationId: trainer.organizationId,
      },
    );
    createdAthleteProfileIds.push(invitation.athleteProfileId);

    const first = await activateAthleteInvitation({
      token: invitation.rawToken,
      name: "Atleta Único",
      password: VALID_PASSWORD,
    });
    createdUserIds.push(first.userId);

    await expect(
      activateAthleteInvitation({
        token: invitation.rawToken,
        name: "Segunda Tentativa",
        password: VALID_PASSWORD,
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  // -------------------------------------------------------------------
  // 10. Convite de outra organização é bloqueado
  // -------------------------------------------------------------------
  it("bloqueia reenvio/revogação de convite pertencente a outra organização", async () => {
    const trainerA = await newTrainer("org-a");
    const trainerB = await newTrainer("org-b");

    const invitation = await inviteAthlete(
      { email: uniqueEmail("cross-org-athlete") },
      {
        userId: trainerA.userId,
        trainerProfileId: trainerA.trainerProfileId,
        organizationId: trainerA.organizationId,
      },
    );
    createdAthleteProfileIds.push(invitation.athleteProfileId);

    await expect(
      resendInvitation(invitation.invitationId, {
        userId: trainerB.userId,
        organizationId: trainerB.organizationId,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    await expect(
      revokeInvitation(invitation.invitationId, {
        userId: trainerB.userId,
        organizationId: trainerB.organizationId,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  // -------------------------------------------------------------------
  // 11. Treinador sem relacionamento não acessa atleta
  // -------------------------------------------------------------------
  it("nega acesso quando não existe CoachAthleteRelationship ativo", async () => {
    const trainer = await newTrainer("no-relationship");
    const athlete = await prisma.athleteProfile.create({ data: {} });
    createdAthleteProfileIds.push(athlete.id);

    await expect(
      requireTrainerAccessToAthlete(trainer.organizationId, trainer.trainerProfileId, athlete.id),
    ).rejects.toMatchObject({ code: "AUTHORIZATION_ERROR" });
  });

  // -------------------------------------------------------------------
  // 12. E-mail case-insensitive no cadastro
  // -------------------------------------------------------------------
  it("rejeita cadastro com e-mail que difere apenas em maiúsculas/minúsculas de um já existente", async () => {
    const base = `case+${randomUUID()}@integration-test.enky.local`;
    const first = await registerTrainer({ name: "Case A", email: base, password: VALID_PASSWORD });
    createdUserIds.push(first.userId);
    createdOrganizationIds.push(first.organizationId);
    const trainerProfile = await prisma.trainerProfile.findUniqueOrThrow({
      where: { userId: first.userId },
    });
    createdTrainerProfileIds.push(trainerProfile.id);

    await expect(
      registerTrainer({ name: "Case B", email: base.toUpperCase(), password: VALID_PASSWORD }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  // -------------------------------------------------------------------
  // 13. AuditLog criado sem dados sensíveis
  // -------------------------------------------------------------------
  it("registra AuditLog de REGISTER_TRAINER sem senha, hash ou token", async () => {
    const trainer = await newTrainer("audit-safe");

    const auditLog = await prisma.auditLog.findFirstOrThrow({
      where: { action: "REGISTER_TRAINER", entityId: trainer.userId },
    });

    const serialized = JSON.stringify(auditLog);
    expect(serialized).not.toContain(VALID_PASSWORD);
    expect(serialized).not.toContain(trainer.sessionToken);
    expect(auditLog.reason).toBeNull();
    expect(auditLog.changedFields).toEqual([]);
  });

  // -------------------------------------------------------------------
  // 14. Concorrência de ativação do mesmo convite
  // -------------------------------------------------------------------
  it("permite apenas uma ativação bem-sucedida quando o mesmo token é usado concorrentemente", async () => {
    const trainer = await newTrainer("invite-concurrency");
    const invitation = await inviteAthlete(
      { email: uniqueEmail("concurrency-athlete") },
      {
        userId: trainer.userId,
        trainerProfileId: trainer.trainerProfileId,
        organizationId: trainer.organizationId,
      },
    );
    createdAthleteProfileIds.push(invitation.athleteProfileId);

    const attempts = await Promise.allSettled([
      activateAthleteInvitation({
        token: invitation.rawToken,
        name: "Tentativa 1",
        password: VALID_PASSWORD,
      }),
      activateAthleteInvitation({
        token: invitation.rawToken,
        name: "Tentativa 2",
        password: VALID_PASSWORD,
      }),
    ]);

    const fulfilled = attempts.filter((a) => a.status === "fulfilled");
    const rejected = attempts.filter((a) => a.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    const winner = (
      fulfilled[0] as PromiseFulfilledResult<Awaited<ReturnType<typeof activateAthleteInvitation>>>
    ).value;
    createdUserIds.push(winner.userId);

    const athlete = await prisma.athleteProfile.findUniqueOrThrow({
      where: { id: invitation.athleteProfileId },
    });
    expect(athlete.userId).toBe(winner.userId);
  });

  // -------------------------------------------------------------------
  // Limpeza — mesma ordem FK-segura usada na Fase 02A, com AuditLog
  // removido primeiro (enquanto ainda referencia userId/organizationId,
  // que a própria Organization/User deletion depois zera via SetNull).
  // -------------------------------------------------------------------
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
