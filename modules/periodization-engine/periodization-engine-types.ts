// ============================================================================
// MOTOR ESTRATÉGICO — tipos compartilhados (ENKY Intelligence 2.0 · Fase 1).
// ============================================================================
// Este módulo é a CAMADA ACIMA do gerador de semana (modules/periodization/
// generation-rules.ts). O gerador transforma UMA semana em sessões; o motor
// estratégico decide, de cima para baixo, quantas semanas existem, como elas
// se agrupam em mesociclos, onde vai o pico e o taper, quando desloadar e como
// a carga ondula ao longo do ciclo — a partir da DATA DA PROVA e do estado do
// atleta.
//
// POSTURA (idêntica ao gerador — não negociável, ver README):
//  - O motor PROPÕE, o treinador DISPÕE. Nada é publicado automaticamente.
//  - Toda decisão é explicável: cada regra aplicada vira uma linha em
//    `rationale.rules` com sua versão e uma referência científica.
//  - Faltou dado? Geramos assim mesmo, com confiança REBAIXADA e o dado
//    ausente listado em `missingData` — nunca em silêncio.
//  - CTL/ATL/TSB entram como CONTEXTO DESCRITIVO. Nunca como preditor isolado
//    de lesão para cortar volume — usá-los assim seria o erro que a literatura
//    aponta (ver load-state.ts).
//  - Reutiliza os tipos-primitivos do gerador (Modality, PhaseKind,
//    ConfidenceLevel, AppliedRule) para que a ponte Fase 1 → Fase 3 seja direta.

import type {
  AppliedRule,
  AthleteLevel,
  ConfidenceLevel,
  Modality,
  PhaseKind,
} from "@/modules/periodization/generation-rules";

export type { AppliedRule, AthleteLevel, ConfidenceLevel, Modality, PhaseKind };

/** Estado de carga atual (opcional) — só para CONTEXTO/aviso, nunca para decidir volume. */
export interface CurrentLoadContext {
  ctl: number;
  atl: number;
  tsb: number;
}

/** Entradas do motor estratégico. Só `modality`, `startDate` e `eventDate` são
 *  obrigatórios; o resto é assumido com aviso quando ausente. */
export interface StrategicInputs {
  modality: Modality;
  goal: string;
  /** Início do plano, YYYY-MM-DD. */
  startDate: string;
  /** Data da prova/objetivo, YYYY-MM-DD. O pico é ancorado aqui. */
  eventDate: string;
  level?: AthleteLevel;
  /** Dias ISO em que o atleta pode treinar (1=segunda … 7=domingo). */
  availableWeekdays?: number[];
  /** Volume semanal de PARTIDA em km (endurance). Ausente ⇒ padrão + confiança baixa. */
  baseWeeklyVolumeKm?: number;
  includeStrength?: boolean;
  /** Estado de carga atual — contexto descritivo (não decide volume). */
  currentLoad?: CurrentLoadContext;
}

/** Um mesociclo: bloco de semanas com um mesmo propósito de fase. */
export interface MesocycleBlock {
  sequence: number;
  name: string;
  kind: PhaseKind;
  startWeek: number; // 1-based, inclusivo
  endWeek: number; // 1-based, inclusivo
  weeks: number;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  focus: string;
  /** Fração do volume-base aplicada nas semanas de carga desta fase. */
  volumeFactor: number;
  intensityFocus: string;
}

/** Um microciclo = uma semana. Espelha o que o gerador de semana precisa. */
export interface MicrocycleWeek {
  sequence: number; // 1-based dentro do macrociclo
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  mesocycleSequence: number;
  phaseKind: PhaseKind;
  phaseName: string;
  isRecoveryWeek: boolean;
  isEventWeek: boolean;
  /** Posição na onda de carga do mesociclo (1 = mais leve). Descritivo. */
  loadStep: number;
  /** Volume alvo da semana (km) — endurance. null para força/funcional. */
  targetVolumeKm: number | null;
  intensityFocus: string;
}

export interface StrategyRationale {
  strategyVersion: string;
  rules: AppliedRule[];
  missingData: string[];
  caveats: string[];
  references: string[];
}

export interface Macrocycle {
  goal: string;
  modality: Modality;
  level: AthleteLevel;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD (data da prova)
  totalWeeks: number;
}

export type MacrocycleResult =
  | {
      ok: true;
      macrocycle: Macrocycle;
      mesocycles: MesocycleBlock[];
      weeks: MicrocycleWeek[];
      confidence: ConfidenceLevel;
      rationale: StrategyRationale;
    }
  | { ok: false; error: { code: "INVALID_WINDOW" | "WINDOW_TOO_LONG"; message: string } };
