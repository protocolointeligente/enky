import { NotFoundError } from "@/domain/errors";
import { prisma } from "@/infrastructure/database/prisma";
import { requireTrainerAccessToAthlete } from "@/server/auth/guards";

export interface TrainerScope {
  organizationId: string;
  trainerProfileId: string;
}

const workoutDetailInclude = {
  blocks: {
    orderBy: { sequence: "asc" as const },
    include: {
      steps: { orderBy: { sequence: "asc" as const } },
      exercises: {
        orderBy: { sequence: "asc" as const },
        include: { exercise: { select: { name: true, category: true, videoUrl: true } } },
      },
    },
  },
  feedback: true,
  athlete: { select: { id: true, userId: true } },
};

export async function getTrainerWorkout(workoutId: string, actor: TrainerScope) {
  const workout = await prisma.workout.findUnique({
    where: { id: workoutId },
    include: workoutDetailInclude,
  });

  if (!workout || workout.organizationId !== actor.organizationId || workout.trainerId !== actor.trainerProfileId) {
    throw new NotFoundError("Treino não encontrado.");
  }

  return workout;
}

export async function listTrainerAthleteWorkouts(actor: TrainerScope, filters: { athleteId?: string } = {}) {
  if (filters.athleteId) {
    await requireTrainerAccessToAthlete(actor.organizationId, actor.trainerProfileId, filters.athleteId);
  }

  return prisma.workout.findMany({
    where: {
      organizationId: actor.organizationId,
      trainerId: actor.trainerProfileId,
      ...(filters.athleteId ? { athleteId: filters.athleteId } : {}),
    },
    orderBy: { plannedDate: "desc" },
    include: { feedback: { select: { id: true, loadStatus: true, painLevel: true } } },
  });
}
