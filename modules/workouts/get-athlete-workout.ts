import { NotFoundError } from "@/domain/errors";
import { prisma } from "@/infrastructure/database/prisma";

export interface AthleteScope {
  organizationId: string;
  athleteProfileId: string;
}

// DRAFT/IN_PROGRESS are never athlete-visible: a draft is still being
// authored by the trainer, and IN_PROGRESS only exists transiently between
// an athlete starting a session and submitting feedback for it.
const ATHLETE_VISIBLE_STATUSES = ["PUBLISHED", "COMPLETED", "PARTIAL", "MISSED", "ARCHIVED", "CANCELLED"] as const;

const workoutDetailSelect = {
  id: true,
  title: true,
  description: true,
  modality: true,
  status: true,
  source: true,
  plannedDate: true,
  plannedStartAt: true,
  plannedEndAt: true,
  timezone: true,
  createdAt: true,
  updatedAt: true,
  blocks: {
    orderBy: { sequence: "asc" as const },
    select: {
      id: true,
      sequence: true,
      name: true,
      repetitions: true,
      steps: {
        orderBy: { sequence: "asc" as const },
        select: {
          id: true,
          sequence: true,
          stepType: true,
          repetitions: true,
          durationSeconds: true,
          distanceMeters: true,
          targetType: true,
          targetMin: true,
          targetMax: true,
          recoverySeconds: true,
          recoveryMeters: true,
        },
      },
      exercises: {
        orderBy: { sequence: "asc" as const },
        select: {
          id: true,
          sequence: true,
          sets: true,
          reps: true,
          durationSeconds: true,
          loadKg: true,
          rir: true,
          rpeTarget: true,
          restSeconds: true,
          notes: true,
          exercise: { select: { name: true, category: true, videoUrl: true } },
        },
      },
    },
  },
  feedback: true,
};

export async function getAthleteWorkout(workoutId: string, actor: AthleteScope) {
  const workout = await prisma.workout.findUnique({
    where: { id: workoutId },
    select: { ...workoutDetailSelect, organizationId: true, athleteId: true },
  });

  if (
    !workout ||
    workout.organizationId !== actor.organizationId ||
    workout.athleteId !== actor.athleteProfileId ||
    !ATHLETE_VISIBLE_STATUSES.includes(workout.status as (typeof ATHLETE_VISIBLE_STATUSES)[number])
  ) {
    throw new NotFoundError("Treino não encontrado.");
  }

  return workout;
}

export async function listAthleteWorkouts(actor: AthleteScope) {
  return prisma.workout.findMany({
    where: {
      organizationId: actor.organizationId,
      athleteId: actor.athleteProfileId,
      status: { in: [...ATHLETE_VISIBLE_STATUSES] },
    },
    orderBy: { plannedDate: "desc" },
    select: {
      id: true,
      title: true,
      modality: true,
      status: true,
      plannedDate: true,
      plannedStartAt: true,
      feedback: { select: { id: true, loadStatus: true } },
    },
  });
}
