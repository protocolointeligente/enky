import { Prisma } from "@prisma/client";
import type { WorkoutBlockInput } from "./prescription-schema";

// Canonical Prisma include for reading a workout's full content tree. Used
// wherever we need to re-materialize blocks/steps/exercises into the
// canonical input shape (duplication, "save as template", "apply template").
export const workoutContentInclude = {
  blocks: {
    orderBy: { sequence: "asc" as const },
    include: {
      steps: { orderBy: { sequence: "asc" as const } },
      exercises: {
        orderBy: { sequence: "asc" as const },
        include: { exercise: { select: { name: true, category: true } } },
      },
    },
  },
} as const;

type WorkoutWithContent = Prisma.WorkoutGetPayload<{ include: typeof workoutContentInclude }>;
type PersistedBlocks = WorkoutWithContent["blocks"];

function decToNum(value: Prisma.Decimal | null): number | undefined {
  return value == null ? undefined : value.toNumber();
}

function nullToUndef<T>(value: T | null): T | undefined {
  return value == null ? undefined : value;
}

// Maps the persisted block/step/exercise rows back to the canonical
// WorkoutBlockInput[] that persistWorkoutBlocks / prescription-schema expect.
// Sequence is intentionally dropped — it is re-derived from array order on
// the next persist, exactly like a fresh prescription.
export function workoutBlocksToInput(blocks: PersistedBlocks): WorkoutBlockInput[] {
  return blocks.map((block) => ({
    name: nullToUndef(block.name),
    repetitions: block.repetitions,
    steps: block.steps.map((step) => ({
      stepType: step.stepType,
      repetitions: nullToUndef(step.repetitions),
      durationSeconds: nullToUndef(step.durationSeconds),
      distanceMeters: nullToUndef(step.distanceMeters),
      targetType: nullToUndef(step.targetType),
      targetMin: decToNum(step.targetMin),
      targetMax: decToNum(step.targetMax),
      recoverySeconds: nullToUndef(step.recoverySeconds),
      recoveryMeters: nullToUndef(step.recoveryMeters),
    })),
    exercises: block.exercises.map((exercise) => ({
      exerciseName: exercise.exercise.name,
      exerciseCategory: exercise.exercise.category,
      sets: exercise.sets,
      reps: nullToUndef(exercise.reps),
      durationSeconds: nullToUndef(exercise.durationSeconds),
      loadKg: decToNum(exercise.loadKg),
      rir: nullToUndef(exercise.rir),
      rpeTarget: nullToUndef(exercise.rpeTarget),
      restSeconds: nullToUndef(exercise.restSeconds),
      notes: nullToUndef(exercise.notes),
    })),
  }));
}
