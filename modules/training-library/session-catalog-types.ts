import type {
  AthleteLevel,
  Modality,
  PhaseKind,
  SessionKind,
} from "@/modules/periodization/generation-rules";

export type { AthleteLevel, Modality, PhaseKind, SessionKind };

// ============================================================================
// BIBLIOTECA CIENTÍFICA DE SESSÕES — tipos (ENKY Intelligence 2.0 · Fase 2).
// ============================================================================
// Catálogo declarativo, puro e versionado de sessões por modalidade. Cada
// entrada carrega TUDO que a Fase 3 (motor de sugestão) precisa para explicar
// uma sugestão: objetivo, fase ideal, sistema energético, zona/método,
// contraindicações, pré-requisitos, evidência e referências. NÃO conhece Prisma
// nem React — é dado + funções de consulta puras, testável sem fixture.
//
// POSTURA: nível de evidência conservador e honesto (A/B/C). Uma sessão no
// catálogo é uma OPÇÃO fundamentada, não uma prescrição — o motor propõe a
// partir daqui e o treinador decide.

/** Nível de evidência científica que sustenta o uso da sessão.
 *  A = revisão sistemática / consenso forte · B = estudos controlados ·
 *  C = prática consagrada / mecanístico. */
export type EvidenceLevel = "A" | "B" | "C";

/** Sistema energético predominante — usado na explicação (Fase 3). */
export type EnergySystem =
  | "AEROBIC_BASE"
  | "AEROBIC_THRESHOLD"
  | "VO2MAX"
  | "ANAEROBIC"
  | "NEUROMUSCULAR"
  | "MIXED";

export interface CatalogSession {
  /** Slug estável — referenciado por sugestões geradas; nunca muda de sentido. */
  id: string;
  modality: Modality;
  title: string;
  /** Objetivo da sessão em uma frase. */
  objective: string;
  /** Tipo da sessão — ponte com o gerador (generation-rules SessionKind). */
  sessionKind: SessionKind;
  /** Fases em que a sessão faz sentido. */
  idealPhases: PhaseKind[];
  /** Níveis para os quais a sessão é apropriada. */
  levels: AthleteLevel[];
  energySystem: EnergySystem;
  /** Método de treino (contínuo, intervalado, tempo, fartlek, força, etc.). */
  method: string;
  /** Zona/intensidade alvo descrita de forma legível (RPE ou código de zona). */
  intensity: string;
  description: string;
  /** Faixa típica de duração em minutos [min, max]. */
  durationMin: [number, number];
  /** Carga interna estimada por hora (sRPE-like, DESCRITIVO) — para dimensionar,
   *  nunca para decidir volume sozinha. */
  estimatedLoadPerHour: number;
  contraindications: string[];
  prerequisites: string[];
  evidenceLevel: EvidenceLevel;
  references: string[];
}

/** Critérios de seleção do catálogo (todos opcionais = sem filtro). */
export interface SessionQuery {
  modality?: Modality;
  phase?: PhaseKind;
  level?: AthleteLevel;
  sessionKind?: SessionKind;
  energySystem?: EnergySystem;
}
