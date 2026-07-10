import type { Prisma } from "@prisma/client";
import type { WorkoutBlockInput } from "./prescription-schema";

async function upsertExercise(
  tx: Prisma.TransactionClient,
  organizationId: string,
  name: string,
  category: string,
) {
  return tx.exercise.upsert({
    where: { name_organizationId: { name, organizationId } },
    update: {},
    create: { name, category, organizationId, targetMuscles: [] },
  });
}

// Shared by createWorkoutDraft and updateWorkoutDraft — the only place
// that turns the canonical prescription shape into WorkoutBlock/
// WorkoutStep/WorkoutExercise rows. Sequence is derived from array
// position, never trusted from the client.
export async function persistWorkoutBlocks(
  tx: Prisma.TransactionClient,
  workoutId: string,
  organizationId: string,
  blocks: WorkoutBlockInput[],
): Promise<void> {
  for (const [blockIndex, block] of blocks.entries()) {
    const createdBlock = await tx.workoutBlock.create({
      data: {
        workoutId,
        sequence: blockIndex + 1,
        name: block.name,
        repetitions: block.repetitions,
      },
    });

    for (const [stepIndex, step] of block.steps.entries()) {
      await tx.workoutStep.create({
        data: { ...step, workoutBlockId: createdBlock.id, sequence: stepIndex + 1 },
      });
    }

    for (const [exerciseIndex, exercise] of block.exercises.entries()) {
      const exerciseRecord = await upsertExercise(
        tx,
        organizationId,
        exercise.exerciseName,
        exercise.exerciseCategory,
      );
      await tx.workoutExercise.create({
        data: {
          workoutBlockId: createdBlock.id,
          sequence: exerciseIndex + 1,
          exerciseId: exerciseRecord.id,
          sets: exercise.sets,
          reps: exercise.reps,
          durationSeconds: exercise.durationSeconds,
          loadKg: exercise.loadKg,
          rir: exercise.rir,
          rpeTarget: exercise.rpeTarget,
          restSeconds: exercise.restSeconds,
          notes: exercise.notes,
        },
      });
    }
  }
}
