import { recordAuditLog } from "@/domain/audit";
import { BusinessRuleError, ConflictError, NotFoundError } from "@/domain/errors";
import { prisma } from "@/infrastructure/database/prisma";
import type { WorkoutActor } from "./create-workout-draft";

export interface MoveWorkoutInput {
  plannedDate: string; // yyyy-mm-dd
}

// Only DRAFT and PUBLISHED workouts can be rescheduled, and a PUBLISHED one
// only while it has no feedback (§3). Anything the athlete already responded
// to, or any completed/terminal state, is frozen — a moved date would
// silently rewrite history the athlete acted on.
const MOVABLE_STATUSES = ["DRAFT", "PUBLISHED"] as const;

export async function moveWorkout(workoutId: string, input: MoveWorkoutInput, actor: WorkoutActor) {
  const current = await prisma.workout.findUnique({
    where: { id: workoutId },
    include: { feedback: { select: { id: true } } },
  });

  // Cross-tenant / cross-trainer access is reported as 404 — never confirm a
  // workout exists in a tenant the caller can't see.
  if (
    !current ||
    current.organizationId !== actor.organizationId ||
    current.trainerId !== actor.trainerProfileId
  ) {
    throw new NotFoundError("Treino não encontrado.");
  }

  if (!MOVABLE_STATUSES.includes(current.status as (typeof MOVABLE_STATUSES)[number])) {
    throw new BusinessRuleError(
      "Somente treinos em rascunho ou publicados sem feedback podem ser movidos.",
    );
  }
  if (current.feedback) {
    throw new BusinessRuleError("Este treino já possui feedback e não pode ser movido.");
  }

  const newPlannedDate = new Date(`${input.plannedDate}T00:00:00.000Z`);
  const oldPlannedDate = new Date(
    `${current.plannedDate.toISOString().slice(0, 10)}T00:00:00.000Z`,
  );
  const deltaMs = newPlannedDate.getTime() - oldPlannedDate.getTime();

  // Shift the planned start/end by the whole-day delta so the time-of-day and
  // duration are preserved on the new date.
  const newStartAt = current.plannedStartAt
    ? new Date(current.plannedStartAt.getTime() + deltaMs)
    : null;
  const newEndAt = current.plannedEndAt ? new Date(current.plannedEndAt.getTime() + deltaMs) : null;

  return prisma.$transaction(async (tx) => {
    // Conditional on the status we validated — a concurrent publish/feedback
    // that changed the status makes this match zero rows.
    const result = await tx.workout.updateMany({
      where: { id: workoutId, status: current.status },
      data: {
        plannedDate: newPlannedDate,
        plannedStartAt: newStartAt,
        plannedEndAt: newEndAt,
        lockVersion: { increment: 1 },
      },
    });

    if (result.count === 0) {
      throw new ConflictError(
        "O treino mudou de estado. Recarregue o calendário e tente novamente.",
      );
    }

    await recordAuditLog(tx, {
      action: "MOVE_WORKOUT",
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
