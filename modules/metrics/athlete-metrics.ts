import { prisma } from "@/infrastructure/database/prisma";
import { computePmcSeries } from "@/modules/intelligence/load-state";

// Métricas do atleta = Performance Management Chart (CTL/ATL/TSB) sobre a carga
// interna diária (sRPE = esforço percebido × duração, que o ENKY já coleta no
// feedback). Série zero-preenchida por dia → computePmcSeries. Escopo org+atleta.
// Base sRPE; carga de atividades importadas (Strava) pode somar depois.

const DEFAULT_DAYS = 90;

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function round1(x: number): number {
  return Math.round(x * 10) / 10;
}

export interface MetricsPoint {
  date: string;
  ctl: number;
  atl: number;
  tsb: number;
  load: number;
}

export interface AthleteMetrics {
  points: MetricsPoint[];
  current: { ctl: number; atl: number; tsb: number } | null;
  /** Dias com carga registrada na janela — proxy da confiança da leitura. */
  dataDays: number;
  windowDays: number;
}

export async function getAthleteMetrics(
  organizationId: string,
  athleteId: string,
  days = DEFAULT_DAYS,
): Promise<AthleteMetrics> {
  const now = new Date();
  const since = new Date(now);
  since.setDate(since.getDate() - days + 1);

  const workouts = await prisma.workout.findMany({
    where: { organizationId, athleteId, plannedDate: { gte: since, lte: now } },
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

  // Série diária zero-preenchida (mais antigo → mais recente) + datas alinhadas.
  const dailyLoad: number[] = [];
  const dates: string[] = [];
  const cursor = new Date(since);
  while (cursor <= now) {
    const day = isoDay(cursor);
    dates.push(day);
    dailyLoad.push(loadByDay.get(day) ?? 0);
    cursor.setDate(cursor.getDate() + 1);
  }

  const pmc = computePmcSeries(dailyLoad);
  const points: MetricsPoint[] = pmc.map((p, i) => ({
    date: dates[i]!,
    ctl: round1(p.ctl),
    atl: round1(p.atl),
    tsb: round1(p.tsb),
    load: dailyLoad[i]!,
  }));

  const last = points[points.length - 1] ?? null;
  return {
    points,
    current: last ? { ctl: last.ctl, atl: last.atl, tsb: last.tsb } : null,
    dataDays: dailyLoad.filter((l) => l > 0).length,
    windowDays: days,
  };
}
