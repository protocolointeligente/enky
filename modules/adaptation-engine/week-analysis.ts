import type { Modality, SessionKind } from "@/modules/periodization/generation-rules";

// ============================================================================
// MOTOR DE ADAPTAÇÃO — recálculo da semana (ENKY Intelligence 2.0 · Fase 4).
// ============================================================================
// Ao editar/gerar as sessões de uma semana, o ENKY recalcula o que a mudança fez
// à estrutura: volume, carga interna, distribuição polarizada, equilíbrio entre
// modalidades, presença de regenerativo e ALERTAS. Puro, versionado, testável
// sem banco — a mesma função que o editor e o preview chamam.
//
// POSTURA: alertas são AVISOS ao treinador, nunca bloqueios. O motor aponta; o
// treinador decide. Os limiares são heurísticos e assumidos como tal (a
// distribuição polarizada ~80/20 é referência de endurance — Seiler 2010 —, não
// uma lei para todo atleta).

export const ANALYSIS_VERSION = "week-analysis-v1";

export interface WeekSessionInput {
  modality: Modality;
  kind: SessionKind;
  /** Carga interna prevista (UA) — do catálogo/Fase 3, ou do sRPE realizado. */
  load: number;
  /** Volume em km, quando aplicável (endurance). */
  volumeKm?: number;
}

export type AlertSeverity = "info" | "warning";

export interface WeekAlert {
  code:
    | "INTENSITY_TOO_HIGH"
    | "NO_LOW_INTENSITY"
    | "LOAD_SPIKE"
    | "SINGLE_KIND";
  severity: AlertSeverity;
  message: string;
}

export interface WeekAnalysis {
  version: string;
  sessionCount: number;
  qualityCount: number;
  hasRecovery: boolean;
  internalLoad: number;
  volumeKmTotal: number | null;
  loadByModality: { modality: Modality; load: number; pct: number }[];
  /** Distribuição de intensidade sobre a carga de ENDURANCE (força fica de fora). */
  intensity: { lowLoadPct: number | null; qualityLoadPct: number | null };
  alerts: WeekAlert[];
}

// Tipos de sessão por faixa de intensidade (para a distribuição polarizada).
const LOW_INTENSITY: SessionKind[] = ["EASY", "LONG", "RECOVERY"];
const HIGH_INTENSITY: SessionKind[] = ["QUALITY"];

// Limiares heurísticos (referência, não lei).
const QUALITY_SHARE_CEILING = 0.35; // acima disso a semana deixa de ser polarizada
const LOAD_SPIKE_RATIO = 1.5; // salto de carga vs. semana anterior

function pct(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

/**
 * Recalcula a semana a partir das suas sessões. `prevWeekLoad` (opcional) liga o
 * alerta de salto de carga — sem ele, o motor não inventa a semana anterior.
 */
export function analyzeWeek(
  sessions: WeekSessionInput[],
  prevWeekLoad?: number,
): WeekAnalysis {
  const sessionCount = sessions.length;
  const qualityCount = sessions.filter((s) => HIGH_INTENSITY.includes(s.kind)).length;
  const hasRecovery = sessions.some((s) => s.kind === "RECOVERY");
  const internalLoad = Math.round(sessions.reduce((sum, s) => sum + s.load, 0));

  const volumeValues = sessions.filter((s) => s.volumeKm != null);
  const volumeKmTotal =
    volumeValues.length > 0
      ? Math.round(volumeValues.reduce((sum, s) => sum + (s.volumeKm ?? 0), 0) * 10) / 10
      : null;

  // Carga por modalidade (equilíbrio) — útil no triathlon e em planos mistos.
  const byModality = new Map<Modality, number>();
  for (const s of sessions) byModality.set(s.modality, (byModality.get(s.modality) ?? 0) + s.load);
  const loadByModality = [...byModality.entries()]
    .map(([modality, load]) => ({ modality, load: Math.round(load), pct: pct(load, internalLoad) }))
    .sort((a, b) => b.load - a.load);

  // Distribuição polarizada sobre a carga de ENDURANCE (força não entra).
  const enduranceSessions = sessions.filter(
    (s) => LOW_INTENSITY.includes(s.kind) || HIGH_INTENSITY.includes(s.kind),
  );
  const enduranceLoad = enduranceSessions.reduce((sum, s) => sum + s.load, 0);
  const lowLoad = enduranceSessions
    .filter((s) => LOW_INTENSITY.includes(s.kind))
    .reduce((sum, s) => sum + s.load, 0);
  const qualityLoad = enduranceLoad - lowLoad;
  const intensity = {
    lowLoadPct: enduranceLoad > 0 ? pct(lowLoad, enduranceLoad) : null,
    qualityLoadPct: enduranceLoad > 0 ? pct(qualityLoad, enduranceLoad) : null,
  };

  // --- Alertas (avisos, nunca bloqueios) ------------------------------------
  const alerts: WeekAlert[] = [];

  if (enduranceLoad > 0 && qualityLoad / enduranceLoad > QUALITY_SHARE_CEILING) {
    alerts.push({
      code: "INTENSITY_TOO_HIGH",
      severity: "warning",
      message: `Intensidade concentrada: ${pct(qualityLoad, enduranceLoad)}% da carga de endurance é qualidade (referência polarizada ~20%). Considere mais volume fácil.`,
    });
  }

  if (enduranceLoad > 0 && lowLoad === 0) {
    alerts.push({
      code: "NO_LOW_INTENSITY",
      severity: "warning",
      message: "Nenhuma sessão de baixa intensidade na semana — sem base fácil, a recuperação entre estímulos duros fica comprometida.",
    });
  }

  if (prevWeekLoad != null && prevWeekLoad > 0 && internalLoad > prevWeekLoad * LOAD_SPIKE_RATIO) {
    alerts.push({
      code: "LOAD_SPIKE",
      severity: "warning",
      message: `Salto de carga: ${internalLoad} UA vs. ${Math.round(prevWeekLoad)} UA na semana anterior (+${pct(internalLoad - prevWeekLoad, prevWeekLoad)}%). Progressões abruptas são um fator de risco (Gabbett 2016).`,
    });
  }

  const kinds = new Set(sessions.map((s) => s.kind));
  if (sessionCount >= 3 && kinds.size === 1) {
    alerts.push({
      code: "SINGLE_KIND",
      severity: "info",
      message: "Todas as sessões são do mesmo tipo — pouca variação de estímulo na semana.",
    });
  }

  return {
    version: ANALYSIS_VERSION,
    sessionCount,
    qualityCount,
    hasRecovery,
    internalLoad,
    volumeKmTotal,
    loadByModality,
    intensity,
    alerts,
  };
}
