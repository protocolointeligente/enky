import { Prisma } from "@prisma/client";
import { recordAuditLog } from "@/domain/audit";
import { NotFoundError } from "@/domain/errors";
import { prisma } from "@/infrastructure/database/prisma";
import { requireTrainerAccessToAthlete } from "@/server/auth/guards";
import { persistWorkoutBlocks } from "@/modules/workouts/persist-blocks";
import { workoutBlocksToInput, workoutContentInclude } from "@/modules/workouts/workout-content";
import {
  applyWorkoutTemplateInputSchema,
  templateContentSchema,
  type ApplyWorkoutTemplateInput,
  type CreateWorkoutTemplateInput,
  type SaveWorkoutAsTemplateInput,
  type TemplateContent,
  type UpdateWorkoutTemplateInput,
} from "./template-schema";

export interface TemplateActor {
  userId: string;
  trainerProfileId: string;
  organizationId: string;
  ipAddress?: string;
  userAgent?: string;
}

type TrainerScope = Pick<TemplateActor, "organizationId" | "trainerProfileId">;

export interface TemplateListItem {
  id: string;
  title: string;
  description: string | null;
  modality: string;
  isActive: boolean;
  updatedAt: string;
}

// Stored objects can carry `undefined` on optional keys after Zod parsing;
// round-tripping through JSON drops them so Prisma's Json column stays clean.
function toJson(content: TemplateContent): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(content)) as Prisma.InputJsonValue;
}

async function loadOwnedTemplate(id: string, actor: TrainerScope) {
  const template = await prisma.workoutTemplate.findUnique({ where: { id } });
  if (
    !template ||
    template.organizationId !== actor.organizationId ||
    template.trainerId !== actor.trainerProfileId
  ) {
    throw new NotFoundError("Template não encontrado.");
  }
  return template;
}

export async function listTemplates(
  actor: TrainerScope,
  filters: { includeInactive?: boolean } = {},
): Promise<TemplateListItem[]> {
  const templates = await prisma.workoutTemplate.findMany({
    where: {
      organizationId: actor.organizationId,
      trainerId: actor.trainerProfileId,
      ...(filters.includeInactive ? {} : { isActive: true }),
    },
    orderBy: [{ isActive: "desc" }, { updatedAt: "desc" }],
    select: {
      id: true,
      title: true,
      description: true,
      modality: true,
      isActive: true,
      updatedAt: true,
    },
  });
  return templates.map((t) => ({
    id: t.id,
    title: t.title,
    description: t.description,
    modality: t.modality,
    isActive: t.isActive,
    updatedAt: t.updatedAt.toISOString(),
  }));
}

export async function getTemplate(id: string, actor: TrainerScope) {
  const template = await loadOwnedTemplate(id, actor);
  return {
    id: template.id,
    title: template.title,
    description: template.description,
    modality: template.modality,
    isActive: template.isActive,
    lockVersion: template.lockVersion,
    // Defensive re-validation of the stored snapshot into typed content.
    content: templateContentSchema.parse(template.contentSnapshot),
  };
}

export async function createTemplate(input: CreateWorkoutTemplateInput, actor: TemplateActor) {
  return prisma.$transaction(async (tx) => {
    const template = await tx.workoutTemplate.create({
      data: {
        organizationId: actor.organizationId,
        trainerId: actor.trainerProfileId,
        title: input.title,
        description: input.description,
        modality: input.modality,
        contentSnapshot: toJson(input.content),
      },
    });
    await recordAuditLog(tx, {
      action: "CREATE_WORKOUT_TEMPLATE",
      entityName: "WorkoutTemplate",
      entityId: template.id,
      userId: actor.userId,
      organizationId: actor.organizationId,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });
    return template;
  });
}

export async function updateTemplate(
  id: string,
  input: UpdateWorkoutTemplateInput,
  actor: TemplateActor,
) {
  await loadOwnedTemplate(id, actor);
  return prisma.$transaction(async (tx) => {
    const template = await tx.workoutTemplate.update({
      where: { id },
      data: {
        title: input.title,
        description: input.description,
        modality: input.modality,
        contentSnapshot: toJson(input.content),
        lockVersion: { increment: 1 },
      },
    });
    await recordAuditLog(tx, {
      action: "UPDATE_WORKOUT_TEMPLATE",
      entityName: "WorkoutTemplate",
      entityId: id,
      userId: actor.userId,
      organizationId: actor.organizationId,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });
    return template;
  });
}

export async function archiveTemplate(id: string, actor: TemplateActor) {
  await loadOwnedTemplate(id, actor);
  return prisma.$transaction(async (tx) => {
    const template = await tx.workoutTemplate.update({ where: { id }, data: { isActive: false } });
    await recordAuditLog(tx, {
      action: "ARCHIVE_WORKOUT_TEMPLATE",
      entityName: "WorkoutTemplate",
      entityId: id,
      userId: actor.userId,
      organizationId: actor.organizationId,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });
    return template;
  });
}

export async function duplicateTemplate(id: string, actor: TemplateActor) {
  const source = await loadOwnedTemplate(id, actor);
  return prisma.$transaction(async (tx) => {
    const copy = await tx.workoutTemplate.create({
      data: {
        organizationId: actor.organizationId,
        trainerId: actor.trainerProfileId,
        title: `${source.title} (cópia)`,
        description: source.description,
        modality: source.modality,
        // Copy the snapshot by value — the copy is independent of the source.
        contentSnapshot: source.contentSnapshot ?? Prisma.JsonNull,
      },
    });
    await recordAuditLog(tx, {
      action: "DUPLICATE_WORKOUT_TEMPLATE",
      entityName: "WorkoutTemplate",
      entityId: copy.id,
      userId: actor.userId,
      organizationId: actor.organizationId,
      reason: `duplicated_from:${source.id}`,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });
    return copy;
  });
}

// Applies a template to an athlete/date: creates a NEW Workout (DRAFT,
// source=TEMPLATE) whose blocks are a fresh copy of the template snapshot. The
// template row is never touched, so later edits to either side stay isolated.
export async function applyTemplate(
  id: string,
  rawInput: ApplyWorkoutTemplateInput,
  actor: TemplateActor,
) {
  const input = applyWorkoutTemplateInputSchema.parse(rawInput);
  const template = await loadOwnedTemplate(id, actor);
  const content = templateContentSchema.parse(template.contentSnapshot);

  await requireTrainerAccessToAthlete(
    actor.organizationId,
    actor.trainerProfileId,
    input.athleteId,
  );

  return prisma.$transaction(async (tx) => {
    const workout = await tx.workout.create({
      data: {
        organizationId: actor.organizationId,
        athleteId: input.athleteId,
        trainerId: actor.trainerProfileId,
        workoutTemplateId: template.id,
        title: template.title,
        description: template.description,
        modality: template.modality,
        status: "DRAFT",
        source: "TEMPLATE",
        plannedDate: new Date(`${input.plannedDate}T00:00:00.000Z`),
      },
    });
    await persistWorkoutBlocks(tx, workout.id, actor.organizationId, content.blocks);
    await recordAuditLog(tx, {
      action: "APPLY_WORKOUT_TEMPLATE",
      entityName: "Workout",
      entityId: workout.id,
      userId: actor.userId,
      organizationId: actor.organizationId,
      reason: `applied_template:${template.id}`,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });
    return workout;
  });
}

// Saves an existing workout's content as a reusable template. Reads the
// workout's block tree and snapshots it — the workout is not modified.
export async function saveWorkoutAsTemplate(
  workoutId: string,
  input: SaveWorkoutAsTemplateInput,
  actor: TemplateActor,
) {
  const workout = await prisma.workout.findUnique({
    where: { id: workoutId },
    include: workoutContentInclude,
  });
  if (
    !workout ||
    workout.organizationId !== actor.organizationId ||
    workout.trainerId !== actor.trainerProfileId
  ) {
    throw new NotFoundError("Treino não encontrado.");
  }

  const content: TemplateContent = {
    blocks: workoutBlocksToInput(workout.blocks),
    tags: input.tags,
  };

  return prisma.$transaction(async (tx) => {
    const template = await tx.workoutTemplate.create({
      data: {
        organizationId: actor.organizationId,
        trainerId: actor.trainerProfileId,
        title: input.title,
        description: input.description,
        modality: workout.modality,
        contentSnapshot: toJson(content),
      },
    });
    await recordAuditLog(tx, {
      action: "CREATE_WORKOUT_TEMPLATE",
      entityName: "WorkoutTemplate",
      entityId: template.id,
      userId: actor.userId,
      organizationId: actor.organizationId,
      reason: `from_workout:${workout.id}`,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });
    return template;
  });
}
