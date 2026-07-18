import { prisma } from "@/infrastructure/database/prisma";
import { classifyReadiness, type ReadinessClass } from "./readiness";
import { computeLoadState, LOAD_FORMULA_VERSION, type LoadState } from "./load-state";

// Métricas de contexto do atleta para o cabeçalho do calendário e a página 360º.
// Mesma base do relatório (report-service.computeSnapshot), porém SEM exigir
// gerar relatório: a carga é derivada on-the-fly da série de sRPE, a prontidão
// do último check-in. "Relatórios apenas exportam dados já existentes" — aqui é
// a fonte viva. Escopo por organização; o acesso do treinador é validado na rota.

const LOAD_WINDOW_DAYS = 90; // histórico para a EWMA da CTL (42d) fazer sentido
const WEEKLY_LOAD_DAYS = 7;
const ADHERENCE_DAYS = 28; // aderência das últimas 4 semanas (janela do treinador)
const PAIN_ALERT_LEVEL = 4; // dor ≥ 4 conta como alerta (mesmo corte da página do atleta)
// Abaixo disto a leitura de carga é fraca demais para decidir — a UI mostra
// "histórico insuficiente" em vez de um número que finge precisão.
const SUFFICIENT_DATA_DAYS = 14;

const REVIEW_STATUSES = new Set(["COMPLETED", "PARTIAL", "MISSED"]);

export interface AthleteContextMetrics {
  load: LoadState; // ctl/atl/tsb/acwr/monotonia/strain/ramp/dataDays
  weeklyLoad: number | null; // soma de sRPE dos últimos 7 dias (null se sem dado)
  readiness: { class: ReadinessClass | null; score: number | null; date: string | null };
  adherence: { due: number; done: number; pct: number | null }; // últimas 4 semanas
  pain: { latest: number | null; alerts: number }; // último nível + nº de alertas na janela
  feedbackPending: number; // retornos do atleta aguardando revisão do treinador
  formulaVersion: string; // versão da fórmula de carga (rastreabilidade)
  lastUpdatedAt: string | null; // data do dado mais recente (treino realizado/check-in)
  sufficient: boolean; // há histórico suficiente para a carga ser confiável?
}

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// Idade em anos a partir do nascimento, respeitando se o aniversário já
// ocorreu no ano corrente. Pura e em UTC (sem drift de fuso). Fora de [0,130)
// é dado inválido → null, em vez de exibir um número absurdo.
export function ageFromBirthDate(birthDate: Date | null, now: Date): number | null {
  if (!birthDate) return null;
  let age = now.getUTCFullYear() - birthDate.getUTCFullYear();
  const m = now.getUTCMonth() - birthDate.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < birthDate.getUTCDate())) age -= 1;
  return age >= 0 && age < 130 ? age : null;
}

// Série diária contínua (zero nos dias sem treino) — idêntica ao motor de carga.
function dailySeries(loadByDay: Map<string, number>, since: Date, end: Date): number[] {
  const out: number[] = [];
  const cursor = new Date(since);
  cursor.setHours(0, 0, 0, 0);
  const stop = new Date(end);
  stop.setHours(0, 0, 0, 0);
  while (cursor <= stop) {
    out.push(loadByDay.get(isoDay(cursor)) ?? 0);
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

export async function getAthleteContextMetrics(
  organizationId: string,
  athleteId: string,
  now: Date,
): Promise<AthleteContextMetrics> {
  const loadSince = new Date(now);
  loadSince.setDate(loadSince.getDate() - LOAD_WINDOW_DAYS);
  const weekSince = new Date(now);
  weekSince.setDate(weekSince.getDate() - WEEKLY_LOAD_DAYS);
  const adherenceSince = new Date(now);
  adherenceSince.setDate(adherenceSince.getDate() - ADHERENCE_DAYS);

  const workouts = await prisma.workout.findMany({
    where: { organizationId, athleteId, plannedDate: { gte: loadSince, lte: now } },
    orderBy: { plannedDate: "asc" },
    select: {
      plannedDate: true,
      status: true,
      feedback: {
        select: { sessionRpeLoad: true, painLevel: true, createdAt: true },
      },
    },
  });

  const loadByDay = new Map<string, number>();
  let weeklyLoad = 0;
  let weeklyHasData = false;
  let lastUpdatedAt: Date | null = null;

  // Aderência (últimas 4 semanas): realizados / previstos.
  let due = 0;
  let done = 0;
  // Dor: nível mais recente na janela + nº de alertas (dor ≥ 4).
  let latestPain: number | null = null;
  let latestPainAt: Date | null = null;
  let painAlerts = 0;
  // Retornos aguardando revisão.
  let feedbackPending = 0;

  for (const w of workouts) {
    const load = w.feedback?.sessionRpeLoad != null ? Number(w.feedback.sessionRpeLoad) : null;
    if (load != null) {
      const day = isoDay(w.plannedDate);
      loadByDay.set(day, (loadByDay.get(day) ?? 0) + load);
      if (w.plannedDate >= weekSince) {
        weeklyLoad += load;
        weeklyHasData = true;
      }
    }

    const stamp = w.feedback?.createdAt ?? w.plannedDate;
    if (w.feedback && (!lastUpdatedAt || stamp > lastUpdatedAt)) lastUpdatedAt = stamp;

    if (w.plannedDate >= adherenceSince) {
      if (["COMPLETED", "PARTIAL", "MISSED"].includes(w.status)) {
        due += 1;
        if (w.status === "COMPLETED" || w.status === "PARTIAL") done += 1;
      } else if (w.status === "PUBLISHED" && w.plannedDate < now) {
        due += 1; // publicado e vencido sem retorno também estava previsto
      }
    }

    if (w.feedback?.painLevel != null) {
      if (w.feedback.painLevel >= PAIN_ALERT_LEVEL) painAlerts += 1;
      if (!latestPainAt || w.plannedDate > latestPainAt) {
        latestPain = w.feedback.painLevel;
        latestPainAt = w.plannedDate;
      }
    }

    if (w.feedback && REVIEW_STATUSES.has(w.status)) feedbackPending += 1;
  }

  const latestCheckIn = await prisma.readinessCheckIn.findFirst({
    where: { organizationId, athleteId },
    orderBy: { checkInDate: "desc" },
    select: {
      checkInDate: true,
      sleepHours: true,
      sleepQuality: true,
      fatigue: true,
      soreness: true,
      stress: true,
      motivation: true,
    },
  });

  let readiness: AthleteContextMetrics["readiness"] = { class: null, score: null, date: null };
  if (latestCheckIn) {
    const r = classifyReadiness({
      sleepHours: latestCheckIn.sleepHours != null ? Number(latestCheckIn.sleepHours) : null,
      sleepQuality: latestCheckIn.sleepQuality,
      fatigue: latestCheckIn.fatigue,
      soreness: latestCheckIn.soreness,
      stress: latestCheckIn.stress,
      motivation: latestCheckIn.motivation,
    });
    readiness = { class: r.class, score: r.score, date: isoDay(latestCheckIn.checkInDate) };
    if (!lastUpdatedAt || latestCheckIn.checkInDate > lastUpdatedAt) {
      lastUpdatedAt = latestCheckIn.checkInDate;
    }
  }

  const load = computeLoadState(dailySeries(loadByDay, loadSince, now));

  return {
    load,
    weeklyLoad: weeklyHasData ? Math.round(weeklyLoad) : null,
    readiness,
    adherence: { due, done, pct: due > 0 ? Math.round((done / due) * 100) : null },
    pain: { latest: latestPain, alerts: painAlerts },
    feedbackPending,
    formulaVersion: LOAD_FORMULA_VERSION,
    lastUpdatedAt: lastUpdatedAt ? isoDay(lastUpdatedAt) : null,
    sufficient: load.dataDays >= SUFFICIENT_DATA_DAYS,
  };
}
