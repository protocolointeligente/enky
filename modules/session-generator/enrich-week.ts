import {
  classifyPhase,
  type PlannedSession,
  type WeekContext,
  type WeekPlan,
} from "@/modules/periodization/generation-rules";
import {
  CATALOG_VERSION,
  querySessions,
  recommendSessions,
} from "@/modules/training-library/session-catalog";
import type { CatalogSession, EnergySystem } from "@/modules/training-library/session-catalog-types";

// ============================================================================
// MOTOR DE SUGESTÃO — enriquecimento de sessões (ENKY Intelligence 2.0 · Fase 3).
// ============================================================================
// Fecha o ciclo Fase 1 → Fase 2 → Fase 3: o gerador (planWeek) diz QUAIS sessões
// e COMO; a biblioteca científica diz PARA QUÊ e COM QUE EVIDÊNCIA. Este passo
// casa cada sessão gerada com a entrada de catálogo mais específica e devolve a
// sugestão auto-explicável que a Fase 3 pede: por que, objetivo, sistema
// energético, adaptação, carga prevista, risco, confiança e referências.
//
// PURO: não toca Prisma nem React, não altera o gerador nem a biblioteca —
// apenas os combina. Testável sem fixture.

/** Adaptação fisiológica pretendida, derivada do sistema energético. */
const ADAPTATION: Record<EnergySystem, string> = {
  AEROBIC_BASE: "Densidade mitocondrial, capilarização e economia aeróbica.",
  AEROBIC_THRESHOLD: "Elevação do limiar de lactato — sustentar mais ritmo sem acúmulo.",
  VO2MAX: "Aumento do consumo máximo de oxigênio (potência aeróbica).",
  ANAEROBIC: "Tolerância a lactato e potência anaeróbia.",
  NEUROMUSCULAR: "Recrutamento, coordenação e economia neuromuscular.",
  MIXED: "Estímulo misto — estrutural e metabólico.",
};

export interface SessionSuggestion {
  plannedDate: string;
  modality: PlannedSession["modality"];
  kind: PlannedSession["kind"];
  title: string;
  /** true quando houve casamento com o catálogo na fase certa. */
  matched: boolean;
  objective: string | null;
  energySystem: EnergySystem | null;
  adaptation: string | null;
  /** Contraindicações da sessão de catálogo — o "risco" da sugestão. */
  risk: string[];
  prerequisites: string[];
  evidenceLevel: CatalogSession["evidenceLevel"] | null;
  references: string[];
  /** Carga interna prevista (descritiva) = carga/hora × duração média. */
  predictedLoad: number | null;
  catalogId: string | null;
  /** Explicação legível composta a partir do catálogo. */
  why: string;
}

export interface WeekSuggestion {
  catalogVersion: string;
  sessions: SessionSuggestion[];
  confidence: WeekPlan["confidence"];
  rationale: WeekPlan["rationale"];
}

// Casa a sessão com o catálogo relaxando o critério em degraus: fase+nível+tipo
// → fase+tipo → só modalidade+tipo. `matched` só é true quando bateu na FASE
// certa (os dois primeiros degraus) — senão é um análogo de outra fase, honesto
// sobre isso.
function matchCatalog(
  session: PlannedSession,
  phase: ReturnType<typeof classifyPhase>["kind"],
  level: WeekContext["level"],
): { session: CatalogSession | null; matched: boolean } {
  const withPhaseLevel = recommendSessions({
    modality: session.modality,
    phase,
    level,
    sessionKind: session.kind,
  });
  if (withPhaseLevel[0]) return { session: withPhaseLevel[0], matched: true };

  const withPhase = recommendSessions({
    modality: session.modality,
    phase,
    sessionKind: session.kind,
  });
  if (withPhase[0]) return { session: withPhase[0], matched: true };

  // Sem sessão da fase: pega um análogo da mesma modalidade+tipo (fase diferente)
  // só para carregar objetivo/evidência — mas NÃO finge que é específico da fase.
  const anyPhase = querySessions({ modality: session.modality, sessionKind: session.kind });
  if (anyPhase[0]) return { session: anyPhase[0], matched: false };

  // Última relaxação: sessões de baixa intensidade (RECOVERY/LONG) que não têm
  // entrada própria numa disciplina caem no análogo aeróbico leve (EASY) da
  // mesma modalidade — um regenerativo de pedal é, na prática, um Z2 curto.
  if (session.kind === "RECOVERY" || session.kind === "LONG") {
    const easy = querySessions({ modality: session.modality, sessionKind: "EASY" });
    if (easy[0]) return { session: easy[0], matched: false };
  }

  return { session: null, matched: false };
}

function predictedLoad(catalog: CatalogSession): number {
  const avgMinutes = (catalog.durationMin[0] + catalog.durationMin[1]) / 2;
  return Math.round(catalog.estimatedLoadPerHour * (avgMinutes / 60));
}

export function enrichSession(session: PlannedSession, context: WeekContext): SessionSuggestion {
  const phase = classifyPhase(context.phaseName).kind;
  const { session: catalog, matched } = matchCatalog(session, phase, context.level);

  if (!catalog) {
    return {
      plannedDate: session.plannedDate,
      modality: session.modality,
      kind: session.kind,
      title: session.title,
      matched: false,
      objective: null,
      energySystem: null,
      adaptation: null,
      risk: [],
      prerequisites: [],
      evidenceLevel: null,
      references: [],
      predictedLoad: null,
      catalogId: null,
      why: "Sem sessão de catálogo correspondente — sugestão gerada apenas pela regra da fase.",
    };
  }

  const adaptation = ADAPTATION[catalog.energySystem];
  const why = matched
    ? `${catalog.objective} Trabalha o sistema ${catalog.energySystem} (${adaptation}) — apropriada para a fase ${phase}. Evidência ${catalog.evidenceLevel}.`
    : `${catalog.objective} Análogo de outra fase (não há sessão de catálogo específica de ${session.kind} para a fase ${phase}); revise a intensidade. Evidência ${catalog.evidenceLevel}.`;

  return {
    plannedDate: session.plannedDate,
    modality: session.modality,
    kind: session.kind,
    title: session.title,
    matched,
    objective: catalog.objective,
    energySystem: catalog.energySystem,
    adaptation,
    risk: catalog.contraindications,
    prerequisites: catalog.prerequisites,
    evidenceLevel: catalog.evidenceLevel,
    references: catalog.references,
    predictedLoad: predictedLoad(catalog),
    catalogId: catalog.id,
    why,
  };
}

/** Enriquece um plano de semana inteiro (saída do planWeek) com o catálogo. */
export function enrichWeekPlan(plan: WeekPlan, context: WeekContext): WeekSuggestion {
  return {
    catalogVersion: CATALOG_VERSION,
    sessions: plan.sessions.map((s) => enrichSession(s, context)),
    confidence: plan.confidence,
    rationale: plan.rationale,
  };
}
