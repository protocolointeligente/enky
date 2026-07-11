import { prisma } from "@/infrastructure/database/prisma";
import type { IntelligenceActor } from "./attention";
import type { Insight } from "./insight";
import { interpretFeedback } from "./interpret-feedback";

// Interpreta o feedback de UM treino, no escopo do treinador (tenant isolation).
// Devolve null quando o treino não é dele ou ainda não tem feedback.
export async function analyzeWorkoutFeedback(
  workoutId: string,
  actor: IntelligenceActor,
): Promise<Insight | null> {
  const workout = await prisma.workout.findFirst({
    where: {
      id: workoutId,
      organizationId: actor.organizationId,
      trainerId: actor.trainerProfileId,
    },
    select: {
      athleteId: true,
      status: true,
      plannedStartAt: true,
      plannedEndAt: true,
      athlete: { select: { user: { select: { name: true } } } },
      feedback: {
        select: {
          actualDurationMinutes: true,
          sessionRpe: true,
          sessionRpeLoad: true,
          loadStatus: true,
          fatigueLevel: true,
          recoveryLevel: true,
          painLevel: true,
          painRegion: true,
        },
      },
    },
  });
  if (!workout || !workout.feedback) return null;

  const plannedDurationMinutes =
    workout.plannedStartAt && workout.plannedEndAt
      ? Math.round((workout.plannedEndAt.getTime() - workout.plannedStartAt.getTime()) / 60000)
      : null;

  const f = workout.feedback;
  return interpretFeedback({
    athleteId: workout.athleteId,
    athleteName: workout.athlete.user?.name ?? null,
    status: workout.status,
    plannedDurationMinutes,
    feedback: {
      actualDurationMinutes: f.actualDurationMinutes,
      sessionRpe: f.sessionRpe,
      sessionRpeLoad: f.sessionRpeLoad != null ? String(f.sessionRpeLoad) : null,
      loadStatus: f.loadStatus,
      fatigueLevel: f.fatigueLevel,
      recoveryLevel: f.recoveryLevel,
      painLevel: f.painLevel,
      painRegion: f.painRegion,
    },
  });
}
