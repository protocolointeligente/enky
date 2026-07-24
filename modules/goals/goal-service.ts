import type { Prisma } from "@prisma/client";
import { recordAuditLog } from "@/domain/audit";
import { ConflictError, NotFoundError } from "@/domain/errors";
import { prisma } from "@/infrastructure/database/prisma";
import type { CreateGoalInput, UpdateGoalInput } from "./goal-schema";

// Serviço de metas do atleta (§11). Escopo sempre org + athleteProfileId (tenant
// + athlete isolation). Toda mutação registra um AthleteGoalEvent (histórico); a
// meta é do atleta — o treinador só COMENTA (addTrainerComment), nunca edita.

export interface AthleteGoalActor {
  organizationId: string;
  athleteProfileId: string;
  userId: string;
}

export interface TrainerGoalActor {
  organizationId: string;
  athleteProfileId: string;
  userId: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface GoalEventView {
  id: string;
  kind: string;
  authorRole: string;
  note: string | null;
  changedFields: string[];
  createdAt: string;
}

export interface GoalView {
  id: string;
  title: string;
  type: string;
  modality: string | null;
  targetEvent: string | null;
  targetDate: string | null;
  weeklyFrequency: number | null;
  targets: Record<string, number> | null;
  priority: string;
  status: string;
  progress: number;
  notes: string | null;
  lockVersion: number;
  createdAt: string;
  updatedAt: string;
  events: GoalEventView[];
}

type GoalRow = Prisma.AthleteGoalGetPayload<{ include: { events: true } }>;

function toView(g: GoalRow): GoalView {
  return {
    id: g.id,
    title: g.title,
    type: g.type,
    modality: g.modality,
    targetEvent: g.targetEvent,
    targetDate: g.targetDate ? g.targetDate.toISOString().slice(0, 10) : null,
    weeklyFrequency: g.weeklyFrequency,
    targets: (g.targets as Record<string, number> | null) ?? null,
    priority: g.priority,
    status: g.status,
    progress: g.progress,
    notes: g.notes,
    lockVersion: g.lockVersion,
    createdAt: g.createdAt.toISOString(),
    updatedAt: g.updatedAt.toISOString(),
    events: (g.events ?? [])
      .slice()
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .map((e) => ({
        id: e.id,
        kind: e.kind,
        authorRole: e.authorRole,
        note: e.note,
        changedFields: e.changedFields,
        createdAt: e.createdAt.toISOString(),
      })),
  };
}

function dataFromInput(input: UpdateGoalInput) {
  const data: Prisma.AthleteGoalUncheckedUpdateInput = {};
  if (input.title !== undefined) data.title = input.title;
  if (input.type !== undefined) data.type = input.type;
  if (input.modality !== undefined) data.modality = input.modality ?? null;
  if (input.targetEvent !== undefined) data.targetEvent = input.targetEvent ?? null;
  if (input.targetDate !== undefined)
    data.targetDate = input.targetDate ? new Date(input.targetDate) : null;
  if (input.weeklyFrequency !== undefined) data.weeklyFrequency = input.weeklyFrequency ?? null;
  if (input.targets !== undefined)
    data.targets = (input.targets ?? undefined) as Prisma.InputJsonValue | undefined;
  if (input.priority !== undefined) data.priority = input.priority;
  if (input.notes !== undefined) data.notes = input.notes ?? null;
  if ("status" in input && input.status !== undefined) data.status = input.status;
  if ("progress" in input && input.progress !== undefined) data.progress = input.progress;
  return data;
}

export async function listAthleteGoals(
  organizationId: string,
  athleteId: string,
): Promise<GoalView[]> {
  const goals = await prisma.athleteGoal.findMany({
    where: { organizationId, athleteId },
    include: { events: true },
    orderBy: [{ status: "asc" }, { targetDate: "asc" }, { createdAt: "desc" }],
  });
  return goals.map(toView);
}

async function requireOwnedGoal(id: string, organizationId: string, athleteId: string) {
  const goal = await prisma.athleteGoal.findFirst({
    where: { id, organizationId, athleteId },
    include: { events: true },
  });
  if (!goal) throw new NotFoundError("Meta não encontrada.");
  return goal;
}

export async function getGoal(
  id: string,
  organizationId: string,
  athleteId: string,
): Promise<GoalView> {
  return toView(await requireOwnedGoal(id, organizationId, athleteId));
}

export async function createGoal(
  input: CreateGoalInput,
  actor: AthleteGoalActor,
): Promise<GoalView> {
  const created = await prisma.$transaction(async (tx) => {
    const goal = await tx.athleteGoal.create({
      data: {
        organizationId: actor.organizationId,
        athleteId: actor.athleteProfileId,
        title: input.title,
        type: input.type,
        modality: input.modality ?? null,
        targetEvent: input.targetEvent ?? null,
        targetDate: input.targetDate ? new Date(input.targetDate) : null,
        weeklyFrequency: input.weeklyFrequency ?? null,
        targets: (input.targets ?? undefined) as Prisma.InputJsonValue | undefined,
        priority: input.priority,
        notes: input.notes ?? null,
      },
    });
    await tx.athleteGoalEvent.create({
      data: { goalId: goal.id, authorUserId: actor.userId, authorRole: "ATHLETE", kind: "CREATED" },
    });
    return tx.athleteGoal.findUniqueOrThrow({ where: { id: goal.id }, include: { events: true } });
  });
  return toView(created);
}

export async function updateGoal(
  id: string,
  input: UpdateGoalInput,
  actor: AthleteGoalActor,
): Promise<GoalView> {
  const existing = await requireOwnedGoal(id, actor.organizationId, actor.athleteProfileId);
  if (existing.lockVersion !== input.lockVersion) {
    throw new ConflictError("Meta foi alterada em outro lugar. Recarregue e tente de novo.");
  }

  const changedFields = Object.keys(input).filter((k) => k !== "lockVersion");
  const archiving = input.status === "ARCHIVED" && existing.status !== "ARCHIVED";

  const updated = await prisma.$transaction(async (tx) => {
    await tx.athleteGoal.update({
      where: { id },
      data: { ...dataFromInput(input), lockVersion: { increment: 1 } },
    });
    await tx.athleteGoalEvent.create({
      data: {
        goalId: id,
        authorUserId: actor.userId,
        authorRole: "ATHLETE",
        kind: archiving ? "ARCHIVED" : "UPDATED",
        changedFields,
      },
    });
    return tx.athleteGoal.findUniqueOrThrow({ where: { id }, include: { events: true } });
  });
  return toView(updated);
}

// Treinador comenta (vínculo já verificado na rota). Nunca altera a meta; registra
// COMMENT no histórico + AuditLog (ação sobre dado de outro usuário do tenant).
export async function addTrainerComment(
  goalId: string,
  note: string,
  actor: TrainerGoalActor,
): Promise<GoalView> {
  await requireOwnedGoal(goalId, actor.organizationId, actor.athleteProfileId);
  const updated = await prisma.$transaction(async (tx) => {
    await tx.athleteGoalEvent.create({
      data: { goalId, authorUserId: actor.userId, authorRole: "TRAINER", kind: "COMMENT", note },
    });
    await recordAuditLog(tx, {
      action: "COMMENT_ATHLETE_GOAL",
      entityName: "AthleteGoal",
      entityId: goalId,
      userId: actor.userId,
      organizationId: actor.organizationId,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });
    return tx.athleteGoal.findUniqueOrThrow({ where: { id: goalId }, include: { events: true } });
  });
  return toView(updated);
}
