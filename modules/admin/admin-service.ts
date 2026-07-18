import type { Prisma, Role } from "@prisma/client";
import { recordAuditLog } from "@/domain/audit";
import { AuthorizationError, BusinessRuleError, NotFoundError } from "@/domain/errors";
import { prisma } from "@/infrastructure/database/prisma";
import { revokeAllSessionsForUser } from "@/server/auth/session";
import type {
  OrgStatusFilter,
  SetOrganizationStatusInput,
  SetUserStatusInput,
  UserStatusFilter,
} from "./admin-schema";

// Fase 9 — Admin Operacional.
//
// Superfície transversal (cross-tenant) do ADMIN/SUPERADMIN: ele opera a
// plataforma inteira sem abrir o banco. Como NÃO existe escopo de organização
// aqui, o papel é a única fronteira de autorização — e por isso ela é checada
// DENTRO de cada função (`assertAdmin`), não só no guard da rota. Os demais
// módulos podem confiar no guard da rota porque ainda têm o tenant como segunda
// barreira; este não tem nenhuma. Um chamador novo que esqueça o guard não pode
// virar um vazamento cross-tenant silencioso.
//
// Nada aqui apaga: bloquear usuário e suspender organização são flags
// reversíveis (`isActive`), e a trilha registra quem fez, quando e por quê.

const ADMIN_ROLES: readonly Role[] = ["ADMIN", "SUPERADMIN"];

export interface AdminActor {
  userId: string;
  globalRole: Role;
  ipAddress?: string;
  userAgent?: string;
}

function assertAdmin(actor: AdminActor): void {
  if (!ADMIN_ROLES.includes(actor.globalRole)) {
    throw new AuthorizationError("Papel do usuário não autorizado para esta ação.");
  }
}

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

export interface PageOptions {
  limit?: number;
  offset?: number;
}

function paginate(opts: PageOptions) {
  return {
    take: Math.min(Math.max(opts.limit ?? DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE),
    skip: Math.max(opts.offset ?? 0, 0),
  };
}

function contains(search: string) {
  return { contains: search.trim(), mode: "insensitive" as const };
}

// ---------------------------------------------------------------------------
// Métricas básicas da plataforma
// ---------------------------------------------------------------------------

export interface PlatformStats {
  trainers: number;
  athletes: number;
  organizations: number;
  activeOrganizations: number;
  users: number;
  activeUsers: number;
  blockedUsers: number;
  usersActiveLast30Days: number;
  athletesPerTrainerAvg: number;
  athletesPerTrainerMax: number;
  workouts: number;
  workoutsCompleted: number;
  pendingInvitations: number;
  reports: number;
  auditEvents: number;
  // Fase 06 — saúde comercial e de integração.
  activeSubscriptions: number;
  delinquentSubscriptions: number; // PAST_DUE + UNPAID
  mrr: number; // receita recorrente mensal (equivalente mensal, em BRL)
  webhooksProcessed: number;
  webhooksFailed: number;
}

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export async function getPlatformStats(actor: AdminActor, now = new Date()): Promise<PlatformStats> {
  assertAdmin(actor);

  const activeSince = new Date(now.getTime() - THIRTY_DAYS_MS);

  const [
    trainers,
    athletes,
    organizations,
    activeOrganizations,
    users,
    activeUsers,
    workouts,
    workoutsCompleted,
    pendingInvitations,
    reports,
    auditEvents,
    recentSessionUsers,
    relationshipsByTrainer,
    activeSubs,
    delinquentSubscriptions,
    webhooksByStatus,
  ] = await Promise.all([
    prisma.trainerProfile.count(),
    prisma.athleteProfile.count(),
    prisma.organization.count(),
    prisma.organization.count({ where: { isActive: true } }),
    prisma.user.count(),
    prisma.user.count({ where: { isActive: true } }),
    prisma.workout.count(),
    prisma.workout.count({ where: { status: "COMPLETED" } }),
    // "Pendente" = ainda acionável: não consumido, não revogado e não expirado.
    // Um convite expirado não está pendente, está morto — contá-lo faria o
    // número crescer para sempre e parar de significar "tem gente esperando".
    prisma.athleteInvitation.count({
      where: { isConsumed: false, isRevoked: false, expiresAt: { gt: now } },
    }),
    prisma.report.count(),
    prisma.auditLog.count(),
    // "Usuário ativo" no sentido de engajamento (abriu sessão nos últimos 30
    // dias), que é diferente de `isActive` (não bloqueado). O painel mostra os
    // dois porque respondem perguntas diferentes.
    prisma.session.groupBy({ by: ["userId"], where: { createdAt: { gte: activeSince } } }),
    prisma.coachAthleteRelationship.groupBy({
      by: ["trainerId"],
      where: { isActive: true },
      _count: { _all: true },
    }),
    // MRR: assinaturas ACTIVE com o preço e ciclo do plano. Anual vira
    // equivalente mensal (÷12) para o número somar peras com peras.
    prisma.subscription.findMany({
      where: { status: "ACTIVE" },
      select: { plan: { select: { price: true, billingCycle: true } } },
    }),
    prisma.subscription.count({ where: { status: { in: ["PAST_DUE", "UNPAID"] } } }),
    prisma.webhookEvent.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);

  const athleteCounts = relationshipsByTrainer.map((r) => r._count._all);
  const linkedAthletes = athleteCounts.reduce((sum, n) => sum + n, 0);

  const mrr = activeSubs.reduce((sum, s) => {
    const monthly =
      s.plan.billingCycle === "ANUAL" ? Number(s.plan.price) / 12 : Number(s.plan.price);
    return sum + monthly;
  }, 0);
  const webhookCount = (status: string) =>
    webhooksByStatus.find((w) => w.status === status)?._count._all ?? 0;

  return {
    trainers,
    athletes,
    organizations,
    activeOrganizations,
    users,
    activeUsers,
    blockedUsers: users - activeUsers,
    usersActiveLast30Days: recentSessionUsers.length,
    // Média sobre TODOS os treinadores (inclusive os com zero atletas) — é a
    // pergunta de operação ("o treinador médio tem quantos atletas?"), e usar
    // só quem tem vínculo esconderia exatamente os que não engajaram.
    athletesPerTrainerAvg: trainers === 0 ? 0 : Number((linkedAthletes / trainers).toFixed(1)),
    athletesPerTrainerMax: athleteCounts.length === 0 ? 0 : Math.max(...athleteCounts),
    workouts,
    workoutsCompleted,
    pendingInvitations,
    reports,
    auditEvents,
    activeSubscriptions: activeSubs.length,
    delinquentSubscriptions,
    mrr: Number(mrr.toFixed(2)),
    webhooksProcessed: webhookCount("PROCESSED"),
    webhooksFailed: webhookCount("FAILED"),
  };
}

// ---------------------------------------------------------------------------
// Usuários
// ---------------------------------------------------------------------------

export interface ListUsersFilters extends PageOptions {
  search?: string;
  role?: Role;
  status?: UserStatusFilter;
}

export interface AdminUserListItem {
  id: string;
  name: string;
  email: string;
  globalRole: Role;
  isActive: boolean;
  createdAt: Date;
  organizations: { id: string; name: string; isActive: boolean }[];
}

export async function listUsers(actor: AdminActor, filters: ListUsersFilters = {}) {
  assertAdmin(actor);

  const where: Prisma.UserWhereInput = {
    ...(filters.search
      ? { OR: [{ name: contains(filters.search) }, { email: contains(filters.search) }] }
      : {}),
    ...(filters.role ? { globalRole: filters.role } : {}),
    ...(filters.status ? { isActive: filters.status === "active" } : {}),
  };

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      ...paginate(filters),
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        globalRole: true,
        isActive: true,
        createdAt: true,
        memberships: {
          select: { organization: { select: { id: true, name: true, isActive: true } } },
        },
      },
    }),
    prisma.user.count({ where }),
  ]);

  const items: AdminUserListItem[] = users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    globalRole: u.globalRole,
    isActive: u.isActive,
    createdAt: u.createdAt,
    organizations: u.memberships.map((m) => m.organization),
  }));

  return { users: items, total };
}

// ---------------------------------------------------------------------------
// Organizações
// ---------------------------------------------------------------------------

export interface ListOrganizationsFilters extends PageOptions {
  search?: string;
  status?: OrgStatusFilter;
}

export async function listOrganizations(
  actor: AdminActor,
  filters: ListOrganizationsFilters = {},
) {
  assertAdmin(actor);

  const where: Prisma.OrganizationWhereInput = {
    ...(filters.search
      ? { OR: [{ name: contains(filters.search) }, { slug: contains(filters.search) }] }
      : {}),
    ...(filters.status ? { isActive: filters.status === "active" } : {}),
  };

  const [organizations, total] = await Promise.all([
    prisma.organization.findMany({
      where,
      ...paginate(filters),
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        slug: true,
        isActive: true,
        createdAt: true,
        _count: {
          select: {
            memberships: true,
            relationships: { where: { isActive: true } },
            workouts: true,
          },
        },
        subscriptions: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { status: true, plan: { select: { name: true } } },
        },
      },
    }),
    prisma.organization.count({ where }),
  ]);

  const items = organizations.map((o) => ({
    id: o.id,
    name: o.name,
    slug: o.slug,
    isActive: o.isActive,
    createdAt: o.createdAt,
    trainers: o._count.memberships,
    athletes: o._count.relationships,
    workouts: o._count.workouts,
    planName: o.subscriptions[0]?.plan.name ?? null,
    subscriptionStatus: o.subscriptions[0]?.status ?? null,
  }));

  return { organizations: items, total };
}

// Detalhe de UMA organização — a tela de diagnóstico: quem é o time, qual o
// plano e o que já foi produzido. A trilha da organização NÃO vem junto: a UI
// consome `listAuditTrail` com `organizationId`, que já tem filtro por ação e
// período. Duplicar aqui um "últimos 20 eventos" custaria mais uma query por
// abertura de tela para entregar um subconjunto pior.
export async function getOrganizationDetail(actor: AdminActor, organizationId: string) {
  assertAdmin(actor);

  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      id: true,
      name: true,
      slug: true,
      timezone: true,
      isActive: true,
      createdAt: true,
      memberships: {
        orderBy: { createdAt: "asc" },
        select: {
          role: true,
          user: { select: { id: true, name: true, email: true, globalRole: true, isActive: true } },
        },
      },
      subscriptions: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          id: true,
          status: true,
          currentPeriodStart: true,
          currentPeriodEnd: true,
          cancelAtPeriodEnd: true,
          cancelledAt: true,
          plan: { select: { name: true, price: true, billingCycle: true } },
        },
      },
    },
  });

  if (!organization) {
    throw new NotFoundError("Organização não encontrada.");
  }

  const [relationships, workouts, workoutsCompleted, pendingInvitations, reports] =
    await Promise.all([
      prisma.coachAthleteRelationship.findMany({
        where: { organizationId, isActive: true },
        orderBy: { startedAt: "desc" },
        select: {
          athlete: {
            select: { id: true, user: { select: { name: true, email: true, isActive: true } } },
          },
          trainer: { select: { id: true, user: { select: { name: true } } } },
        },
      }),
      prisma.workout.count({ where: { organizationId } }),
      prisma.workout.count({ where: { organizationId, status: "COMPLETED" } }),
      prisma.athleteInvitation.count({
        where: { organizationId, isConsumed: false, isRevoked: false, expiresAt: { gt: new Date() } },
      }),
      prisma.report.count({ where: { organizationId } }),
    ]);

  const subscription = organization.subscriptions[0] ?? null;

  // Leitura cross-tenant é auditada (ver domain/audit.ts). Fora de transação de
  // propósito: não há estado a manter atômico, e uma falha ao gravar a trilha
  // não deve derrubar o diagnóstico que o admin veio fazer.
  await recordAuditLog(prisma, {
    action: "ADMIN_VIEW_ORGANIZATION",
    entityName: "Organization",
    entityId: organizationId,
    userId: actor.userId,
    organizationId,
    ipAddress: actor.ipAddress,
    userAgent: actor.userAgent,
  });

  return {
    organization: {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      timezone: organization.timezone,
      isActive: organization.isActive,
      createdAt: organization.createdAt,
    },
    subscription: subscription
      ? {
          id: subscription.id,
          status: subscription.status,
          planName: subscription.plan.name,
          // Decimal → number na fronteira do módulo: o cliente recebe JSON, e
          // Decimal serializa como string, o que quebraria formatação na UI.
          planPrice: Number(subscription.plan.price),
          billingCycle: subscription.plan.billingCycle,
          currentPeriodStart: subscription.currentPeriodStart,
          currentPeriodEnd: subscription.currentPeriodEnd,
          cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
          cancelledAt: subscription.cancelledAt,
        }
      : null,
    members: organization.memberships.map((m) => ({
      userId: m.user.id,
      name: m.user.name,
      email: m.user.email,
      globalRole: m.user.globalRole,
      isActive: m.user.isActive,
      organizationRole: m.role,
    })),
    athletes: relationships.map((r) => ({
      id: r.athlete.id,
      name: r.athlete.user?.name ?? "(convite pendente)",
      email: r.athlete.user?.email ?? null,
      isActive: r.athlete.user?.isActive ?? false,
      trainerName: r.trainer.user.name,
    })),
    counts: {
      trainers: organization.memberships.length,
      athletes: relationships.length,
      workouts,
      workoutsCompleted,
      pendingInvitations,
      reports,
    },
  };
}

// ---------------------------------------------------------------------------
// Treinadores e atletas
// ---------------------------------------------------------------------------

export interface ListProfilesFilters extends PageOptions {
  search?: string;
}

export async function listTrainers(actor: AdminActor, filters: ListProfilesFilters = {}) {
  assertAdmin(actor);

  const where: Prisma.TrainerProfileWhereInput = filters.search
    ? { user: { OR: [{ name: contains(filters.search) }, { email: contains(filters.search) }] } }
    : {};

  const [trainers, total] = await Promise.all([
    prisma.trainerProfile.findMany({
      where,
      ...paginate(filters),
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        crefCode: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            isActive: true,
            memberships: {
              take: 1,
              orderBy: { createdAt: "asc" },
              select: { organization: { select: { id: true, name: true, isActive: true } } },
            },
          },
        },
        _count: { select: { relationships: { where: { isActive: true } }, workouts: true } },
      },
    }),
    prisma.trainerProfile.count({ where }),
  ]);

  const items = trainers.map((t) => ({
    id: t.id,
    userId: t.user.id,
    name: t.user.name,
    email: t.user.email,
    isActive: t.user.isActive,
    crefCode: t.crefCode,
    createdAt: t.createdAt,
    // ADR-001: o treinador tem a organização pessoal dele — a primeira
    // membership é a organização dele, não "uma qualquer".
    organization: t.user.memberships[0]?.organization ?? null,
    athletes: t._count.relationships,
    workouts: t._count.workouts,
  }));

  return { trainers: items, total };
}

export type AdminAthleteStatus = "ACTIVE" | "BLOCKED" | "PENDING_INVITE";

export async function listAthletes(actor: AdminActor, filters: ListProfilesFilters = {}) {
  assertAdmin(actor);

  // Busca também pelo e-mail do convite: um atleta convidado e ainda não
  // ativado NÃO tem User, e é justamente ele que o suporte procura ("convidei
  // fulano e ele não recebeu").
  const where: Prisma.AthleteProfileWhereInput = filters.search
    ? {
        OR: [
          { user: { OR: [{ name: contains(filters.search) }, { email: contains(filters.search) }] } },
          { invitations: { some: { email: contains(filters.search) } } },
        ],
      }
    : {};

  const [athletes, total] = await Promise.all([
    prisma.athleteProfile.findMany({
      where,
      ...paginate(filters),
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        createdAt: true,
        user: { select: { id: true, name: true, email: true, isActive: true } },
        relationships: {
          where: { isActive: true },
          take: 1,
          select: {
            organization: { select: { id: true, name: true, isActive: true } },
            trainer: { select: { user: { select: { name: true } } } },
          },
        },
        invitations: {
          take: 1,
          orderBy: { createdAt: "desc" },
          select: { email: true, isConsumed: true, isRevoked: true, expiresAt: true },
        },
        _count: { select: { workouts: true } },
      },
    }),
    prisma.athleteProfile.count({ where }),
  ]);

  const items = athletes.map((a) => {
    const status: AdminAthleteStatus = !a.user
      ? "PENDING_INVITE"
      : a.user.isActive
        ? "ACTIVE"
        : "BLOCKED";
    return {
      id: a.id,
      userId: a.user?.id ?? null,
      name: a.user?.name ?? "(convite pendente)",
      email: a.user?.email ?? a.invitations[0]?.email ?? null,
      status,
      createdAt: a.createdAt,
      organization: a.relationships[0]?.organization ?? null,
      trainerName: a.relationships[0]?.trainer.user.name ?? null,
      workouts: a._count.workouts,
    };
  });

  return { athletes: items, total };
}

// ---------------------------------------------------------------------------
// Trilha de auditoria
// ---------------------------------------------------------------------------

export interface ListAuditFilters extends PageOptions {
  action?: string;
  organizationId?: string;
  userId?: string;
  from?: Date;
  to?: Date;
}

export async function listAuditTrail(actor: AdminActor, filters: ListAuditFilters = {}) {
  assertAdmin(actor);

  const where: Prisma.AuditLogWhereInput = {
    ...(filters.action ? { action: filters.action } : {}),
    ...(filters.organizationId ? { organizationId: filters.organizationId } : {}),
    ...(filters.userId ? { userId: filters.userId } : {}),
    ...(filters.from || filters.to
      ? {
          createdAt: {
            ...(filters.from ? { gte: filters.from } : {}),
            ...(filters.to ? { lte: filters.to } : {}),
          },
        }
      : {}),
  };

  const [logs, total, distinct] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      ...paginate(filters),
      include: {
        user: { select: { name: true, email: true } },
        organization: { select: { id: true, name: true } },
      },
    }),
    prisma.auditLog.count({ where }),
    // Ações distintas REALMENTE presentes, para popular o filtro da UI a partir
    // de dados e não do catálogo inteiro (que listaria ações nunca usadas).
    prisma.auditLog.findMany({
      distinct: ["action"],
      select: { action: true },
      orderBy: { action: "asc" },
    }),
  ]);

  return { logs, total, actions: distinct.map((d) => d.action) };
}

// ---------------------------------------------------------------------------
// Ações de estado (reversíveis, auditadas)
// ---------------------------------------------------------------------------

export async function setUserActive(
  actor: AdminActor,
  userId: string,
  input: SetUserStatusInput,
) {
  assertAdmin(actor);

  // Auto-bloqueio tranca o admin para fora do próprio painel — e desbloquear
  // exigiria o banco, que é exatamente o que esta fase existe para evitar.
  if (userId === actor.userId && !input.isActive) {
    throw new BusinessRuleError("Um admin não pode bloquear a própria conta.");
  }

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      globalRole: true,
      isActive: true,
      memberships: { take: 1, orderBy: { createdAt: "asc" }, select: { organizationId: true } },
    },
  });

  if (!target) {
    throw new NotFoundError("Usuário não encontrado.");
  }

  // Um ADMIN não derruba outro ADMIN/SUPERADMIN: sem isso, qualquer admin
  // poderia bloquear todos os outros e sequestrar a plataforma. Só o
  // SUPERADMIN mexe em pares e acima.
  if (ADMIN_ROLES.includes(target.globalRole) && actor.globalRole !== "SUPERADMIN") {
    throw new AuthorizationError(
      "Apenas SUPERADMIN pode alterar o estado de contas ADMIN ou SUPERADMIN.",
    );
  }

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: { id: userId },
      // Soft: nunca delete. `isActive: false` já é honrado por
      // `getCurrentSession`, então o bloqueio vale na próxima requisição.
      data: { isActive: input.isActive },
      select: { id: true, name: true, email: true, globalRole: true, isActive: true },
    });

    // Derrubar as sessões vivas é o que torna o bloqueio imediato em vez de
    // "vale a partir do próximo login". Atômico com o update pelo mesmo `tx`.
    if (!input.isActive) {
      await revokeAllSessionsForUser(userId, tx);
    }

    await recordAuditLog(tx, {
      action: input.isActive ? "ADMIN_UNBLOCK_USER" : "ADMIN_BLOCK_USER",
      entityName: "User",
      entityId: userId,
      userId: actor.userId,
      organizationId: target.memberships[0]?.organizationId,
      reason: input.reason,
      changedFields: ["isActive"],
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    return user;
  });
}

export async function setOrganizationActive(
  actor: AdminActor,
  organizationId: string,
  input: SetOrganizationStatusInput,
) {
  assertAdmin(actor);

  const target = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { id: true },
  });

  if (!target) {
    throw new NotFoundError("Organização não encontrada.");
  }

  return prisma.$transaction(async (tx) => {
    const organization = await tx.organization.update({
      where: { id: organizationId },
      data: { isActive: input.isActive },
      select: { id: true, name: true, slug: true, isActive: true },
    });

    await recordAuditLog(tx, {
      action: input.isActive ? "ADMIN_REACTIVATE_ORGANIZATION" : "ADMIN_SUSPEND_ORGANIZATION",
      entityName: "Organization",
      entityId: organizationId,
      userId: actor.userId,
      organizationId,
      reason: input.reason,
      changedFields: ["isActive"],
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    return organization;
  });
}
