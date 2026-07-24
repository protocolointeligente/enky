import { afterAll, describe, expect, it } from "vitest";
import type { Role } from "@prisma/client";
import { prisma } from "@/infrastructure/database/prisma";
import { activateAthleteInvitation } from "@/modules/athletes/activate-invitation";
import { inviteAthlete } from "@/modules/athletes/invite-athlete";
import { registerTrainer } from "@/modules/identity/register-trainer";
import {
  getOrganizationDetail,
  getPlatformStats,
  listAthletes,
  listAuditTrail,
  listOrganizations,
  listTrainers,
  listUsers,
  setOrganizationActive,
  setUserActive,
  type AdminActor,
} from "@/modules/admin/admin-service";
import {
  isFeatureEnabled,
  listFeatureFlags,
  setFeatureFlag,
} from "@/modules/admin/feature-flag-service";
import { anonymizeUserData, exportUserData } from "@/modules/admin/lgpd-service";
import {
  resolveActiveOrganization,
  resolveAthleteOrganization,
} from "@/server/auth/guards";
import { createSession, verifySessionByToken } from "@/server/auth/session";
import { uniqueEmail } from "./helpers";

// Fase 9 — Admin Operacional.
//
// O foco destes testes é a fronteira: o papel é a ÚNICA barreira desta
// superfície (não há tenant), então a maior parte do arquivo verifica quem
// entra, quem não entra, e se toda ação deixou rastro auditável.

const VALID_PASSWORD = "correcthorse1";

const createdUserIds: string[] = [];
const createdOrganizationIds: string[] = [];
const createdTrainerProfileIds: string[] = [];
const createdAthleteProfileIds: string[] = [];

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

async function newActiveAthlete(
  trainer: { userId: string; organizationId: string; trainerProfileId: string },
  prefix: string,
) {
  const invitation = await inviteAthlete(
    { email: uniqueEmail(prefix) },
    {
      userId: trainer.userId,
      trainerProfileId: trainer.trainerProfileId,
      organizationId: trainer.organizationId,
    },
  );
  createdAthleteProfileIds.push(invitation.athleteProfileId);
  const activation = await activateAthleteInvitation({
    token: invitation.rawToken,
    name: `${prefix} Athlete`,
    password: VALID_PASSWORD,
  });
  createdUserIds.push(activation.userId);
  return { athleteProfileId: invitation.athleteProfileId, userId: activation.userId };
}

// Convite sem ativação: cria AthleteProfile e ocupa a vaga do plano, mas não
// cria User. O plano free permite 1 atleta ATIVO por organização e o convite já
// ocupa a vaga (modules/subscriptions/entitlements.ts), então cada convite
// destes testes precisa do seu próprio treinador.
async function newInvitation(
  trainer: { userId: string; organizationId: string; trainerProfileId: string },
  prefix: string,
) {
  const email = uniqueEmail(prefix);
  const invitation = await inviteAthlete(
    { email },
    {
      userId: trainer.userId,
      trainerProfileId: trainer.trainerProfileId,
      organizationId: trainer.organizationId,
    },
  );
  createdAthleteProfileIds.push(invitation.athleteProfileId);
  return { ...invitation, email };
}

// Um usuário de papel global arbitrário, sem organização — é o que ADMIN e
// SUPERADMIN são na prática (cross-tenant, sem tenant próprio).
async function newUserWithRole(prefix: string, globalRole: Role) {
  const user = await prisma.user.create({
    data: { name: `${prefix} ${globalRole}`, email: uniqueEmail(prefix), globalRole },
  });
  createdUserIds.push(user.id);
  return user;
}

async function newAdminActor(prefix: string, globalRole: Role = "ADMIN"): Promise<AdminActor> {
  const user = await newUserWithRole(prefix, globalRole);
  return { userId: user.id, globalRole, ipAddress: "203.0.113.10", userAgent: "vitest" };
}

function auditFor(action: string, entityId: string) {
  return prisma.auditLog.findFirst({
    where: { action, entityId },
    orderBy: { createdAt: "desc" },
  });
}

describe("Fase 9 — Admin Operacional", () => {
  // ─── Autorização: o papel é a única fronteira ────────────────────────────

  describe("autorização", () => {
    // Cada função é testada individualmente de propósito: uma superfície
    // cross-tenant sem assertAdmin em UMA função já é vazamento total, e um
    // teste que cobrisse "o módulo" no agregado não pegaria a que faltou.
    const forbiddenRoles: Role[] = ["TRAINER", "ATHLETE"];

    for (const role of forbiddenRoles) {
      it(`recusa ${role} em toda a superfície administrativa`, async () => {
        const actor: AdminActor = { userId: "qualquer-usuario", globalRole: role };

        await expect(getPlatformStats(actor)).rejects.toMatchObject({
          code: "AUTHORIZATION_ERROR",
        });
        await expect(listUsers(actor)).rejects.toMatchObject({ code: "AUTHORIZATION_ERROR" });
        await expect(listOrganizations(actor)).rejects.toMatchObject({
          code: "AUTHORIZATION_ERROR",
        });
        await expect(listTrainers(actor)).rejects.toMatchObject({ code: "AUTHORIZATION_ERROR" });
        await expect(listAthletes(actor)).rejects.toMatchObject({ code: "AUTHORIZATION_ERROR" });
        await expect(listAuditTrail(actor)).rejects.toMatchObject({ code: "AUTHORIZATION_ERROR" });
        await expect(getOrganizationDetail(actor, "org-id")).rejects.toMatchObject({
          code: "AUTHORIZATION_ERROR",
        });
        await expect(
          setUserActive(actor, "user-id", { isActive: false, reason: "tentativa" }),
        ).rejects.toMatchObject({ code: "AUTHORIZATION_ERROR" });
        await expect(
          setOrganizationActive(actor, "org-id", { isActive: false, reason: "tentativa" }),
        ).rejects.toMatchObject({ code: "AUTHORIZATION_ERROR" });
      });
    }

    it("um treinador barrado não deixa rastro de leitura na trilha", async () => {
      const trainer = await newTrainer("adm-noaudit");
      const before = await prisma.auditLog.count({ where: { action: "ADMIN_VIEW_ORGANIZATION" } });

      await expect(
        getOrganizationDetail(
          { userId: trainer.userId, globalRole: "TRAINER" },
          trainer.organizationId,
        ),
      ).rejects.toMatchObject({ code: "AUTHORIZATION_ERROR" });

      // A autorização precisa barrar ANTES de qualquer efeito — inclusive o
      // log de leitura, que senão registraria um acesso que não aconteceu.
      const after = await prisma.auditLog.count({ where: { action: "ADMIN_VIEW_ORGANIZATION" } });
      expect(after).toBe(before);
    });

    it("aceita ADMIN e SUPERADMIN", async () => {
      const admin = await newAdminActor("adm-ok-admin", "ADMIN");
      const superadmin = await newAdminActor("adm-ok-super", "SUPERADMIN");

      await expect(listUsers(admin)).resolves.toBeDefined();
      await expect(listUsers(superadmin)).resolves.toBeDefined();
    });
  });

  // ─── Listagens ───────────────────────────────────────────────────────────

  describe("listagens", () => {
    it("lista usuários com busca, filtro de papel e de situação", async () => {
      const admin = await newAdminActor("adm-list-users");
      const trainer = await newTrainer("adm-list-users-t");
      const trainerUser = await prisma.user.findUniqueOrThrow({ where: { id: trainer.userId } });

      const found = await listUsers(admin, { search: trainerUser.email });
      expect(found.total).toBe(1);
      expect(found.users[0]?.email).toBe(trainerUser.email);
      // A organização pessoal do treinador (ADR-001) aparece junto — é ela que
      // dá ao suporte o pulo para o tenant.
      expect(found.users[0]?.organizations[0]?.id).toBe(trainer.organizationId);

      const byRole = await listUsers(admin, { search: trainerUser.email, role: "ATHLETE" });
      expect(byRole.total).toBe(0);

      const blocked = await listUsers(admin, { search: trainerUser.email, status: "blocked" });
      expect(blocked.total).toBe(0);
    });

    it("lista organizações com contagens e situação", async () => {
      const admin = await newAdminActor("adm-list-orgs");
      const trainer = await newTrainer("adm-list-orgs-t");
      await newActiveAthlete(trainer, "adm-list-orgs-a");

      const result = await listOrganizations(admin, {});
      const org = result.organizations.find((o) => o.id === trainer.organizationId);

      expect(result.organizations.length).toBeGreaterThan(0);
      expect(org?.trainers).toBe(1);
      expect(org?.athletes).toBe(1);
      expect(org?.isActive).toBe(true);
    });

    it("lista treinadores com o número de atletas vinculados", async () => {
      const admin = await newAdminActor("adm-list-trainers");
      const trainer = await newTrainer("adm-list-trainers-t");
      await newActiveAthlete(trainer, "adm-list-trainers-a1");

      // Segundo atleta inserido direto: o fluxo de convite pararia no limite do
      // plano free (1 atleta), e o que este teste verifica é a CONTAGEM da
      // listagem, não a regra de plano — que tem os testes dela em
      // modules/subscriptions. Dois atletas provam que a contagem é por
      // treinador; um só não provaria nada.
      const extraAthlete = await prisma.athleteProfile.create({ data: {} });
      createdAthleteProfileIds.push(extraAthlete.id);
      await prisma.coachAthleteRelationship.create({
        data: {
          organizationId: trainer.organizationId,
          trainerId: trainer.trainerProfileId,
          athleteId: extraAthlete.id,
          isActive: true,
        },
      });

      const trainerUser = await prisma.user.findUniqueOrThrow({ where: { id: trainer.userId } });
      const result = await listTrainers(admin, { search: trainerUser.email });

      expect(result.total).toBe(1);
      expect(result.trainers[0]?.athletes).toBe(2);
      expect(result.trainers[0]?.organization?.id).toBe(trainer.organizationId);
    });

    it("lista atletas e distingue convite pendente de conta ativa", async () => {
      const admin = await newAdminActor("adm-list-athletes");
      const trainer = await newTrainer("adm-list-athletes-t");
      const active = await newActiveAthlete(trainer, "adm-list-athletes-active");

      // Convidado que nunca ativou: existe AthleteProfile, não existe User.
      // Treinador próprio por causa do limite de 1 atleta do plano free.
      const pendingTrainer = await newTrainer("adm-list-athletes-pt");
      const { email: pendingEmail } = await newInvitation(
        pendingTrainer,
        "adm-list-athletes-pending",
      );

      const activeUser = await prisma.user.findUniqueOrThrow({ where: { id: active.userId } });
      const activeResult = await listAthletes(admin, { search: activeUser.email });
      expect(activeResult.athletes[0]?.status).toBe("ACTIVE");
      expect(activeResult.athletes[0]?.trainerName).toContain("Trainer");

      // Buscar pelo e-mail do CONVITE encontra quem ainda não tem User — é o
      // caso de suporte mais comum ("convidei e ele não aparece").
      const pendingResult = await listAthletes(admin, { search: pendingEmail });
      expect(pendingResult.total).toBe(1);
      expect(pendingResult.athletes[0]?.status).toBe("PENDING_INVITE");
      expect(pendingResult.athletes[0]?.email).toBe(pendingEmail.toLowerCase());
    });
  });

  // ─── Detalhe de organização ──────────────────────────────────────────────

  describe("detalhe de organização", () => {
    it("entrega o diagnóstico do tenant e audita a leitura", async () => {
      const admin = await newAdminActor("adm-detail");
      const trainer = await newTrainer("adm-detail-t");
      await newActiveAthlete(trainer, "adm-detail-a");

      const detail = await getOrganizationDetail(admin, trainer.organizationId);

      expect(detail.organization.id).toBe(trainer.organizationId);
      expect(detail.counts.trainers).toBe(1);
      expect(detail.counts.athletes).toBe(1);
      expect(detail.members[0]?.userId).toBe(trainer.userId);
      expect(detail.athletes[0]?.trainerName).toContain("Trainer");

      const log = await auditFor("ADMIN_VIEW_ORGANIZATION", trainer.organizationId);
      expect(log?.userId).toBe(admin.userId);
      expect(log?.organizationId).toBe(trainer.organizationId);
      expect(log?.ipAddress).toBe("203.0.113.10");
    });

    it("retorna NOT_FOUND para organização inexistente", async () => {
      const admin = await newAdminActor("adm-detail-404");
      await expect(
        getOrganizationDetail(admin, "00000000-0000-0000-0000-000000000000"),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
  });

  // ─── Bloqueio de usuário ─────────────────────────────────────────────────

  describe("bloquear/desbloquear usuário", () => {
    it("bloqueia, encerra as sessões vivas e audita com motivo", async () => {
      const admin = await newAdminActor("adm-block");
      const trainer = await newTrainer("adm-block-t");

      const session = await createSession({ userId: trainer.userId });
      expect(await verifySessionByToken(session.token)).not.toBeNull();

      await setUserActive(admin, trainer.userId, {
        isActive: false,
        reason: "suspeita de fraude no cadastro",
      });

      const user = await prisma.user.findUniqueOrThrow({ where: { id: trainer.userId } });
      expect(user.isActive).toBe(false);

      // Sem isto o bloqueio só valeria no próximo login — ou seja, não valeria.
      expect(await verifySessionByToken(session.token)).toBeNull();

      const log = await auditFor("ADMIN_BLOCK_USER", trainer.userId);
      expect(log?.userId).toBe(admin.userId);
      expect(log?.reason).toBe("suspeita de fraude no cadastro");
      expect(log?.changedFields).toEqual(["isActive"]);
      // A organização do alvo entra no log para a trilha do tenant não perder
      // o evento que explica por que aquele treinador sumiu.
      expect(log?.organizationId).toBe(trainer.organizationId);
    });

    it("desbloqueia e audita", async () => {
      const admin = await newAdminActor("adm-unblock");
      const trainer = await newTrainer("adm-unblock-t");

      await setUserActive(admin, trainer.userId, { isActive: false, reason: "erro operacional" });
      await setUserActive(admin, trainer.userId, { isActive: true });

      const user = await prisma.user.findUniqueOrThrow({ where: { id: trainer.userId } });
      expect(user.isActive).toBe(true);
      expect(await auditFor("ADMIN_UNBLOCK_USER", trainer.userId)).not.toBeNull();
    });

    it("não deixa um admin bloquear a própria conta", async () => {
      const admin = await newAdminActor("adm-self");

      await expect(
        setUserActive(admin, admin.userId, { isActive: false, reason: "engano" }),
      ).rejects.toMatchObject({ code: "BUSINESS_RULE_VIOLATION" });

      const user = await prisma.user.findUniqueOrThrow({ where: { id: admin.userId } });
      expect(user.isActive).toBe(true);
    });

    it("impede ADMIN de bloquear outro ADMIN, mas permite ao SUPERADMIN", async () => {
      const admin = await newAdminActor("adm-vs-admin");
      const superadmin = await newAdminActor("adm-vs-super", "SUPERADMIN");
      const targetAdmin = await newUserWithRole("adm-target", "ADMIN");

      await expect(
        setUserActive(admin, targetAdmin.id, { isActive: false, reason: "disputa interna" }),
      ).rejects.toMatchObject({ code: "AUTHORIZATION_ERROR" });

      await setUserActive(superadmin, targetAdmin.id, {
        isActive: false,
        reason: "desligamento do time",
      });
      const blocked = await prisma.user.findUniqueOrThrow({ where: { id: targetAdmin.id } });
      expect(blocked.isActive).toBe(false);
    });

    it("retorna NOT_FOUND para usuário inexistente", async () => {
      const admin = await newAdminActor("adm-block-404");
      await expect(
        setUserActive(admin, "00000000-0000-0000-0000-000000000000", {
          isActive: false,
          reason: "inexistente",
        }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
  });

  // ─── Suspensão de organização ────────────────────────────────────────────

  describe("suspender/reativar organização", () => {
    it("suspende, corta treinador E atleta do tenant, e reativa devolvendo o acesso", async () => {
      const admin = await newAdminActor("adm-susp");
      const trainer = await newTrainer("adm-susp-t");
      const athlete = await newActiveAthlete(trainer, "adm-susp-a");

      await expect(resolveActiveOrganization(trainer.userId)).resolves.toMatchObject({
        organizationId: trainer.organizationId,
      });

      await setOrganizationActive(admin, trainer.organizationId, {
        isActive: false,
        reason: "inadimplência há 90 dias",
      });

      // A suspensão vale pelo guard, sem revogar sessão e sem tocar em dado.
      await expect(resolveActiveOrganization(trainer.userId)).rejects.toMatchObject({
        code: "AUTHORIZATION_ERROR",
      });
      await expect(resolveAthleteOrganization(athlete.userId)).rejects.toMatchObject({
        code: "AUTHORIZATION_ERROR",
      });

      const log = await auditFor("ADMIN_SUSPEND_ORGANIZATION", trainer.organizationId);
      expect(log?.userId).toBe(admin.userId);
      expect(log?.reason).toBe("inadimplência há 90 dias");

      // Reversível: reativar devolve exatamente o que havia — nada foi apagado.
      await setOrganizationActive(admin, trainer.organizationId, { isActive: true });

      await expect(resolveActiveOrganization(trainer.userId)).resolves.toMatchObject({
        organizationId: trainer.organizationId,
      });
      await expect(resolveAthleteOrganization(athlete.userId)).resolves.toMatchObject({
        organizationId: trainer.organizationId,
      });
      expect(await auditFor("ADMIN_REACTIVATE_ORGANIZATION", trainer.organizationId)).not.toBeNull();
    });

    it("suspender não apaga nada do tenant", async () => {
      const admin = await newAdminActor("adm-susp-nodelete");
      const trainer = await newTrainer("adm-susp-nodelete-t");
      const athlete = await newActiveAthlete(trainer, "adm-susp-nodelete-a");

      await setOrganizationActive(admin, trainer.organizationId, {
        isActive: false,
        reason: "verificação de conformidade",
      });

      expect(
        await prisma.organization.findUnique({ where: { id: trainer.organizationId } }),
      ).not.toBeNull();
      expect(
        await prisma.coachAthleteRelationship.count({
          where: { organizationId: trainer.organizationId, isActive: true },
        }),
      ).toBe(1);
      expect(
        await prisma.athleteProfile.findUnique({ where: { id: athlete.athleteProfileId } }),
      ).not.toBeNull();
    });

    it("retorna NOT_FOUND para organização inexistente", async () => {
      const admin = await newAdminActor("adm-susp-404");
      await expect(
        setOrganizationActive(admin, "00000000-0000-0000-0000-000000000000", {
          isActive: false,
          reason: "inexistente",
        }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
  });

  // ─── Métricas e trilha ───────────────────────────────────────────────────

  describe("métricas e trilha", () => {
    // As métricas são contagens GLOBAIS num banco compartilhado (outras suítes
    // e sessões escrevem nele em paralelo), então asserção por delta global é
    // corrida — e uma corrida dessas já quebrou este arquivo uma vez. O que
    // importa nestas métricas não é o número absoluto, é o RECORTE: qual
    // conjunto cada uma promete contar. Por isso comparamos o serviço com um
    // oráculo lido do banco no mesmo instante e verificamos o recorte sobre as
    // linhas que o próprio teste criou.
    it("conta convites pendentes sem contar revogados nem expirados", async () => {
      const admin = await newAdminActor("adm-stats-inv");

      const pending = await newInvitation(await newTrainer("adm-stats-inv-p"), "adm-stats-pending");
      const expired = await newInvitation(await newTrainer("adm-stats-inv-e"), "adm-stats-expired");
      const revoked = await newInvitation(await newTrainer("adm-stats-inv-r"), "adm-stats-revoked");

      // Um convite expirado não está "pendente" — está morto. Se contasse, o
      // número só cresceria e pararia de significar "tem gente esperando".
      await prisma.athleteInvitation.updateMany({
        where: { athleteId: expired.athleteProfileId },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });
      await prisma.athleteInvitation.updateMany({
        where: { athleteId: revoked.athleteProfileId },
        data: { isRevoked: true, revokedAt: new Date() },
      });

      const stats = await getPlatformStats(admin);
      expect(stats.pendingInvitations).toBe(
        await prisma.athleteInvitation.count({
          where: { isConsumed: false, isRevoked: false, expiresAt: { gt: new Date() } },
        }),
      );

      // Dos TRÊS convites deste teste, só o pendente entra no recorte.
      const selected = await prisma.athleteInvitation.findMany({
        where: {
          isConsumed: false,
          isRevoked: false,
          expiresAt: { gt: new Date() },
          athleteId: {
            in: [pending.athleteProfileId, expired.athleteProfileId, revoked.athleteProfileId],
          },
        },
        select: { athleteId: true },
      });
      expect(selected.map((s) => s.athleteId)).toEqual([pending.athleteProfileId]);
    });

    it("conta treinos criados e concluídos com o recorte certo", async () => {
      const admin = await newAdminActor("adm-stats-workouts");
      const trainer = await newTrainer("adm-stats-workouts-t");
      const athlete = await newActiveAthlete(trainer, "adm-stats-workouts-a");

      const base = {
        organizationId: trainer.organizationId,
        athleteId: athlete.athleteProfileId,
        trainerId: trainer.trainerProfileId,
        modality: "RUNNING" as const,
        plannedDate: new Date("2026-07-01"),
      };
      await prisma.workout.createMany({
        data: [
          { ...base, title: "Treino concluído", status: "COMPLETED" },
          { ...base, title: "Rascunho", status: "DRAFT" },
        ],
      });

      const stats = await getPlatformStats(admin);
      expect(stats.workouts).toBe(await prisma.workout.count());
      expect(stats.workoutsCompleted).toBe(
        await prisma.workout.count({ where: { status: "COMPLETED" } }),
      );
      // "Concluídos" é um subconjunto de "criados": o rascunho acima garante
      // que as duas métricas não são a mesma contagem com nomes diferentes.
      expect(stats.workoutsCompleted).toBeLessThan(stats.workouts);
    });

    it("reflete o bloqueio nas métricas e no filtro de usuários", async () => {
      const admin = await newAdminActor("adm-stats-blocked");
      const trainer = await newTrainer("adm-stats-blocked-t");
      const trainerUser = await prisma.user.findUniqueOrThrow({ where: { id: trainer.userId } });

      await setUserActive(admin, trainer.userId, { isActive: false, reason: "teste de métrica" });

      const stats = await getPlatformStats(admin);
      expect(stats.activeUsers).toBe(await prisma.user.count({ where: { isActive: true } }));
      // Bloqueado é exatamente o complemento de ativo — nunca um terceiro estado.
      expect(stats.users).toBe(stats.activeUsers + stats.blockedUsers);

      // E o usuário bloqueado é encontrável por quem for diagnosticar o caso.
      const blocked = await listUsers(admin, { search: trainerUser.email, status: "blocked" });
      expect(blocked.total).toBe(1);
      expect(blocked.users[0]?.id).toBe(trainer.userId);
      const active = await listUsers(admin, { search: trainerUser.email, status: "active" });
      expect(active.total).toBe(0);
    });

    it("filtra a trilha por organização e por ação", async () => {
      const admin = await newAdminActor("adm-trail");
      const trainer = await newTrainer("adm-trail-t");

      await setOrganizationActive(admin, trainer.organizationId, {
        isActive: false,
        reason: "recorte da trilha",
      });
      await setOrganizationActive(admin, trainer.organizationId, { isActive: true });

      const byOrg = await listAuditTrail(admin, { organizationId: trainer.organizationId });
      expect(byOrg.total).toBeGreaterThanOrEqual(2);
      expect(byOrg.logs.every((l) => l.organizationId === trainer.organizationId)).toBe(true);

      const byAction = await listAuditTrail(admin, {
        organizationId: trainer.organizationId,
        action: "ADMIN_SUSPEND_ORGANIZATION",
      });
      expect(byAction.total).toBe(1);
      expect(byAction.logs[0]?.reason).toBe("recorte da trilha");

      // O filtro da UI é populado com as ações realmente presentes.
      expect(byAction.actions).toContain("ADMIN_SUSPEND_ORGANIZATION");
    });

    it("recorta a trilha por período", async () => {
      const admin = await newAdminActor("adm-trail-period");
      const trainer = await newTrainer("adm-trail-period-t");

      await setOrganizationActive(admin, trainer.organizationId, {
        isActive: false,
        reason: "evento de hoje",
      });

      const future = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const past = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const inWindow = await listAuditTrail(admin, {
        organizationId: trainer.organizationId,
        from: past,
        to: future,
      });
      expect(inWindow.total).toBeGreaterThan(0);

      const outOfWindow = await listAuditTrail(admin, {
        organizationId: trainer.organizationId,
        to: past,
      });
      expect(outOfWindow.total).toBe(0);
    });
  });

  afterAll(async () => {
    if (createdOrganizationIds.length > 0) {
      await prisma.workout.deleteMany({
        where: { organizationId: { in: createdOrganizationIds } },
      });
    }
    if (createdUserIds.length > 0) {
      await prisma.session.deleteMany({ where: { userId: { in: createdUserIds } } });
    }
    if (createdAthleteProfileIds.length > 0) {
      await prisma.coachAthleteRelationship.deleteMany({
        where: { athleteId: { in: createdAthleteProfileIds } },
      });
      await prisma.athleteInvitation.deleteMany({
        where: { athleteId: { in: createdAthleteProfileIds } },
      });
    }
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
