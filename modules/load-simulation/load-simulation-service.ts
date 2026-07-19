import { prisma } from "@/infrastructure/database/prisma";
import { ValidationError } from "@/domain/errors";
import { requireTrainerAccessToAthlete } from "@/server/auth/guards";
import { ComputationCache, stableKey } from "@/server/cache/computation-cache";
import { buildMacrocycle, toWeekContexts } from "@/modules/periodization-engine/build-macrocycle";
import {
  type StrategyInput,
  toStrategicInputs,
} from "@/modules/periodization-engine/strategy-input-schema";
import type { PeriodizationActor } from "@/modules/periodization/periodization-service";
import { planWeek } from "@/modules/periodization/generation-rules";
import { enrichWeekPlan } from "@/modules/session-generator/enrich-week";
import { projectLoad, type LoadSimulation, type ProposedLoad } from "./simulate-load";

// Serviço da SIMULAÇÃO de carga (Fase 6) — "simular antes de salvar". Junta as
// três fases anteriores: monta o macrociclo (Fase 1), enriquece cada semana para
// obter a carga prevista por sessão (Fase 2/3) e projeta CTL/ATL/TSB por cima do
// histórico real do atleta (load-state). NÃO grava — é uma projeção para decidir.

const LOAD_WINDOW_DAYS = 42; // mesma janela do load-state para semear o CTL.

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Série diária de carga interna (sRPE) do atleta na janela — zero nos dias sem
 *  treino, idêntica à que o load-state consome. */
async function historyDailyLoad(
  organizationId: string,
  athleteId: string,
  now: Date,
): Promise<number[]> {
  const since = new Date(now);
  since.setDate(since.getDate() - LOAD_WINDOW_DAYS);

  const workouts = await prisma.workout.findMany({
    where: { organizationId, athleteId, plannedDate: { gte: since, lte: now } },
    orderBy: { plannedDate: "asc" },
    select: { plannedDate: true, feedback: { select: { sessionRpeLoad: true } } },
  });

  const loadByDay = new Map<string, number>();
  for (const w of workouts) {
    const load = w.feedback?.sessionRpeLoad != null ? Number(w.feedback.sessionRpeLoad) : null;
    if (load != null) {
      const day = isoDay(w.plannedDate);
      loadByDay.set(day, (loadByDay.get(day) ?? 0) + load);
    }
  }

  const out: number[] = [];
  const cursor = new Date(since);
  cursor.setUTCHours(0, 0, 0, 0);
  const stop = new Date(now);
  stop.setUTCHours(0, 0, 0, 0);
  while (cursor <= stop) {
    out.push(loadByDay.get(isoDay(cursor)) ?? 0);
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

export interface StrategySimulation {
  simulation: LoadSimulation;
  confidence: "LOW" | "MODERATE" | "HIGH";
  /** Volume total planejado (km) — o "novo volume" do plano (endurance). */
  totalVolumeKm: number | null;
  /** Nº de dias de histórico com carga registrada — qualidade do ponto de partida. */
  historyDays: number;
}

// A parte PURA e cara da simulação: montar o macrociclo e enriquecer TODAS as
// semanas para obter a carga prevista por sessão. É função só da entrada — logo,
// memoizável (Fase 9). O histórico do atleta (que muda) fica FORA e é lido a
// cada chamada. Cache por instância, efêmero, limitado e com TTL.
interface ProposedPlan {
  proposed: ProposedLoad[];
  totalVolumeKm: number | null;
  confidence: "LOW" | "MODERATE" | "HIGH";
}

const proposedPlanCache = new ComputationCache<ProposedPlan>({
  maxEntries: 300,
  ttlMs: 10 * 60_000, // 10 min: o treinador itera prévia→simular na mesma sessão.
});

function buildProposedPlan(input: StrategyInput): ProposedPlan {
  const key = stableKey({
    modality: input.modality,
    goal: input.goal,
    startDate: input.startDate,
    eventDate: input.eventDate,
    level: input.level ?? "",
    days: [...input.availableWeekdays].sort((a, b) => a - b).join(","),
    baseWeeklyVolumeKm: input.baseWeeklyVolumeKm ?? 0,
    includeStrength: input.includeStrength,
  });

  return proposedPlanCache.getOrCompute(key, () => {
    const macro = buildMacrocycle(toStrategicInputs(input));
    if (!macro.ok) throw new ValidationError(macro.error.message);

    const contexts = toWeekContexts(macro, {
      availableWeekdays: input.availableWeekdays,
      includeStrength: input.includeStrength,
    });
    const proposed: ProposedLoad[] = contexts.flatMap((ctx) =>
      enrichWeekPlan(planWeek(ctx), ctx)
        .sessions.filter((s) => s.predictedLoad != null)
        .map((s) => ({ date: s.plannedDate, load: s.predictedLoad as number })),
    );
    const totalVolumeKm = macro.weeks.some((w) => w.targetVolumeKm != null)
      ? Math.round(macro.weeks.reduce((sum, w) => sum + (w.targetVolumeKm ?? 0), 0))
      : null;

    return { proposed, totalVolumeKm, confidence: macro.confidence };
  });
}

export async function simulateStrategyLoad(
  athleteId: string,
  input: StrategyInput,
  actor: PeriodizationActor,
  now: Date,
): Promise<StrategySimulation> {
  await requireTrainerAccessToAthlete(actor.organizationId, actor.trainerProfileId, athleteId);

  // Parte pura e cara (macrociclo + enriquecimento de todas as semanas) — do
  // cache quando a entrada se repete (Fase 9). O histórico do atleta é sempre
  // lido do banco (pode ter mudado) e nunca é servido de cache.
  const { proposed, totalVolumeKm, confidence } = buildProposedPlan(input);

  const history = await historyDailyLoad(actor.organizationId, athleteId, now);
  const simulation = projectLoad(history, proposed);

  return {
    simulation,
    confidence,
    totalVolumeKm,
    historyDays: history.filter((l) => l > 0).length,
  };
}
