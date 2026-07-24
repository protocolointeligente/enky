import { NotFoundError } from "@/domain/errors";
import { prisma } from "@/infrastructure/database/prisma";
import type { PeriodizationActor } from "@/modules/periodization/periodization-service";
import type { Modality } from "@/modules/periodization/generation-rules";
import { analyzeWeek, type WeekAnalysis, type WeekSessionInput } from "./week-analysis";
import { estimateWorkoutLoad } from "./estimate-workout-load";

// Recálculo da semana sobre os treinos DE VERDADE (Fase 4 ligada ao editor). Lê
// os treinos agendados numa TrainingWeek, usa o sRPE REAL quando o atleta já
// executou e ESTIMA a carga a partir da prescrição quando é só planejado, e
// devolve a análise da semana (carga, polarização, equilíbrio, alertas). Só
// leitura — não grava. O alerta de salto compara com a semana anterior.

const WORKOUT_SELECT = {
  modality: true,
  feedback: { select: { sessionRpeLoad: true } },
  blocks: {
    select: {
      repetitions: true,
      steps: {
        select: {
          stepType: true,
          repetitions: true,
          durationSeconds: true,
          distanceMeters: true,
          targetType: true,
          targetMin: true,
          targetMax: true,
        },
      },
      exercises: {
        select: { sets: true, reps: true, durationSeconds: true, rpeTarget: true, rir: true },
      },
    },
  },
} as const;

type WorkoutRow = {
  modality: Modality;
  feedback: { sessionRpeLoad: unknown } | null;
  blocks: {
    repetitions: number | null;
    steps: {
      stepType: string;
      repetitions: number | null;
      durationSeconds: number | null;
      distanceMeters: number | null;
      targetType: string | null;
      targetMin: unknown;
      targetMax: unknown;
    }[];
    exercises: {
      sets: number;
      reps: number | null;
      durationSeconds: number | null;
      rpeTarget: number | null;
      rir: number | null;
    }[];
  }[];
};

function num(value: unknown): number | null {
  return value == null ? null : Number(value);
}

// Um treino → uma entrada de análise. Usa o sRPE real quando existe; senão
// estima. Devolve também se a carga foi estimada (a UI avisa).
function toSession(w: WorkoutRow): { session: WeekSessionInput; estimated: boolean } {
  const est = estimateWorkoutLoad({
    modality: w.modality,
    blocks: w.blocks.map((b) => ({
      repetitions: b.repetitions,
      steps: b.steps.map((s) => ({
        stepType: s.stepType,
        repetitions: s.repetitions,
        durationSeconds: s.durationSeconds,
        distanceMeters: s.distanceMeters,
        targetType: s.targetType,
        targetMin: num(s.targetMin),
        targetMax: num(s.targetMax),
      })),
      exercises: b.exercises,
    })),
  });

  const realLoad = num(w.feedback?.sessionRpeLoad);
  const estimated = realLoad == null;
  return {
    session: {
      modality: w.modality,
      kind: est.kind,
      load: realLoad ?? est.load,
      volumeKm: est.volumeKm ?? undefined,
    },
    estimated,
  };
}

export interface TrainingWeekAnalysis {
  weekSequence: number;
  workoutCount: number;
  /** Alguma carga foi estimada da prescrição (treino ainda não executado). */
  anyEstimated: boolean;
  analysis: WeekAnalysis;
}

export async function analyzeTrainingWeek(
  periodizationId: string,
  weekId: string,
  actor: PeriodizationActor,
): Promise<TrainingWeekAnalysis> {
  const periodization = await prisma.periodization.findUnique({
    where: { id: periodizationId },
    select: { id: true, organizationId: true, trainerId: true },
  });
  if (
    !periodization ||
    periodization.organizationId !== actor.organizationId ||
    periodization.trainerId !== actor.trainerProfileId
  ) {
    throw new NotFoundError("Periodização não encontrada.");
  }

  const week = await prisma.trainingWeek.findUnique({
    where: { id: weekId },
    select: { id: true, periodizationId: true, sequence: true },
  });
  if (!week || week.periodizationId !== periodizationId) {
    throw new NotFoundError("Semana não encontrada.");
  }

  const workouts = (await prisma.workout.findMany({
    where: { trainingWeekId: weekId, organizationId: actor.organizationId },
    select: WORKOUT_SELECT,
  })) as unknown as WorkoutRow[];

  const mapped = workouts.map(toSession);
  const sessions = mapped.map((m) => m.session);

  // Semana anterior (para o alerta de salto de carga), se existir.
  let prevWeekLoad: number | undefined;
  const prevWeek = await prisma.trainingWeek.findFirst({
    where: { periodizationId, sequence: week.sequence - 1 },
    select: { id: true },
  });
  if (prevWeek) {
    const prevWorkouts = (await prisma.workout.findMany({
      where: { trainingWeekId: prevWeek.id, organizationId: actor.organizationId },
      select: WORKOUT_SELECT,
    })) as unknown as WorkoutRow[];
    if (prevWorkouts.length > 0) {
      prevWeekLoad = prevWorkouts
        .map(toSession)
        .reduce((sum, m) => sum + m.session.load, 0);
    }
  }

  return {
    weekSequence: week.sequence,
    workoutCount: workouts.length,
    anyEstimated: mapped.some((m) => m.estimated),
    analysis: analyzeWeek(sessions, prevWeekLoad),
  };
}
