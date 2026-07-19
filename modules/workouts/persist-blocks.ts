import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import type { WorkoutBlockInput } from "./prescription-schema";

async function upsertExercise(
  tx: Prisma.TransactionClient,
  organizationId: string,
  name: string,
  category: string,
): Promise<{ id: string }> {
  // O banco tem um índice único NATIVO sobre LOWER(name) por org (migration
  // 20260710104346), mas o `@@unique([name, organizationId])` do Prisma é
  // sensível a caixa. Um upsert por nome exato NÃO enxerga um exercício já
  // existente com caixa diferente (ex.: a biblioteca importada usa "Agachamento
  // Livre" e o gerador pede "Agachamento livre") — o create então viola o índice
  // LOWER(name) (P2002) e, dentro de uma transação, envenena a transação inteira.
  // Por isso: busca case-insensitive PRIMEIRO e só cria se realmente não houver.
  const existing = await tx.exercise.findFirst({
    where: { organizationId, name: { equals: name, mode: "insensitive" } },
    select: { id: true },
  });
  if (existing) return existing;

  return tx.exercise.create({
    data: { name, category, organizationId, targetMuscles: [] },
    select: { id: true },
  });
}

export interface WorkoutBlocksItem {
  workoutId: string;
  blocks: WorkoutBlockInput[];
}

// Persiste os blocos de VÁRIOS treinos de uma vez. A versão ingênua (um
// create por bloco, por step e por exercício) custa uma ida ao banco por
// linha: numa semana isso já pressiona o teto da transação, e num ciclo
// inteiro (~12 semanas) estoura com folga. Aqui é 3 createMany no total,
// independente de quantos treinos entram — os ids dos blocos são gerados
// no processo justamente para que steps e exercícios possam referenciá-los
// sem precisar do retorno do banco.
export async function persistManyWorkoutBlocks(
  tx: Prisma.TransactionClient,
  organizationId: string,
  items: WorkoutBlocksItem[],
): Promise<void> {
  // Exercícios ainda vão um a um — upsert não tem forma batelada — mas
  // deduplicados por nome em TODO o lote: um ciclo inteiro de força repete
  // "Agachamento livre" dezenas de vezes e agora ele é upsertado uma vez só.
  const wanted = new Map<string, string>(); // nome -> categoria
  for (const item of items) {
    for (const block of item.blocks) {
      for (const exercise of block.exercises) {
        if (!wanted.has(exercise.exerciseName)) {
          wanted.set(exercise.exerciseName, exercise.exerciseCategory);
        }
      }
    }
  }

  const exerciseIdByName = new Map<string, string>();
  for (const [name, category] of wanted) {
    const row = await upsertExercise(tx, organizationId, name, category);
    exerciseIdByName.set(name, row.id);
  }

  const blockRows: Prisma.WorkoutBlockCreateManyInput[] = [];
  const stepRows: Prisma.WorkoutStepCreateManyInput[] = [];
  const exerciseRows: Prisma.WorkoutExerciseCreateManyInput[] = [];

  for (const item of items) {
    for (const [blockIndex, block] of item.blocks.entries()) {
      const blockId = randomUUID();
      blockRows.push({
        id: blockId,
        workoutId: item.workoutId,
        sequence: blockIndex + 1,
        name: block.name,
        repetitions: block.repetitions,
      });

      for (const [stepIndex, step] of block.steps.entries()) {
        stepRows.push({
          ...step,
          // metadata é JSON no banco — o objeto validado por Zod entra como tal.
          metadata: (step.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
          workoutBlockId: blockId,
          sequence: stepIndex + 1,
        });
      }

      for (const [exerciseIndex, exercise] of block.exercises.entries()) {
        const exerciseId = exerciseIdByName.get(exercise.exerciseName);
        if (!exerciseId) continue; // inalcançável: o mapa cobre todo nome visto acima
        exerciseRows.push({
          workoutBlockId: blockId,
          sequence: exerciseIndex + 1,
          exerciseId,
          sets: exercise.sets,
          reps: exercise.reps,
          durationSeconds: exercise.durationSeconds,
          loadKg: exercise.loadKg,
          rir: exercise.rir,
          rpeTarget: exercise.rpeTarget,
          restSeconds: exercise.restSeconds,
          notes: exercise.notes,
          metadata: (exercise.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
        });
      }
    }
  }

  // Ordem importa: steps/exercícios referenciam os blocos por FK.
  if (blockRows.length > 0) await tx.workoutBlock.createMany({ data: blockRows });
  if (stepRows.length > 0) await tx.workoutStep.createMany({ data: stepRows });
  if (exerciseRows.length > 0) await tx.workoutExercise.createMany({ data: exerciseRows });
}

// Shared by createWorkoutDraft, updateWorkoutDraft, copyWeekWorkouts and the
// periodization engine — the only place that turns the canonical prescription
// shape into WorkoutBlock/WorkoutStep/WorkoutExercise rows. Sequence is
// derived from array position, never trusted from the client.
export async function persistWorkoutBlocks(
  tx: Prisma.TransactionClient,
  workoutId: string,
  organizationId: string,
  blocks: WorkoutBlockInput[],
): Promise<void> {
  await persistManyWorkoutBlocks(tx, organizationId, [{ workoutId, blocks }]);
}
