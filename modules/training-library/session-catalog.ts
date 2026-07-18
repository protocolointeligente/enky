import type {
  AthleteLevel,
  CatalogSession,
  Modality,
  PhaseKind,
  SessionKind,
  SessionQuery,
} from "./session-catalog-types";

// ============================================================================
// CATÁLOGO CIENTÍFICO DE SESSÕES — dados + consultas puras (Fase 2).
// ============================================================================
// Curado, não exaustivo: cada entrada é uma opção fundamentada com fase ideal,
// sistema energético, contraindicações e referências. Sobe CATALOG_VERSION a
// cada mudança de conteúdo — uma sugestão gerada no passado continua explicável
// pela versão do catálogo que a originou.
//
// Triathlon NÃO tem sessões próprias: compõe-se das disciplinas nado/pedal/
// corrida (mesma decisão do gerador). Uma consulta por TRIATHLON devolve a
// união das três.

export const CATALOG_VERSION = "library-v1";

const SESSIONS: CatalogSession[] = [
  // ---------------------------------------------------------------- CORRIDA
  {
    id: "run-easy-aerobic",
    modality: "RUNNING",
    title: "Rodagem aeróbica leve",
    objective: "Construir base aeróbica e capilarização com baixo custo de fadiga.",
    sessionKind: "EASY",
    idealPhases: ["BASE", "BUILD", "PEAK", "TAPER"],
    levels: ["BEGINNER", "INTERMEDIATE", "ADVANCED"],
    energySystem: "AEROBIC_BASE",
    method: "Contínuo",
    intensity: "RPE 3–4 · Z1–Z2 · conversação confortável",
    description:
      "Corrida contínua em ritmo confortável, controlada pela conversa. O grosso do volume polarizado vive aqui.",
    durationMin: [30, 75],
    estimatedLoadPerHour: 35,
    contraindications: ["Lesão aguda em membros inferiores"],
    prerequisites: [],
    evidenceLevel: "A",
    references: ["Seiler (2010), distribuição polarizada de intensidade."],
  },
  {
    id: "run-long",
    modality: "RUNNING",
    title: "Longão",
    objective: "Elevar resistência aeróbica e eficiência de substrato para provas longas.",
    sessionKind: "LONG",
    idealPhases: ["BASE", "BUILD", "PEAK"],
    levels: ["INTERMEDIATE", "ADVANCED"],
    energySystem: "AEROBIC_BASE",
    method: "Contínuo prolongado",
    intensity: "RPE 4–5 · Z2",
    description:
      "A sessão mais longa da semana, em ritmo sustentável. Progride em duração ao longo do bloco, não em intensidade.",
    durationMin: [70, 150],
    estimatedLoadPerHour: 45,
    contraindications: ["Iniciante sem base de volume", "Fadiga acumulada alta (TSB muito negativo)"],
    prerequisites: ["Rodagem contínua de ≥45 min tolerada"],
    evidenceLevel: "B",
    references: ["Daniels, Running Formula (long run como estímulo de resistência)."],
  },
  {
    id: "run-tempo-threshold",
    modality: "RUNNING",
    title: "Tempo / limiar",
    objective: "Elevar o limiar de lactato — sustentar mais velocidade sem acúmulo.",
    sessionKind: "QUALITY",
    idealPhases: ["BUILD", "PEAK"],
    levels: ["INTERMEDIATE", "ADVANCED"],
    energySystem: "AEROBIC_THRESHOLD",
    method: "Contínuo em limiar ou blocos longos (cruise intervals)",
    intensity: "RPE 7–8 · Z4 · ~ritmo de prova de 1h",
    description:
      "Esforço 'confortavelmente difícil' de 20–40 min, contínuo ou em blocos de 8–15 min com pausa curta.",
    durationMin: [40, 70],
    estimatedLoadPerHour: 75,
    contraindications: ["Fase de base pura", "Sem base aeróbica consolidada"],
    prerequisites: ["≥4 semanas de base aeróbica"],
    evidenceLevel: "A",
    references: ["Midgley et al. (2007), treino de limiar em corredores de endurance."],
  },
  {
    id: "run-vo2-intervals",
    modality: "RUNNING",
    title: "Intervalado VO₂máx",
    objective: "Maximizar consumo de oxigênio e potência aeróbica.",
    sessionKind: "QUALITY",
    idealPhases: ["BUILD", "PEAK"],
    levels: ["INTERMEDIATE", "ADVANCED"],
    energySystem: "VO2MAX",
    method: "Intervalado (3–5 min on / recuperação equivalente)",
    intensity: "RPE 8–9 · Z5 · ritmo de ~3–5 km",
    description:
      "Repetições de 3–5 min perto do VO₂máx com recuperação ativa. Alta demanda — teto de 1–2×/semana.",
    durationMin: [45, 70],
    estimatedLoadPerHour: 95,
    contraindications: ["Semana regenerativa", "Base insuficiente", "TSB muito negativo"],
    prerequisites: ["Bloco de limiar consolidado"],
    evidenceLevel: "A",
    references: ["Buchheit & Laursen (2013), interval training e resposta VO₂máx."],
  },
  {
    id: "run-recovery",
    modality: "RUNNING",
    title: "Regenerativo",
    objective: "Facilitar recuperação mantendo a mecânica, sem adicionar carga.",
    sessionKind: "RECOVERY",
    idealPhases: ["BASE", "BUILD", "PEAK", "TAPER", "TRANSITION"],
    levels: ["BEGINNER", "INTERMEDIATE", "ADVANCED"],
    energySystem: "AEROBIC_BASE",
    method: "Contínuo muito leve",
    intensity: "RPE 2–3 · Z1",
    description: "Trote curto e muito leve, ou caminhada/corrida, no dia seguinte a uma sessão dura.",
    durationMin: [20, 40],
    estimatedLoadPerHour: 20,
    contraindications: [],
    prerequisites: [],
    evidenceLevel: "C",
    references: ["Prática consagrada de recuperação ativa."],
  },

  // --------------------------------------------------------------- NATAÇÃO
  {
    id: "swim-technique",
    modality: "SWIMMING",
    title: "Técnica / educativos",
    objective: "Melhorar eficiência de nado e reduzir arrasto — ganho barato de velocidade.",
    sessionKind: "EASY",
    idealPhases: ["BASE", "BUILD", "TAPER"],
    levels: ["BEGINNER", "INTERMEDIATE", "ADVANCED"],
    energySystem: "NEUROMUSCULAR",
    method: "Drills + nado técnico com pausa",
    intensity: "RPE 3–5 · foco em execução, não em esforço",
    description: "Séries curtas de educativos alternadas com nado técnico; a qualidade é o gesto, não o ritmo.",
    durationMin: [30, 50],
    estimatedLoadPerHour: 30,
    contraindications: [],
    prerequisites: [],
    evidenceLevel: "B",
    references: ["Toussaint & Beek (1992), eficiência propulsiva no nado."],
  },
  {
    id: "swim-css-threshold",
    modality: "SWIMMING",
    title: "Limiar / CSS",
    objective: "Elevar o ritmo crítico de nado (Critical Swim Speed).",
    sessionKind: "QUALITY",
    idealPhases: ["BUILD", "PEAK"],
    levels: ["INTERMEDIATE", "ADVANCED"],
    energySystem: "AEROBIC_THRESHOLD",
    method: "Intervalado em ritmo CSS (ex.: 10–20×100m com pausa curta)",
    intensity: "RPE 7–8 · ritmo CSS",
    description: "Repetições no ritmo crítico com pausa de 10–20 s — sustentar o limiar por volume acumulado.",
    durationMin: [40, 60],
    estimatedLoadPerHour: 70,
    contraindications: ["Sem teste de CSS — prescrever por percepção e rebaixar confiança"],
    prerequisites: ["Base técnica mínima"],
    evidenceLevel: "B",
    references: ["Wakayoshi et al. (1992), Critical Swim Speed."],
  },
  {
    id: "swim-endurance",
    modality: "SWIMMING",
    title: "Volume aeróbico",
    objective: "Base aeróbica específica de nado.",
    sessionKind: "LONG",
    idealPhases: ["BASE", "BUILD"],
    levels: ["INTERMEDIATE", "ADVANCED"],
    energySystem: "AEROBIC_BASE",
    method: "Séries longas com pausa curta",
    intensity: "RPE 4–5",
    description: "Distância acumulada em ritmo confortável (ex.: 400–800m repetidos) para resistência aeróbica.",
    durationMin: [40, 70],
    estimatedLoadPerHour: 40,
    contraindications: ["Ombro doloroso (volume agrava)"],
    prerequisites: ["Nado contínuo de ≥400m"],
    evidenceLevel: "C",
    references: ["Prática consagrada de base aeróbica de nado."],
  },

  // --------------------------------------------------------------- CICLISMO
  {
    id: "bike-endurance",
    modality: "CYCLING",
    title: "Endurance (Z2)",
    objective: "Base aeróbica e economia — o pilar do volume no ciclismo.",
    sessionKind: "EASY",
    idealPhases: ["BASE", "BUILD", "PEAK"],
    levels: ["BEGINNER", "INTERMEDIATE", "ADVANCED"],
    energySystem: "AEROBIC_BASE",
    method: "Contínuo",
    intensity: "RPE 3–4 · Z2 · ~56–75% FTP",
    description: "Pedal contínuo em zona aeróbica; volume longo e sustentável, base do ciclista.",
    durationMin: [60, 240],
    estimatedLoadPerHour: 40,
    contraindications: [],
    prerequisites: [],
    evidenceLevel: "A",
    references: ["Seiler (2010); Coggan & Allen, zonas de potência."],
  },
  {
    id: "bike-sweet-spot",
    modality: "CYCLING",
    title: "Sweet spot",
    objective: "Ganho de FTP com boa relação estímulo/fadiga.",
    sessionKind: "QUALITY",
    idealPhases: ["BUILD"],
    levels: ["INTERMEDIATE", "ADVANCED"],
    energySystem: "AEROBIC_THRESHOLD",
    method: "Blocos de 8–20 min",
    intensity: "RPE 6–7 · ~88–94% FTP",
    description: "Blocos logo abaixo do limiar — alto retorno de FTP sem o custo do trabalho em limiar pleno.",
    durationMin: [60, 90],
    estimatedLoadPerHour: 70,
    contraindications: ["Base insuficiente"],
    prerequisites: ["≥3 semanas de endurance"],
    evidenceLevel: "B",
    references: ["Coggan & Allen, Training and Racing with a Power Meter."],
  },
  {
    id: "bike-vo2",
    modality: "CYCLING",
    title: "Intervalado VO₂máx",
    objective: "Potência aeróbica máxima.",
    sessionKind: "QUALITY",
    idealPhases: ["BUILD", "PEAK"],
    levels: ["INTERMEDIATE", "ADVANCED"],
    energySystem: "VO2MAX",
    method: "Intervalado (3–5 min on / recuperação equivalente)",
    intensity: "RPE 8–9 · ~106–120% FTP",
    description: "Repetições curtas e intensas perto do VO₂máx; teto de 1–2×/semana pela demanda.",
    durationMin: [50, 75],
    estimatedLoadPerHour: 90,
    contraindications: ["Semana regenerativa", "TSB muito negativo"],
    prerequisites: ["Bloco de sweet spot/limiar"],
    evidenceLevel: "A",
    references: ["Buchheit & Laursen (2013)."],
  },

  // --------------------------------------------------------------- FORÇA
  {
    id: "strength-hypertrophy",
    modality: "STRENGTH",
    title: "Hipertrofia / resistência de força",
    objective: "Base estrutural e resistência muscular.",
    sessionKind: "STRENGTH",
    idealPhases: ["BASE", "TRANSITION"],
    levels: ["BEGINNER", "INTERMEDIATE", "ADVANCED"],
    energySystem: "MIXED",
    method: "3–4 séries de 8–12 reps, RIR 2–3",
    intensity: "~65–75% 1RM (se houver teste) ou por RIR",
    description: "Multiarticulares em volume moderado-alto para base estrutural antes das fases de força.",
    durationMin: [45, 70],
    estimatedLoadPerHour: 50,
    contraindications: ["Lesão articular ativa"],
    prerequisites: ["Padrões de movimento competentes"],
    evidenceLevel: "A",
    references: ["Schoenfeld et al. (2017), volume e hipertrofia."],
  },
  {
    id: "strength-max",
    modality: "STRENGTH",
    title: "Força máxima",
    objective: "Elevar força máxima e recrutamento neural.",
    sessionKind: "STRENGTH",
    idealPhases: ["BUILD"],
    levels: ["INTERMEDIATE", "ADVANCED"],
    energySystem: "NEUROMUSCULAR",
    method: "4–6 séries de 3–6 reps, RIR 1–2, pausas longas",
    intensity: "~80–90% 1RM",
    description: "Cargas altas, baixas repetições e recuperação plena entre séries — força e economia.",
    durationMin: [50, 80],
    estimatedLoadPerHour: 60,
    contraindications: ["Sem base de hipertrofia", "Técnica instável nos básicos"],
    prerequisites: ["Bloco de hipertrofia/adaptação anatômica"],
    evidenceLevel: "A",
    references: ["Suchomel et al. (2018), importância da força para performance."],
  },
  {
    id: "strength-core-stability",
    modality: "FUNCTIONAL",
    title: "Core e estabilidade",
    objective: "Estabilidade de tronco e prevenção — complemento de baixo custo.",
    sessionKind: "STRENGTH",
    idealPhases: ["BASE", "BUILD", "PEAK", "TAPER", "TRANSITION"],
    levels: ["BEGINNER", "INTERMEDIATE", "ADVANCED"],
    energySystem: "NEUROMUSCULAR",
    method: "Isometrias + anti-rotação, 2–3 séries",
    intensity: "RPE 5–6",
    description: "Prancha, anti-rotação e unilaterais — complemento em dias leves, baixo impacto na fadiga.",
    durationMin: [15, 30],
    estimatedLoadPerHour: 30,
    contraindications: [],
    prerequisites: [],
    evidenceLevel: "B",
    references: ["Prática consagrada de treino de core em atletas de endurance."],
  },
];

// --------------------------------------------------------------------------
// Consultas puras.
// --------------------------------------------------------------------------

/** Disciplinas que compõem o triathlon — a consulta por TRIATHLON une as três. */
const TRI_DISCIPLINES: Modality[] = ["SWIMMING", "CYCLING", "RUNNING"];

function matchesModality(session: CatalogSession, modality: Modality): boolean {
  if (modality === "TRIATHLON") return TRI_DISCIPLINES.includes(session.modality);
  return session.modality === modality;
}

/** Todas as sessões do catálogo (cópia rasa — o catálogo é imutável). */
export function allSessions(): CatalogSession[] {
  return [...SESSIONS];
}

export function getSession(id: string): CatalogSession | null {
  return SESSIONS.find((s) => s.id === id) ?? null;
}

/** Filtra o catálogo pelos critérios informados (ausente = não filtra). */
export function querySessions(query: SessionQuery = {}): CatalogSession[] {
  return SESSIONS.filter((s) => {
    if (query.modality && !matchesModality(s, query.modality)) return false;
    if (query.phase && !s.idealPhases.includes(query.phase)) return false;
    if (query.level && !s.levels.includes(query.level)) return false;
    if (query.sessionKind && s.sessionKind !== query.sessionKind) return false;
    if (query.energySystem && s.energySystem !== query.energySystem) return false;
    return true;
  });
}

/**
 * Recomenda sessões do catálogo para um contexto de treino — a ponte que a
 * Fase 3 usa para explicar uma sugestão a partir de dados reais (fase + nível +
 * tipo de sessão). Ordena por especificidade: menos fases ideais = mais
 * específica para esta fase, então vem primeiro.
 */
export function recommendSessions(criteria: {
  modality: Modality;
  phase: PhaseKind;
  level?: AthleteLevel;
  sessionKind?: SessionKind;
}): CatalogSession[] {
  const matches = querySessions({
    modality: criteria.modality,
    phase: criteria.phase,
    level: criteria.level,
    sessionKind: criteria.sessionKind,
  });
  return matches.sort((a, b) => a.idealPhases.length - b.idealPhases.length);
}
