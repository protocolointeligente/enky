import { Prisma, type Modality } from "@prisma/client";
import { recordAuditLog } from "@/domain/audit";
import { AuthorizationError, ConflictError, NotFoundError } from "@/domain/errors";
import { prisma } from "@/infrastructure/database/prisma";
import type { CreateExerciseInput, UpdateExerciseInput } from "./exercise-schema";

export interface ExerciseActor {
  userId: string;
  organizationId: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface ExerciseListItem {
  id: string;
  name: string;
  category: string;
  targetMuscles: string[];
  modality: string | null;
  equipment: string | null;
  level: string | null;
  description: string | null;
  videoUrl: string | null;
  videoSource: string | null;
  videoLicense: string | null;
  isActive: boolean;
  isGlobal: boolean;
  editable: boolean;
}

export interface ListExercisesFilters {
  search?: string;
  category?: string;
  modality?: string;
  muscleGroup?: string;
  equipment?: string;
  level?: string;
  hasVideo?: boolean;
  includeInactive?: boolean;
}

// A trainer sees their own organization's exercises AND global exercises
// (organizationId = null). Exercises of OTHER organizations are never
// returned — the OR below is the only tenant boundary and it can't be widened
// by the client.
export async function listExercises(
  actor: Pick<ExerciseActor, "organizationId">,
  filters: ListExercisesFilters = {},
): Promise<ExerciseListItem[]> {
  const exercises = await prisma.exercise.findMany({
    where: {
      OR: [{ organizationId: actor.organizationId }, { organizationId: null }],
      ...(filters.search ? { name: { contains: filters.search.trim(), mode: "insensitive" } } : {}),
      ...(filters.category ? { category: filters.category } : {}),
      ...(filters.modality ? { modality: filters.modality as Modality } : {}),
      ...(filters.muscleGroup ? { targetMuscles: { has: filters.muscleGroup.trim() } } : {}),
      ...(filters.equipment
        ? { equipment: { contains: filters.equipment.trim(), mode: "insensitive" } }
        : {}),
      ...(filters.level ? { level: filters.level } : {}),
      ...(filters.hasVideo === undefined ? {} : { videoUrl: filters.hasVideo ? { not: null } : null }),
      ...(filters.includeInactive ? {} : { isActive: true }),
    },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      category: true,
      targetMuscles: true,
      modality: true,
      equipment: true,
      level: true,
      description: true,
      videoUrl: true,
      videoSource: true,
      videoLicense: true,
      isActive: true,
      organizationId: true,
    },
  });

  return exercises.map((e) => ({
    id: e.id,
    name: e.name,
    category: e.category,
    targetMuscles: e.targetMuscles,
    modality: e.modality,
    equipment: e.equipment,
    level: e.level,
    description: e.description,
    videoUrl: e.videoUrl,
    videoSource: e.videoSource,
    videoLicense: e.videoLicense,
    isActive: e.isActive,
    isGlobal: e.organizationId === null,
    editable: e.organizationId === actor.organizationId,
  }));
}

// Loads an exercise the actor is allowed to see (own org or global); anything
// else is 404 so a cross-tenant id can't be probed.
async function loadOwnedOrGlobalExercise(id: string, organizationId: string) {
  const exercise = await prisma.exercise.findUnique({ where: { id } });
  if (
    !exercise ||
    (exercise.organizationId !== null && exercise.organizationId !== organizationId)
  ) {
    throw new NotFoundError("Exercício não encontrado.");
  }
  return exercise;
}

function assertEditable(exercise: { organizationId: string | null }): void {
  if (exercise.organizationId === null) {
    throw new AuthorizationError("Exercícios globais são somente leitura.");
  }
}

export async function createExercise(input: CreateExerciseInput, actor: ExerciseActor) {
  try {
    return await prisma.$transaction(async (tx) => {
      const exercise = await tx.exercise.create({
        data: {
          organizationId: actor.organizationId,
          name: input.name,
          category: input.category,
          targetMuscles: input.targetMuscles,
          modality: input.modality,
          equipment: input.equipment,
          level: input.level,
          description: input.description,
          videoUrl: input.videoUrl,
          videoSource: input.videoSource,
          videoLicense: input.videoLicense,
        },
      });
      await recordAuditLog(tx, {
        action: "CREATE_EXERCISE",
        entityName: "Exercise",
        entityId: exercise.id,
        userId: actor.userId,
        organizationId: actor.organizationId,
        ipAddress: actor.ipAddress,
        userAgent: actor.userAgent,
      });
      return exercise;
    });
  } catch (error) {
    // @@unique([name, organizationId]) — a same-name exercise already exists
    // in this org.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new ConflictError("Já existe um exercício com este nome na sua organização.");
    }
    throw error;
  }
}

export async function updateExercise(id: string, input: UpdateExerciseInput, actor: ExerciseActor) {
  const current = await loadOwnedOrGlobalExercise(id, actor.organizationId);
  assertEditable(current);

  try {
    return await prisma.$transaction(async (tx) => {
      const exercise = await tx.exercise.update({
        where: { id },
        data: {
          name: input.name,
          category: input.category,
          targetMuscles: input.targetMuscles,
          modality: input.modality ?? null,
          equipment: input.equipment ?? null,
          level: input.level ?? null,
          description: input.description ?? null,
          videoUrl: input.videoUrl ?? null,
          videoSource: input.videoSource ?? null,
          videoLicense: input.videoLicense ?? null,
        },
      });
      await recordAuditLog(tx, {
        action: "UPDATE_EXERCISE",
        entityName: "Exercise",
        entityId: id,
        userId: actor.userId,
        organizationId: actor.organizationId,
        ipAddress: actor.ipAddress,
        userAgent: actor.userAgent,
      });
      return exercise;
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new ConflictError("Já existe um exercício com este nome na sua organização.");
    }
    throw error;
  }
}

async function setExerciseActive(id: string, isActive: boolean, actor: ExerciseActor) {
  const current = await loadOwnedOrGlobalExercise(id, actor.organizationId);
  assertEditable(current);

  return prisma.$transaction(async (tx) => {
    const exercise = await tx.exercise.update({
      where: { id },
      // Soft-only: never a hard delete. archivedAt records when it was retired
      // so it can be excluded from the normal picker without losing history.
      data: { isActive, archivedAt: isActive ? null : new Date() },
    });
    await recordAuditLog(tx, {
      action: isActive ? "REACTIVATE_EXERCISE" : "ARCHIVE_EXERCISE",
      entityName: "Exercise",
      entityId: id,
      userId: actor.userId,
      organizationId: actor.organizationId,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });
    return exercise;
  });
}

export function archiveExercise(id: string, actor: ExerciseActor) {
  return setExerciseActive(id, false, actor);
}

export function reactivateExercise(id: string, actor: ExerciseActor) {
  return setExerciseActive(id, true, actor);
}
