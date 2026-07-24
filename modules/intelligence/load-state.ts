// ENKY Intelligence — motor de CARGA/ESTADO (ENKY Metric Registry, Fase 2).
//
// Deriva o estado de treinamento a partir da série diária de carga interna
// (sRPE load, que já coletamos), sem wearable e sem migration — calculado
// on-the-fly. Fórmulas abertas e versionadas (ver docs/ENKY_METRIC_REGISTRY.md):
// CTL/ATL (EWMA impulso-resposta), TSB, ACWR, monotonia/strain (Foster), ramp.
// Núcleo puro (sem prisma) — a interpretação em Insight vive no motor de atenção.

export const LOAD_FORMULA_VERSION = "1.0.0";

// Constantes de tempo do impulso-resposta. Exportadas para o motor de SIMULAÇÃO
// (modules/load-simulation) projetar CTL/ATL para frente com a MESMA matemática —
// a projeção não pode divergir da leitura, senão o "simular" mentiria.
export const CTL_TIME_CONSTANT = 42; // dias — carga crônica ("fitness")
export const ATL_TIME_CONSTANT = 7; // dias — carga aguda ("fadiga")

export interface LoadState {
  ctl: number; // carga crônica (EWMA 42d)
  atl: number; // carga aguda (EWMA 7d)
  tsb: number; // forma = ctl - atl
  acwr: number | null; // atl / ctl (null se ctl ~ 0)
  monotony: number | null; // média_7d / DP_7d (null se DP 0)
  strain: number | null; // carga_7d × monotonia
  rampPct: number | null; // variação % da CTL nos últimos 7 dias
  dataDays: number; // dias com treino na janela (proxy de volume de dados)
}

export function ewmaAlpha(timeConstant: number): number {
  return 1 - Math.exp(-1 / timeConstant);
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function stdDev(values: number[]): number {
  if (values.length === 0) return 0;
  const m = mean(values);
  return Math.sqrt(mean(values.map((v) => (v - m) ** 2)));
}

/**
 * Computa o estado de carga a partir da série DIÁRIA de carga (mais antigo →
 * mais recente, com zeros nos dias sem treino). Requer histórico suficiente
 * para a CTL fazer sentido; a confiança da leitura escala com `dataDays`.
 */
export function computeLoadState(dailyLoad: number[]): LoadState {
  const alpha42 = ewmaAlpha(CTL_TIME_CONSTANT);
  const alpha7 = ewmaAlpha(ATL_TIME_CONSTANT);

  let ctl = 0;
  let atl = 0;
  const ctlSeries: number[] = [];
  for (const load of dailyLoad) {
    ctl += (load - ctl) * alpha42;
    atl += (load - atl) * alpha7;
    ctlSeries.push(ctl);
  }

  const last7 = dailyLoad.slice(-7);
  const sd7 = stdDev(last7);
  const mean7 = mean(last7);
  const monotony = sd7 > 0 ? mean7 / sd7 : null;
  const weeklyLoad = last7.reduce((sum, v) => sum + v, 0);
  const strain = monotony != null ? weeklyLoad * monotony : null;

  const ctlPrev = ctlSeries.length >= 8 ? ctlSeries[ctlSeries.length - 8] : undefined;
  const rampPct = ctlPrev != null && ctlPrev > 0 ? (ctl - ctlPrev) / ctlPrev : null;

  const dataDays = dailyLoad.filter((load) => load > 0).length;

  return {
    ctl,
    atl,
    tsb: ctl - atl,
    acwr: ctl > 1 ? atl / ctl : null,
    monotony,
    strain,
    rampPct,
    dataDays,
  };
}

export interface PmcPoint {
  ctl: number;
  atl: number;
  tsb: number; // forma NO DIA = ctl_ontem − atl_ontem (convenção TrainingPeaks)
}

/**
 * Série diária do Performance Management Chart (CTL/ATL/TSB) — o gráfico de forma
 * do intervals.icu/TrainingPeaks. Mesma EWMA da computeLoadState, mas devolve um
 * ponto por dia (mais antigo → mais recente) para plotar a curva. O TSB do dia é
 * medido ANTES de aplicar a carga do próprio dia (fitness/fadiga da véspera).
 */
export function computePmcSeries(dailyLoad: number[]): PmcPoint[] {
  const alpha42 = ewmaAlpha(CTL_TIME_CONSTANT);
  const alpha7 = ewmaAlpha(ATL_TIME_CONSTANT);
  let ctl = 0;
  let atl = 0;
  const series: PmcPoint[] = [];
  for (const load of dailyLoad) {
    const tsb = ctl - atl;
    ctl += (load - ctl) * alpha42;
    atl += (load - atl) * alpha7;
    series.push({ ctl, atl, tsb });
  }
  return series;
}
