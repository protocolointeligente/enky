import { NotFoundError } from "@/domain/errors";
import { prisma } from "@/infrastructure/database/prisma";

export interface TrainerScope {
  organizationId: string;
  trainerProfileId: string;
}

export async function getTrainerWorkoutFeedback(workoutId: string, actor: TrainerScope) {
  const workout = await prisma.workout.findUnique({
    where: { id: workoutId },
    include: { feedback: true },
  });

  if (!workout || workout.organizationId !== actor.organizationId || workout.trainerId !== actor.trainerProfileId) {
    throw new NotFoundError("Treino não encontrado.");
  }
  if (!workout.feedback) {
    throw new NotFoundError("O atleta ainda não enviou feedback para este treino.");
  }

  return workout.feedback;
}
