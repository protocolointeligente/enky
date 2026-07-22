import { recordAuditLog } from "@/domain/audit";
import { ConflictError, NotFoundError } from "@/domain/errors";
import { prisma } from "@/infrastructure/database/prisma";
import { requireTrainerAccessToAthlete } from "@/server/auth/guards";
import { persistWorkoutBlocks } from "./persist-blocks";
import type { UpdateWorkoutDraftInput } from "./prescription-schema";
import type { WorkoutActor } from "./create-workout-draft";

export async function updateWorkoutDraft(
  workoutId: string,
  input: UpdateWorkoutDraftInput,
  actor: WorkoutActor,
) {
  const current = await prisma.workout.findUnique({ where: { id: workoutId } });

  // Cross-organization/cross-trainer access is reported as 404, not 403 —
  // never confirm that a workout exists in a tenant the caller can't see.
  if (
    !current ||
    current.organizationId !== actor.organizationId ||
    current.trainerId !== actor.trainerProfileId
  ) {
    throw new NotFoundError("Treino não encontrado.");
  }
  if (current.status !== "DRAFT") {
    throw new ConflictError("Somente treinos em rascunho podem ser editados.");
  }
  if (input.athleteId !== current.athleteId) {
    await requireTrainerAccessToAthlete(
      actor.organizationId,
      actor.trainerProfileId,
      input.athleteId,
    );
  }

  return prisma.$transaction(async (tx) => {
    // Optimistic locking: the write only succeeds if lockVersion still
    // matches what the client last read. `source`/`workoutTemplateId` are
    // never part of this input, so a template-derived workout keeps them
    // untouched, exactly as required.
    const result = await tx.workout.updateMany({
      where: { id: workoutId, lockVersion: input.lockVersion },
      data: {
        athleteId: input.athleteId,
        title: input.title,
        description: input.description,
        modality: input.modality,
        plannedDate: new Date(input.plannedDate),
        plannedStartAt: input.plannedStartAt ? new Date(input.plannedStartAt) : null,
        plannedEndAt: input.plannedEndAt ? new Date(input.plannedEndAt) : null,
        timezone: input.timezone,
        lockVersion: { increment: 1 },
        // Marca que a mão do treinador passou por aqui. É isto que protege o
        // treino de ser descartado numa regeração da semana
        // (modules/periodization/generate-week.ts só apaga rascunhos gerados e
        // NÃO tocados). Sem esta marca, editar e regerar perderia o trabalho.
        trainerModified: true,
        trainerModifiedAt: new Date(),
        trainerModifiedBy: actor.userId,
      },
    });

    if (result.count === 0) {
      throw new ConflictError(
        "O treino foi modificado por outra pessoa. Recarregue e tente novamente.",
      );
    }

    // WorkoutBlock has onDelete: Cascade from Workout; WorkoutExercise/
    // WorkoutStep cascade from WorkoutBlock — deleting the blocks removes
    // every child row too, no orphans left behind.
    await tx.workoutBlock.deleteMany({ where: { workoutId } });
    await persistWorkoutBlocks(tx, workoutId, actor.organizationId, input.blocks);

    await recordAuditLog(tx, {
      action: "UPDATE_WORKOUT_DRAFT",
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
