import { CoachAthleteRole, OrganizationRole } from "@prisma/client";
import { recordAuditLog } from "@/domain/audit";
import { BusinessRuleError, NotFoundError, ValidationError } from "@/domain/errors";
import { prisma } from "@/infrastructure/database/prisma";
import { ORG_ROLES } from "@/modules/organizations/org-roles";
import type {
  AssignAthleteInput,
  SetMemberActiveInput,
  SetMemberRoleInput,
  TransferAthleteInput,
} from "./team-schemas";

// Gestão de equipe e carteiras (§18–19). Gerencia membros EXISTENTES da
// organização (papel/ativação) e a atribuição de atletas aos treinadores.
// Convidar um treinador NOVO (e-mail → registro → entrar na org) depende do
// suporte a múltiplas organizações por usuário (ADR-001/Fase 6) e fica fora
// desta fatia. Ações sensíveis (papel/transferência) são auditadas (§32).

export interface TeamActor {
  userId: string;
  organizationId: string;
  ipAddress?: string;
}

export const TEAM_READ_ROLES = ["MANAGER", "HEAD_COACH", "SUPPORT", "VIEWER"] as const;
export const TEAM_MANAGE_ROLES = ["MANAGER"] as const;
export const CARTEIRA_WRITE_ROLES = ["MANAGER", "HEAD_COACH"] as const;

// Papéis atribuíveis por esta gestão = ORG_ROLES sem OWNER (dono não se define
// aqui; troca de dono é operação à parte).
const ASSIGNABLE_ROLES = ORG_ROLES.filter((r) => r !== "OWNER");

// Lista os membros da organização com papel, status e tamanho da carteira ativa.
export async function listTrainers(actor: TeamActor) {
  const memberships = await prisma.organizationMembership.findMany({
    where: { organizationId: actor.organizationId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          trainerProfile: { select: { id: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  // Carteira ativa por treinador (groupBy evita N+1).
  const counts = await prisma.coachAthleteRelationship.groupBy({
    by: ["trainerId"],
    where: { organizationId: actor.organizationId, isActive: true },
    _count: { _all: true },
  });
  const byTrainer = new Map(counts.map((c) => [c.trainerId, c._count._all]));

  return {
    trainers: memberships.map((m) => ({
      userId: m.userId,
      name: m.user.name,
      email: m.user.email,
      role: m.role,
      isActive: m.isActive,
      trainerProfileId: m.user.trainerProfile?.id ?? null,
      activeAthletes: m.user.trainerProfile ? (byTrainer.get(m.user.trainerProfile.id) ?? 0) : 0,
    })),
  };
}

async function getTargetMembership(userId: string, organizationId: string) {
  const membership = await prisma.organizationMembership.findUnique({
    where: { userId_organizationId: { userId, organizationId } },
  });
  if (!membership) throw new NotFoundError("Membro não encontrado.");
  return membership;
}

// Guardas comuns: não mexer no OWNER nem em si mesmo (evita se trancar fora).
function assertMutable(target: { userId: string; role: OrganizationRole }, actor: TeamActor) {
  if (target.role === "OWNER") throw new BusinessRuleError("O proprietário não pode ser alterado aqui.");
  if (target.userId === actor.userId) throw new BusinessRuleError("Você não pode alterar seu próprio vínculo.");
}

export async function setMemberRole(input: SetMemberRoleInput, actor: TeamActor) {
  if (!ASSIGNABLE_ROLES.includes(input.role as (typeof ASSIGNABLE_ROLES)[number])) {
    throw new ValidationError("Papel não atribuível.");
  }
  const membership = await getTargetMembership(input.userId, actor.organizationId);
  assertMutable(membership, actor);

  return prisma.$transaction(async (tx) => {
    const updated = await tx.organizationMembership.update({
      where: { userId_organizationId: { userId: input.userId, organizationId: actor.organizationId } },
      data: { role: input.role },
    });
    await recordAuditLog(tx, {
      action: "CHANGE_MEMBER_ROLE",
      entityName: "OrganizationMembership",
      entityId: updated.id,
      userId: actor.userId,
      organizationId: actor.organizationId,
      ipAddress: actor.ipAddress,
      changedFields: ["role"],
    });
    return updated;
  });
}

export async function setMemberActive(input: SetMemberActiveInput, actor: TeamActor) {
  const membership = await getTargetMembership(input.userId, actor.organizationId);
  assertMutable(membership, actor);

  return prisma.$transaction(async (tx) => {
    const updated = await tx.organizationMembership.update({
      where: { userId_organizationId: { userId: input.userId, organizationId: actor.organizationId } },
      data: { isActive: input.isActive },
    });
    await recordAuditLog(tx, {
      action: "SET_MEMBER_ACTIVE",
      entityName: "OrganizationMembership",
      entityId: updated.id,
      userId: actor.userId,
      organizationId: actor.organizationId,
      ipAddress: actor.ipAddress,
      changedFields: ["isActive"],
    });
    return updated;
  });
}

async function assertTrainerInOrg(trainerId: string, organizationId: string): Promise<void> {
  const tp = await prisma.trainerProfile.findUnique({ where: { id: trainerId }, select: { userId: true } });
  if (!tp) throw new ValidationError("Treinador inválido.");
  const membership = await prisma.organizationMembership.findUnique({
    where: { userId_organizationId: { userId: tp.userId, organizationId } },
  });
  if (!membership) throw new ValidationError("Treinador não pertence à organização.");
}

async function assertAthleteInOrg(athleteId: string, organizationId: string): Promise<void> {
  const rel = await prisma.coachAthleteRelationship.findFirst({ where: { athleteId, organizationId } });
  if (!rel) throw new ValidationError("Atleta não pertence à organização.");
}

// Atribui (ou reativa) um atleta a um treinador com um papel na carteira. Upsert
// sobre @@unique([org, trainer, athlete]) — reatribuir o mesmo par só muda o papel.
export async function assignAthlete(input: AssignAthleteInput, actor: TeamActor) {
  await assertTrainerInOrg(input.trainerId, actor.organizationId);
  await assertAthleteInOrg(input.athleteId, actor.organizationId);
  const role = input.role ?? CoachAthleteRole.PRIMARY;

  return prisma.$transaction(async (tx) => {
    const rel = await tx.coachAthleteRelationship.upsert({
      where: {
        organizationId_trainerId_athleteId: {
          organizationId: actor.organizationId,
          trainerId: input.trainerId,
          athleteId: input.athleteId,
        },
      },
      create: {
        organizationId: actor.organizationId,
        trainerId: input.trainerId,
        athleteId: input.athleteId,
        role,
        assignedByUserId: actor.userId,
      },
      update: { role, isActive: true, endedAt: null, assignedByUserId: actor.userId },
    });
    await recordAuditLog(tx, {
      action: "ASSIGN_ATHLETE",
      entityName: "CoachAthleteRelationship",
      entityId: rel.id,
      userId: actor.userId,
      organizationId: actor.organizationId,
      ipAddress: actor.ipAddress,
    });
    return rel;
  });
}

// Encerra o vínculo (soft): preserva o histórico (§19).
export async function unassignAthlete(input: { trainerId: string; athleteId: string }, actor: TeamActor) {
  const rel = await prisma.coachAthleteRelationship.findUnique({
    where: {
      organizationId_trainerId_athleteId: {
        organizationId: actor.organizationId,
        trainerId: input.trainerId,
        athleteId: input.athleteId,
      },
    },
  });
  if (!rel) throw new NotFoundError("Vínculo não encontrado.");

  return prisma.$transaction(async (tx) => {
    const updated = await tx.coachAthleteRelationship.update({
      where: { id: rel.id },
      data: { isActive: false, endedAt: new Date(), terminationReason: "Desatribuído" },
    });
    await recordAuditLog(tx, {
      action: "UNASSIGN_ATHLETE",
      entityName: "CoachAthleteRelationship",
      entityId: rel.id,
      userId: actor.userId,
      organizationId: actor.organizationId,
      ipAddress: actor.ipAddress,
    });
    return updated;
  });
}

// Transfere o atleta: encerra o vínculo de origem e cria/reativa o destino como
// PRIMARY. Atômico e auditado (§32).
export async function transferAthlete(input: TransferAthleteInput, actor: TeamActor) {
  if (input.fromTrainerId === input.toTrainerId) {
    throw new ValidationError("Treinador de origem e destino são iguais.");
  }
  await assertTrainerInOrg(input.toTrainerId, actor.organizationId);
  const from = await prisma.coachAthleteRelationship.findUnique({
    where: {
      organizationId_trainerId_athleteId: {
        organizationId: actor.organizationId,
        trainerId: input.fromTrainerId,
        athleteId: input.athleteId,
      },
    },
  });
  if (!from || !from.isActive) throw new NotFoundError("Vínculo de origem ativo não encontrado.");

  return prisma.$transaction(async (tx) => {
    await tx.coachAthleteRelationship.update({
      where: { id: from.id },
      data: { isActive: false, endedAt: new Date(), terminationReason: "Transferido" },
    });
    const to = await tx.coachAthleteRelationship.upsert({
      where: {
        organizationId_trainerId_athleteId: {
          organizationId: actor.organizationId,
          trainerId: input.toTrainerId,
          athleteId: input.athleteId,
        },
      },
      create: {
        organizationId: actor.organizationId,
        trainerId: input.toTrainerId,
        athleteId: input.athleteId,
        role: CoachAthleteRole.PRIMARY,
        assignedByUserId: actor.userId,
      },
      update: { role: CoachAthleteRole.PRIMARY, isActive: true, endedAt: null, assignedByUserId: actor.userId },
    });
    await recordAuditLog(tx, {
      action: "TRANSFER_ATHLETE",
      entityName: "CoachAthleteRelationship",
      entityId: to.id,
      userId: actor.userId,
      organizationId: actor.organizationId,
      ipAddress: actor.ipAddress,
      reason: `from=${input.fromTrainerId}`,
    });
    return to;
  });
}
