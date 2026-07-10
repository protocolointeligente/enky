import { Prisma } from "@prisma/client";
import { recordAuditLog } from "@/domain/audit";
import { BusinessRuleError, ConflictError, NotFoundError } from "@/domain/errors";
import { prisma } from "@/infrastructure/database/prisma";
import { calculateSessionRpeLoad } from "./session-rpe";
import type { SubmitWorkoutFeedbackInput, UpdateWorkoutFeedbackInput } from "./feedback-schema";

export interface AthleteActor {
  userId: string;
  athleteProfileId: string;
  organizationId: string;
  ipAddress?: string;
  userAgent?: string;
}

const WORKOUT_STATUS_BY_COMPLETION = {
  COMPLETED: "COMPLETED",
  PARTIAL: "PARTIAL",
  MISSED: "MISSED",
} as const;

async function loadOwnedWorkout(workoutId: string, actor: AthleteActor) {
  const workout = await prisma.workout.findUnique({ where: { id: workoutId } });

  if (!workout || workout.organizationId !== actor.organizationId || workout.athleteId !== actor.athleteProfileId) {
    throw new NotFoundError("Treino não encontrado.");
  }

  return workout;
}

// Trainers never call this — the module boundary is athlete-only, which is
// why there is no `actor.trainerProfileId` overload here.
export async function submitWorkoutFeedback(workoutId: string, input: SubmitWorkoutFeedbackInput, actor: AthleteActor) {
  const workout = await loadOwnedWorkout(workoutId, actor);

  if (workout.status !== "PUBLISHED" && workout.status !== "IN_PROGRESS") {
    throw new BusinessRuleError("Feedback só pode ser enviado para treinos publicados.");
  }

  const existing = await prisma.workoutFeedback.findUnique({ where: { workoutId } });
  if (existing) {
    throw new ConflictError("Este treino já possui feedback. Utilize a atualização de feedback.");
  }

  const { loadStatus, sessionRpeLoad } = calculateSessionRpeLoad({
    completionStatus: input.completionStatus,
    actualDurationMinutes: input.actualDurationMinutes,
    sessionRpe: input.sessionRpe,
  });

  try {
    return await prisma.$transaction(async (tx) => {
      const feedback = await tx.workoutFeedback.create({
        data: {
          workoutId,
          actualDurationMinutes: input.actualDurationMinutes,
          actualDistanceKm: input.actualDistanceKm,
          sessionRpe: input.sessionRpe,
          sessionRpeLoad,
          loadStatus,
          completionSource: "ATHLETE_REPORTED",
          fatigueLevel: input.fatigueLevel,
          recoveryLevel: input.recoveryLevel,
          painLevel: input.painLevel,
          painLaterality: input.painLaterality,
          painRegion: input.painRegion,
          notes: input.notes,
        },
      });

      await tx.workout.update({
        where: { id: workoutId },
        data: { status: WORKOUT_STATUS_BY_COMPLETION[input.completionStatus] },
      });

      // Pain/fatigue/recovery levels and free-text notes are health-adjacent
      // data — only the fact that feedback was submitted goes into AuditLog,
      // never the field values themselves.
      await recordAuditLog(tx, {
        action: "SUBMIT_WORKOUT_FEEDBACK",
        entityName: "WorkoutFeedback",
        entityId: feedback.id,
        userId: actor.userId,
        organizationId: actor.organizationId,
        ipAddress: actor.ipAddress,
        userAgent: actor.userAgent,
      });

      return feedback;
    });
  } catch (error) {
    // WorkoutFeedback.workoutId is unique — two concurrent submissions can
    // both pass the `existing` check above and race to create(); the loser
    // hits this constraint instead of the check, and must surface the same
    // ConflictError rather than a raw Prisma error.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new ConflictError("Este treino já possui feedback. Utilize a atualização de feedback.");
    }
    throw error;
  }
}

export async function updateWorkoutFeedback(workoutId: string, input: UpdateWorkoutFeedbackInput, actor: AthleteActor) {
  await loadOwnedWorkout(workoutId, actor);

  const existing = await prisma.workoutFeedback.findUnique({ where: { workoutId } });
  if (!existing) {
    throw new NotFoundError("Feedback não encontrado para este treino.");
  }

  const { loadStatus, sessionRpeLoad } = calculateSessionRpeLoad({
    completionStatus: input.completionStatus,
    actualDurationMinutes: input.actualDurationMinutes,
    sessionRpe: input.sessionRpe,
  });

  return prisma.$transaction(async (tx) => {
    // WorkoutFeedback has no lockVersion column, so optimistic locking uses
    // the caller's last-known updatedAt as the compare-and-swap condition.
    const result = await tx.workoutFeedback.updateMany({
      where: { workoutId, updatedAt: new Date(input.knownUpdatedAt) },
      data: {
        actualDurationMinutes: input.actualDurationMinutes,
        actualDistanceKm: input.actualDistanceKm,
        sessionRpe: input.sessionRpe,
        sessionRpeLoad,
        loadStatus,
        fatigueLevel: input.fatigueLevel,
        recoveryLevel: input.recoveryLevel,
        painLevel: input.painLevel,
        painLaterality: input.painLaterality,
        painRegion: input.painRegion,
        notes: input.notes,
      },
    });

    if (result.count === 0) {
      throw new ConflictError("O feedback foi modificado por outra pessoa. Recarregue e tente novamente.");
    }

    await tx.workout.update({
      where: { id: workoutId },
      data: { status: WORKOUT_STATUS_BY_COMPLETION[input.completionStatus] },
    });

    await recordAuditLog(tx, {
      action: "UPDATE_WORKOUT_FEEDBACK",
      entityName: "WorkoutFeedback",
      entityId: existing.id,
      userId: actor.userId,
      organizationId: actor.organizationId,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    return tx.workoutFeedback.findUniqueOrThrow({ where: { workoutId } });
  });
}
