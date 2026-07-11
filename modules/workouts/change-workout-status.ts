import { recordAuditLog } from "@/domain/audit";
import { BusinessRuleError, ConflictError, NotFoundError } from "@/domain/errors";
import { prisma } from "@/infrastructure/database/prisma";
import type { WorkoutActor } from "./create-workout-draft";

async function loadOwnedWorkout(workoutId: string, actor: WorkoutActor) {
  const workout = await prisma.workout.findUnique({
    where: { id: workoutId },
    include: { feedback: { select: { id: true } } },
  });
  if (
    !workout ||
    workout.organizationId !== actor.organizationId ||
    workout.trainerId !== actor.trainerProfileId
  ) {
    throw new NotFoundError("Treino não encontrado.");
  }
  return workout;
}

// Only DRAFT/PUBLISHED workouts can be cancelled — a workout the athlete has
// already responded to (COMPLETED/PARTIAL/MISSED, all of which carry feedback)
// is history and must not be rewritten by a cancellation.
const CANCELLABLE_STATUSES = ["DRAFT", "PUBLISHED"] as const;

export async function cancelWorkout(workoutId: string, actor: WorkoutActor) {
  const current = await loadOwnedWorkout(workoutId, actor);
  if (!CANCELLABLE_STATUSES.includes(current.status as (typeof CANCELLABLE_STATUSES)[number])) {
    throw new BusinessRuleError(
      "Somente treinos em rascunho ou publicados sem feedback podem ser cancelados.",
    );
  }
  if (current.feedback) {
    throw new BusinessRuleError("Este treino já possui feedback e não pode ser cancelado.");
  }

  return prisma.$transaction(async (tx) => {
    const result = await tx.workout.updateMany({
      where: { id: workoutId, status: current.status },
      data: { status: "CANCELLED", lockVersion: { increment: 1 } },
    });
    if (result.count === 0) {
      throw new ConflictError("O treino mudou de estado. Recarregue e tente novamente.");
    }
    await recordAuditLog(tx, {
      action: "CANCEL_WORKOUT",
      entityName: "Workout",
      entityId: workoutId,
      userId: actor.userId,
      organizationId: actor.organizationId,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });
    return tx.workout.findUniqueOrThrow({ where: { id: workoutId } });
  });
}

// Archiving hides a workout from active views without deleting it. Allowed
// from any status except when it is already archived.
export async function archiveWorkout(workoutId: string, actor: WorkoutActor) {
  const current = await loadOwnedWorkout(workoutId, actor);
  if (current.status === "ARCHIVED") {
    return current;
  }

  return prisma.$transaction(async (tx) => {
    await tx.workout.update({
      where: { id: workoutId },
      data: { status: "ARCHIVED", lockVersion: { increment: 1 } },
    });
    await recordAuditLog(tx, {
      action: "ARCHIVE_WORKOUT",
      entityName: "Workout",
      entityId: workoutId,
      userId: actor.userId,
      organizationId: actor.organizationId,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });
    return tx.workout.findUniqueOrThrow({ where: { id: workoutId } });
  });
}
