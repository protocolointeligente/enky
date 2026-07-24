// Geometria pura do gráfico PMC (sem React/DOM) — mapeia os pontos já calculados
// pelo backend (getAthleteMetrics) para coordenadas SVG. NÃO recalcula CTL/ATL/TSB:
// só posiciona. Testável isoladamente. As linhas (fitness/fadiga/forma) partilham
// uma escala Y que inclui o zero (para a linha de TSB=0); a carga diária é
// contexto, desenhada como barras num band inferior com escala própria.

export interface ChartPoint {
  date: string;
  ctl: number;
  atl: number;
  tsb: number;
  load: number;
}

export interface ChartTick {
  value: number;
  y: number;
}

export interface ChartXTick {
  label: string;
  x: number;
}

export interface ChartBar {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PmcChartGeometry {
  width: number;
  height: number;
  plot: { x: number; y: number; w: number; h: number };
  paths: { ctl: string; atl: string; tsb: string };
  loadBars: ChartBar[];
  yTicks: ChartTick[];
  zeroY: number | null;
  xTicks: ChartXTick[];
  /** x central de cada índice — para hit-testing do tooltip na página. */
  xAt: number[];
}

export interface PmcChartOptions {
  width?: number;
  height?: number;
  padTop?: number;
  padRight?: number;
  padBottom?: number;
  padLeft?: number;
}

function niceCeil(v: number): number {
  if (v <= 0) return 0;
  const mag = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / mag;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * mag;
}

function fmtDay(iso: string): string {
  // iso = YYYY-MM-DD → dd/MM (sem Date, para não depender de fuso).
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

/**
 * Constrói a geometria do PMC. Retorna `null` quando não há pontos suficientes
 * para uma linha (< 2 pontos) — a página mostra o empty state, não um gráfico
 * degenerado. Nunca inventa pontos para preencher lacunas: dias sem carga já
 * vêm como load=0 do backend.
 */
export function buildPmcChart(
  points: ChartPoint[],
  opts: PmcChartOptions = {},
): PmcChartGeometry | null {
  if (points.length < 2) return null;

  const width = opts.width ?? 720;
  const height = opts.height ?? 260;
  const padTop = opts.padTop ?? 12;
  const padRight = opts.padRight ?? 12;
  const padBottom = opts.padBottom ?? 22;
  const padLeft = opts.padLeft ?? 34;

  const plot = {
    x: padLeft,
    y: padTop,
    w: Math.max(1, width - padLeft - padRight),
    h: Math.max(1, height - padTop - padBottom),
  };

  // Escala Y das linhas: inclui 0 (linha de TSB) e todos os valores.
  let min = 0;
  let max = 0;
  for (const p of points) {
    min = Math.min(min, p.ctl, p.atl, p.tsb);
    max = Math.max(max, p.ctl, p.atl, p.tsb);
  }
  const top = niceCeil(max) || 1;
  const bottom = min < 0 ? -niceCeil(-min) : 0;
  const span = top - bottom || 1;

  const n = points.length;
  const xAt = points.map((_, i) => plot.x + (n === 1 ? 0 : (i / (n - 1)) * plot.w));
  const yOf = (v: number) => plot.y + (1 - (v - bottom) / span) * plot.h;

  const pathOf = (key: "ctl" | "atl" | "tsb") =>
    points
      .map((p, i) => `${i === 0 ? "M" : "L"}${xAt[i]!.toFixed(1)},${yOf(p[key]).toFixed(1)}`)
      .join(" ");

  // Barras de carga: escala própria (0..maxLoad) num band inferior do plot.
  const maxLoad = Math.max(1, ...points.map((p) => p.load));
  const bandH = plot.h * 0.35;
  const bandTop = plot.y + plot.h - bandH;
  const barW = Math.max(1, (plot.w / n) * 0.6);
  const loadBars: ChartBar[] = points
    .map((p, i) => {
      const h = (p.load / maxLoad) * bandH;
      return { x: xAt[i]! - barW / 2, y: bandTop + (bandH - h), w: barW, h };
    })
    .filter((b) => b.h > 0);

  // Ticks Y "bonitos" (bottom, 0 se aplicável, top).
  const tickVals = new Set<number>([bottom, 0, top]);
  const yTicks: ChartTick[] = [...tickVals]
    .filter((v) => v >= bottom && v <= top)
    .sort((a, b) => a - b)
    .map((value) => ({ value, y: yOf(value) }));

  const zeroY = bottom < 0 ? yOf(0) : null;

  // ~5 rótulos de data espaçados.
  const step = Math.max(1, Math.ceil(n / 5));
  const xTicks: ChartXTick[] = [];
  for (let i = 0; i < n; i += step) {
    xTicks.push({ label: fmtDay(points[i]!.date), x: xAt[i]! });
  }
  if (xTicks[xTicks.length - 1]!.x !== xAt[n - 1]) {
    xTicks.push({ label: fmtDay(points[n - 1]!.date), x: xAt[n - 1]! });
  }

  return {
    width,
    height,
    plot,
    paths: { ctl: pathOf("ctl"), atl: pathOf("atl"), tsb: pathOf("tsb") },
    loadBars,
    yTicks,
    zeroY,
    xTicks,
    xAt,
  };
}

/**
 * Frase-resumo curta e DESCRITIVA (nunca diagnóstica) a partir da tendência de
 * CTL e da forma (TSB) atual. Não afirma prontidão, risco de lesão nem
 * diagnóstico — só descreve o movimento das cargas e sugere revisar recuperação.
 */
export function pmcSummaryText(trend: PmcTrend | null, tsb: number): string {
  const base =
    trend == null
      ? "Ainda há poucos dados para descrever uma tendência."
      : trend.direction === "subindo"
        ? "Sua carga crônica aumentou nos últimos sete dias."
        : trend.direction === "descendo"
          ? "Sua carga crônica recuou nos últimos sete dias."
          : "Sua carga crônica ficou estável nos últimos sete dias.";
  const form =
    tsb < -10
      ? " A fadiga aguda está elevada, então vale revisar a recuperação antes de aumentar de novo o volume."
      : tsb < 5
        ? " A forma está levemente negativa, o que é comum em fases de construção de carga."
        : " A forma está positiva, indicando boa recuperação relativa à carga recente.";
  return base + form;
}

export type TrendDirection = "subindo" | "descendo" | "estavel";

export interface PmcTrend {
  direction: TrendDirection;
  deltaCtl: number;
}

/**
 * Tendência dos últimos 7 dias da carga crônica (CTL). Compara o CTL atual com
 * o de ~7 pontos atrás. Descritivo, nunca diagnóstico.
 */
export function pmcTrend(points: ChartPoint[]): PmcTrend | null {
  if (points.length < 2) return null;
  const last = points[points.length - 1]!;
  const prevIdx = Math.max(0, points.length - 8);
  const prev = points[prevIdx]!;
  const deltaCtl = Math.round((last.ctl - prev.ctl) * 10) / 10;
  const direction: TrendDirection =
    deltaCtl > 0.5 ? "subindo" : deltaCtl < -0.5 ? "descendo" : "estavel";
  return { direction, deltaCtl };
}
