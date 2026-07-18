import {
  ATL_TIME_CONSTANT,
  CTL_TIME_CONSTANT,
  LOAD_FORMULA_VERSION,
  ewmaAlpha,
} from "@/modules/intelligence/load-state";

// ============================================================================
// MOTOR DE SIMULAÇÃO DE CARGA — projeção pura (ENKY Intelligence 2.0 · Fase 6).
// ============================================================================
// "Simular alterações antes de salvar": dada a série HISTÓRICA de carga interna
// (sRPE, a mesma que o load-state lê) e um conjunto de sessões PROPOSTAS no
// futuro (data + carga prevista), projeta CTL/ATL/TSB dia a dia adiante — com a
// MESMA matemática impulso-resposta do load-state, para a projeção não divergir
// da leitura real.
//
// POSTURA: é uma PROJEÇÃO, não uma promessa. A carga futura vem da carga
// prevista por sessão (Fase 3), que é uma estimativa; o TSB projetado é um
// cenário para decidir, não um valor que vai acontecer. Nada aqui decide volume
// nem corta sessão — só mostra o que a alteração faria à trajetória.

export interface ProposedLoad {
  date: string; // YYYY-MM-DD
  load: number; // carga interna prevista (UA)
}

export interface LoadStatePoint {
  ctl: number;
  atl: number;
  tsb: number;
}

export interface ProjectionDay extends LoadStatePoint {
  date: string; // YYYY-MM-DD
  load: number; // carga aplicada no dia
}

export interface WeeklyLoad {
  weekStart: string; // YYYY-MM-DD (segunda-feira ISO)
  load: number; // soma da carga prevista na semana
}

export interface LoadSimulation {
  formulaVersion: string;
  /** Estado no ponto de partida (hoje), derivado só do histórico. */
  start: LoadStatePoint;
  /** Estado no fim da janela projetada. */
  end: LoadStatePoint;
  /** Extremos da projeção — o pico de fitness e o vale de forma. */
  peak: { ctl: number; atl: number; tsbMin: number };
  /** Trajetória dia a dia (para o gráfico). */
  days: ProjectionDay[];
  /** Carga prevista somada por semana ISO. */
  weekly: WeeklyLoad[];
}

const DAY_MS = 86_400_000;

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Roda o EWMA sobre o histórico e devolve o CTL/ATL no último dia — o ponto de
 *  partida da projeção (o "hoje" do atleta). */
export function seedFromHistory(historyDaily: number[]): { ctl: number; atl: number } {
  const alpha42 = ewmaAlpha(CTL_TIME_CONSTANT);
  const alpha7 = ewmaAlpha(ATL_TIME_CONSTANT);
  let ctl = 0;
  let atl = 0;
  for (const load of historyDaily) {
    ctl += (load - ctl) * alpha42;
    atl += (load - atl) * alpha7;
  }
  return { ctl, atl };
}

// Segunda-feira ISO da semana de uma data (para agrupar a carga semanal).
function isoWeekStart(iso: string): string {
  const t = Date.parse(`${iso}T00:00:00.000Z`);
  const weekday = ((new Date(t).getUTCDay() + 6) % 7); // 0=segunda … 6=domingo
  return new Date(t - weekday * DAY_MS).toISOString().slice(0, 10);
}

/**
 * Projeta CTL/ATL/TSB a partir do histórico, dia a dia, ao longo da janela das
 * sessões propostas. Dias sem sessão contam como carga zero (o descanso também
 * move a EWMA — é o que faz o CTL cair no taper).
 */
export function projectLoad(historyDaily: number[], proposed: ProposedLoad[]): LoadSimulation {
  const alpha42 = ewmaAlpha(CTL_TIME_CONSTANT);
  const alpha7 = ewmaAlpha(ATL_TIME_CONSTANT);

  const seed = seedFromHistory(historyDaily);
  let ctl = seed.ctl;
  let atl = seed.atl;
  const start: LoadStatePoint = { ctl: round1(ctl), atl: round1(atl), tsb: round1(ctl - atl) };

  // Carga proposta somada por dia (várias sessões no mesmo dia se acumulam).
  const loadByDay = new Map<string, number>();
  const weekly = new Map<string, number>();
  for (const p of proposed) {
    loadByDay.set(p.date, (loadByDay.get(p.date) ?? 0) + p.load);
    const wk = isoWeekStart(p.date);
    weekly.set(wk, (weekly.get(wk) ?? 0) + p.load);
  }

  const days: ProjectionDay[] = [];
  let peakCtl = ctl;
  let peakAtl = atl;
  let tsbMin = ctl - atl;

  const dates = [...loadByDay.keys()].sort();
  if (dates.length > 0) {
    let cursor = Date.parse(`${dates[0]}T00:00:00.000Z`);
    const stop = Date.parse(`${dates[dates.length - 1]}T00:00:00.000Z`);
    while (cursor <= stop) {
      const date = new Date(cursor).toISOString().slice(0, 10);
      const load = loadByDay.get(date) ?? 0;
      ctl += (load - ctl) * alpha42;
      atl += (load - atl) * alpha7;
      const tsb = ctl - atl;
      peakCtl = Math.max(peakCtl, ctl);
      peakAtl = Math.max(peakAtl, atl);
      tsbMin = Math.min(tsbMin, tsb);
      days.push({ date, load: round1(load), ctl: round1(ctl), atl: round1(atl), tsb: round1(tsb) });
      cursor += DAY_MS;
    }
  }

  return {
    formulaVersion: LOAD_FORMULA_VERSION,
    start,
    end: { ctl: round1(ctl), atl: round1(atl), tsb: round1(ctl - atl) },
    peak: { ctl: round1(peakCtl), atl: round1(peakAtl), tsbMin: round1(tsbMin) },
    days,
    weekly: [...weekly.entries()]
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([weekStart, load]) => ({ weekStart, load: Math.round(load) })),
  };
}
