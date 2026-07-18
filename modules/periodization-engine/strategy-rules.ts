import type { AthleteLevel, Modality, PhaseKind } from "@/modules/periodization/generation-rules";

// ============================================================================
// REGRAS CIENTÍFICAS DO MOTOR ESTRATÉGICO — núcleo PURO e VERSIONADO.
// ============================================================================
// Cada regra é uma função pura e uma referência. Mudou a fórmula? Sobe
// STRATEGY_VERSION — um plano gerado no passado continua explicável pela regra
// que de fato o gerou. Nenhuma dependência de Prisma/React aqui.

export const STRATEGY_VERSION = "strategy-v1";

// Referências que sustentam as regras abaixo. Aparecem em rationale.references
// para o treinador auditar a origem de cada decisão (Fase 7 — explicabilidade).
export const STRATEGY_REFERENCES: readonly string[] = [
  "Bompa & Buzzichelli (2019). Periodization: Theory and Methodology of Training, 6ª ed.",
  "Issurin (2010). New horizons for the methodology and physiology of training periodization. Sports Med 40(3).",
  "Bosquet et al. (2007). Effects of tapering on performance: a meta-analysis. Med Sci Sports Exerc 39(8) — taper de ~2 semanas com corte de volume preservando intensidade.",
  "Seiler (2010). What is best practice for training intensity distribution in endurance athletes? — distribuição polarizada.",
  "Gabbett (2016). The training-injury prevention paradox — progressão de carga sem saltos abruptos (usada como aviso, não como gatilho automático).",
];

const MAX_WEEKS = 104; // ~2 anos — janela maior é erro de digitação, não plano.

// ---------------------------------------------------------------------------
// Regra S1 — janela → total de semanas.
// ---------------------------------------------------------------------------
const DAY_MS = 86_400_000;

export function totalWeeksBetween(startISO: string, eventISO: string): number {
  const start = Date.parse(`${startISO}T00:00:00.000Z`);
  const event = Date.parse(`${eventISO}T00:00:00.000Z`);
  const days = Math.round((event - start) / DAY_MS) + 1; // inclui o dia da prova
  return Math.max(1, Math.ceil(days / 7));
}

export function windowGuard(totalWeeks: number): { ok: true } | { ok: false; message: string } {
  if (totalWeeks > MAX_WEEKS) {
    return { ok: false, message: `Janela muito longa: máximo de ${MAX_WEEKS} semanas por macrociclo.` };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Regra S2 — comprimento do taper (Bosquet 2007: ~2 semanas é o ponto ótimo
// médio; ciclos curtos não comportam 2, ciclos longos e atletas avançados
// toleram/beneficiam de um pouco mais).
// ---------------------------------------------------------------------------
export function taperWeeks(totalWeeks: number, level: AthleteLevel): number {
  if (totalWeeks <= 4) return totalWeeks <= 2 ? 0 : 1;
  if (totalWeeks <= 8) return 1;
  if (totalWeeks <= 16) return 2;
  return level === "ADVANCED" ? 3 : 2;
}

// ---------------------------------------------------------------------------
// Regra S3 — modelo de fases sobre as semanas de preparação (todas exceto o
// taper). Preparação geral (BASE) longa, preparação específica (BUILD) média,
// pico (PEAK) curto — clássico afunilamento do geral para o específico
// (Bompa; Issurin). Proporções conservadoras; o resto (arredondamento) sobra
// para a BASE, a fase mais segura para alongar.
// ---------------------------------------------------------------------------
export interface PhaseSpan {
  kind: PhaseKind;
  weeks: number;
}

// Frações das semanas de preparação por fase (afunilamento geral→específico).
// BASE recebe a sobra por construção, então só BUILD/PEAK têm fração explícita.
const BUILD_SHARE = 0.35;
const PEAK_SHARE = 0.15;

export function phaseSpans(totalWeeks: number, level: AthleteLevel): PhaseSpan[] {
  const taper = taperWeeks(totalWeeks, level);
  const prep = totalWeeks - taper;

  // Ciclos muito curtos não comportam quatro fases — colapsa para o essencial.
  if (prep <= 0) return [{ kind: "TAPER", weeks: totalWeeks }];
  if (prep <= 2) {
    const spans: PhaseSpan[] = [{ kind: "BUILD", weeks: prep }];
    if (taper > 0) spans.push({ kind: "TAPER", weeks: taper });
    return spans;
  }

  // Distribui as semanas de preparação pelas frações, garantindo >=1 em cada
  // fase e devolvendo a sobra para a BASE.
  let build = Math.max(1, Math.round(prep * BUILD_SHARE));
  let peak = Math.max(1, Math.round(prep * PEAK_SHARE));
  let base = prep - build - peak;
  if (base < 1) {
    // Preparação apertada: sacrifica PEAK antes de BUILD (a fase específica
    // importa mais que o pico quando o tempo é curto).
    base = 1;
    const deficit = base + build + peak - prep;
    peak = Math.max(1, peak - deficit);
    if (base + build + peak > prep) build = Math.max(1, prep - base - peak);
  }

  const spans: PhaseSpan[] = [
    { kind: "BASE", weeks: base },
    { kind: "BUILD", weeks: build },
    { kind: "PEAK", weeks: peak },
  ];
  if (taper > 0) spans.push({ kind: "TAPER", weeks: taper });
  return spans;
}

// ---------------------------------------------------------------------------
// Regra S4 — cadência de deload (semana regenerativa). Iniciante acumula menos
// fadiga tolerável antes de precisar absorver: 3:1 (3 de carga + 1 leve).
// Intermediário/avançado: 4:1. O deload NUNCA cai numa semana de taper (que já
// é leve) nem na semana da prova.
// ---------------------------------------------------------------------------
export function deloadEveryNWeeks(level: AthleteLevel): number {
  return level === "BEGINNER" ? 3 : 4;
}

// ---------------------------------------------------------------------------
// Regra S5 — perfil de volume/intensidade por fase. `volumeFactor` multiplica o
// volume-base; `intensityFocus` descreve a distribuição pretendida (polarizada
// nas fases duras — Seiler 2010).
// ---------------------------------------------------------------------------
export interface PhaseStrategyProfile {
  focus: string;
  volumeFactor: number;
  intensityFocus: string;
}

export const PHASE_STRATEGY: Record<PhaseKind, PhaseStrategyProfile> = {
  BASE: {
    focus: "Base aeróbica / preparação geral",
    volumeFactor: 1,
    intensityFocus: "Maioria em baixa intensidade; força de base.",
  },
  BUILD: {
    focus: "Preparação específica",
    volumeFactor: 1,
    intensityFocus: "Distribuição polarizada; introdução de qualidade específica de prova.",
  },
  PEAK: {
    // Evita "afinamento"/"taper" no rótulo: o gerador de semana classifica a
    // fase por palavra-chave e "afinamento" cairia em TAPER. "Pico/competição"
    // casa em PEAK de forma estável (ver classifyPhase em generation-rules).
    focus: "Pico / competição",
    volumeFactor: 0.95,
    intensityFocus: "Volume levemente reduzido, qualidade no ritmo da prova.",
  },
  TAPER: {
    focus: "Taper / polimento",
    volumeFactor: 0.55,
    intensityFocus: "Corta VOLUME, preserva INTENSIDADE (Bosquet 2007).",
  },
  TRANSITION: {
    focus: "Transição / regeneração",
    volumeFactor: 0.5,
    intensityFocus: "Só volume fácil, zero qualidade.",
  },
};

// ---------------------------------------------------------------------------
// Regra S6 — onda de carga dentro do mesociclo. Semanas de carga sobem em
// degraus (progressão), a semana de deload cai. Retorna o MULTIPLICADOR do
// volume-base para uma semana, dado quantas semanas de carga a precederam.
// Progressão conservadora (~+7%/degrau, teto +21%) — a progressão é uma
// SUGESTÃO, não um limite de segurança calculado (Gabbett 2016 é usado como
// aviso, não como gatilho).
// ---------------------------------------------------------------------------
const LOAD_STEP_PCT = 0.07;
const DELOAD_FACTOR = 0.6;

export function loadWaveMultiplier(loadStep: number, isDeload: boolean): number {
  if (isDeload) return DELOAD_FACTOR;
  // loadStep 1 => base; cada degrau adiciona LOAD_STEP_PCT, teto em 3 degraus.
  const capped = Math.min(loadStep - 1, 3);
  return 1 + capped * LOAD_STEP_PCT;
}

// ---------------------------------------------------------------------------
// Regra S7 — volume-base padrão quando o treinador não informou o volume atual
// (endurance). CHUTE EDUCADO, assumido como tal: dispara confiança LOW. Mesma
// tabela do gerador de semana para coerência.
// ---------------------------------------------------------------------------
export const DEFAULT_BASE_VOLUME_KM: Record<Modality, Record<AthleteLevel, number>> = {
  RUNNING: { BEGINNER: 20, INTERMEDIATE: 40, ADVANCED: 65 },
  SWIMMING: { BEGINNER: 4, INTERMEDIATE: 8, ADVANCED: 14 },
  CYCLING: { BEGINNER: 60, INTERMEDIATE: 140, ADVANCED: 250 },
  TRIATHLON: { BEGINNER: 60, INTERMEDIATE: 150, ADVANCED: 260 },
  STRENGTH: { BEGINNER: 0, INTERMEDIATE: 0, ADVANCED: 0 },
  FUNCTIONAL: { BEGINNER: 0, INTERMEDIATE: 0, ADVANCED: 0 },
};

export function isEndurance(modality: Modality): boolean {
  return modality !== "STRENGTH" && modality !== "FUNCTIONAL";
}
