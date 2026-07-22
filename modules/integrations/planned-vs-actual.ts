import type { ActivityMatchStatus, Modality, WorkoutStatus } from "@prisma/client";
import { prisma } from "@/infrastructure/database/prisma";
import { MATCHABLE_WORKOUT_STATUSES } from "./match-activity";

// Planejado × Realizado — a leitura que fecha o critério de aceite da fase
// ("treinador visualiza planejado versus realizado").
//
// O que esta consulta NÃO faz, de propósito: não julga. Não devolve "aderência
// 87%", não classifica a sessão como cumprida ou não, não calcula desvio
// percentual. Ela devolve os dois lados e a diferença crua; quem interpreta é
// o treinador. Transformar "planejou 10km, correu 9,4km" num veredito exige
// saber a intenção da sessão — e o sistema não sabe. O motor de atenção
// (modules/intelligence) é onde interpretação mora, e ele consome feedback e
// carga, não isto.

export interface ActualView {
  id: string;
  name: string | null;
  rawType: string;
  modality: Modality | null;
  startedAt: string;
  localDate: string;
  distanceMeters: number | null;
  movingSeconds: number | null;
  elevationGainMeters: number | null;
  paceSecondsPerKm: number | null;
  matchStatus: ActivityMatchStatus;
}

export interface PlannedVsActualRow {
  workout: {
    id: string;
    title: string;
    modality: Modality;
    status: WorkoutStatus;
    plannedDate: string;
  };
  actual: ActualView | null;
}

export interface PlannedVsActualView {
  rows: PlannedVsActualRow[];
  // Atividades realizadas SEM treino planejado correspondente. Não são ruído a
  // esconder: é o atleta treinando fora do plano (ou um vínculo que a máquina
  // não soube fazer, `AMBIGUOUS`). Some volume real que o treinador precisa ver
  // — omitir mostraria uma semana mais leve do que a que ele de fato teve.
  unplanned: ActualView[];
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function toActualView(activity: {
  id: string;
  name: string | null;
  rawType: string;
  modality: Modality | null;
  startedAt: Date;
  localDate: Date;
  distanceMeters: number | null;
  movingSeconds: number | null;
  elevationGainMeters: number | null;
  paceSecondsPerKm: number | null;
  matchStatus: ActivityMatchStatus;
}): ActualView {
  return {
    id: activity.id,
    name: activity.name,
    rawType: activity.rawType,
    modality: activity.modality,
    startedAt: activity.startedAt.toISOString(),
    localDate: toIsoDate(activity.localDate),
    distanceMeters: activity.distanceMeters,
    movingSeconds: activity.movingSeconds,
    elevationGainMeters: activity.elevationGainMeters,
    paceSecondsPerKm: activity.paceSecondsPerKm,
    matchStatus: activity.matchStatus,
  };
}

// O chamador é responsável por já ter provado o acesso do treinador ao atleta
// (`requireTrainerAccessToAthlete`) — este módulo não é uma fronteira de
// autorização, e por isso a rota escopa por `organizationId` aqui também.
export async function getPlannedVsActual(
  organizationId: string,
  athleteProfileId: string,
  from: Date,
  to: Date,
): Promise<PlannedVsActualView> {
  const [workouts, activities] = await Promise.all([
    prisma.workout.findMany({
      where: {
        organizationId,
        athleteId: athleteProfileId,
        plannedDate: { gte: from, lte: to },
        status: { in: [...MATCHABLE_WORKOUT_STATUSES] },
      },
      select: {
        id: true,
        title: true,
        modality: true,
        status: true,
        plannedDate: true,
        externalActivity: true,
      },
      orderBy: { plannedDate: "asc" },
    }),
    prisma.externalActivity.findMany({
      where: {
        organizationId,
        athleteId: athleteProfileId,
        localDate: { gte: from, lte: to },
        workoutId: null,
      },
      orderBy: { startedAt: "asc" },
    }),
  ]);

  return {
    rows: workouts.map((workout) => ({
      workout: {
        id: workout.id,
        title: workout.title,
        modality: workout.modality,
        status: workout.status,
        plannedDate: toIsoDate(workout.plannedDate),
      },
      actual: workout.externalActivity ? toActualView(workout.externalActivity) : null,
    })),
    unplanned: activities.map(toActualView),
  };
}

// Atividades do atleta (a visão dele próprio, em /atleta/integracoes).
export async function listAthleteActivities(
  athleteProfileId: string,
  limit = 30,
): Promise<ActualView[]> {
  const activities = await prisma.externalActivity.findMany({
    where: { athleteId: athleteProfileId },
    orderBy: { startedAt: "desc" },
    take: limit,
  });
  return activities.map(toActualView);
}
