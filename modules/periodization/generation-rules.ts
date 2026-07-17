import type { WorkoutBlockInput } from "@/modules/workouts/prescription-schema";

// ============================================================================
// MOTOR DE GERAÇÃO ASSISTIDA — núcleo PURO e VERSIONADO (Fase 6).
// ============================================================================
// Transforma o contexto de UMA semana da periodização em sessões de treino.
// Não toca no banco, não conhece Prisma: por isso é testável por modalidade
// sem fixture. A persistência (DRAFT + GenerationBatch) vive em
// generate-week.ts.
//
// POSTURA CIENTÍFICA (não negociável — ver README):
//  - O motor propõe, o treinador dispõe. Toda sessão nasce DRAFT.
//  - Não vendemos precisão falsa: sem dados de teste (pace/FTP/CSS), a
//    intensidade é prescrita em RPE (percepção), nunca em pace/potência
//    "calculados" que fingiriam uma precisão que não temos.
//  - Faltou dado? Geramos assim mesmo, com confiança REBAIXADA e o dado
//    ausente listado em `missingData` — nunca silenciosamente.
//  - ACWR NÃO é consumido aqui. Ele é descritivo (modules/intelligence/
//    load-state.ts) e não tem validade como preditor isolado de lesão;
//    usá-lo para decidir volume seria exatamente o erro que a literatura
//    aponta.
//  - Toda regra carrega `version`. Mudou a fórmula? Sobe a versão da regra E
//    o ALGORITHM_VERSION. Assim um treino gerado no passado continua
//    explicável pela regra que de fato o gerou.

export const ALGORITHM_VERSION = "gen-v1";
export const RATIONALE_VERSION = "rationale-v1";

export type Modality = "RUNNING" | "SWIMMING" | "CYCLING" | "TRIATHLON" | "STRENGTH" | "FUNCTIONAL";
export type AthleteLevel = "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
export type PhaseKind = "BASE" | "BUILD" | "PEAK" | "TAPER" | "TRANSITION";
export type SessionKind = "EASY" | "LONG" | "QUALITY" | "RECOVERY" | "STRENGTH";
export type ConfidenceLevel = "LOW" | "MODERATE" | "HIGH";

export interface WeekContext {
  goal: string;
  modality: Modality;
  level?: AthleteLevel;
  /** Dias ISO em que o atleta pode treinar (1=segunda … 7=domingo). */
  availableWeekdays: number[];
  phaseName?: string;
  isRecoveryWeek: boolean;
  /** Volume alvo da semana SEMPRE em km. Natação: 8 => 8000 m. */
  targetVolumeKm?: number;
  targetIntensity?: string;
  weekStartDate: string; // YYYY-MM-DD
  weekEndDate: string; // YYYY-MM-DD
  includeStrength: boolean;
}

export interface PlannedSession {
  plannedDate: string; // YYYY-MM-DD
  modality: Modality;
  kind: SessionKind;
  title: string;
  description: string;
  blocks: WorkoutBlockInput[];
}

export interface AppliedRule {
  id: string;
  version: string;
  explanation: string;
}

export interface GenerationRationale {
  algorithmVersion: string;
  rationaleVersion: string;
  phaseKind: PhaseKind;
  phaseMatched: boolean;
  weekVolumeKm: number | null;
  rules: AppliedRule[];
  missingData: string[];
  caveats: string[];
}

export interface WeekPlan {
  sessions: PlannedSession[];
  confidence: ConfidenceLevel;
  rationale: GenerationRationale;
}

const DAY_MS = 86_400_000;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function isEndurance(modality: Modality): boolean {
  return modality !== "STRENGTH" && modality !== "FUNCTIONAL";
}

// ---------------------------------------------------------------------------
// Regra 1 — classificação da fase. `PeriodizationPhase.name` é texto livre
// (o treinador escreve o que quiser), então casamos por palavra-chave sobre o
// nome normalizado. Sem casamento => tratamos como BASE (a fase mais
// conservadora) e rebaixamos a confiança: chutar BUILD num nome desconhecido
// seria inventar intensidade que ninguém pediu.
// ---------------------------------------------------------------------------
const PHASE_KEYWORDS: [PhaseKind, RegExp][] = [
  ["TRANSITION", /transic|regener|descanso|off|recuper/],
  ["TAPER", /taper|polimento|afinamento/],
  ["PEAK", /pico|peak|competi|prova/],
  ["BUILD", /build|especific|desenvolv|construc/],
  ["BASE", /base|fundac|aerobic|geral|acumul/],
];

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "") // "Específico" e "Especifico" caem na mesma regra
    .toLowerCase();
}

export function classifyPhase(name?: string): { kind: PhaseKind; matched: boolean } {
  if (!name?.trim()) return { kind: "BASE", matched: false };
  const normalized = normalize(name);
  for (const [kind, pattern] of PHASE_KEYWORDS) {
    if (pattern.test(normalized)) return { kind, matched: true };
  }
  return { kind: "BASE", matched: false };
}

// ---------------------------------------------------------------------------
// Regra 2 — perfil da fase: quanto do volume alvo é de fato prescrito, quantas
// sessões de qualidade cabem e em que RPE. Distribuição polarizada (maioria do
// volume em baixa intensidade, minoria em alta) — consenso em endurance para
// atletas que treinam >=4x/semana, aqui aplicado de forma conservadora.
// `qualityMax` é TETO, não meta: a disponibilidade e o nível ainda podem
// reduzi-lo.
// ---------------------------------------------------------------------------
interface PhaseProfile {
  qualityMax: number;
  volumeFactor: number;
  qualityRpe: [number, number];
  longShare: number;
  /** Série principal curta e forte (true) ou longa e moderada (false). */
  sharpIntervals: boolean;
}

const PHASE_PROFILES: Record<PhaseKind, PhaseProfile> = {
  // Base: volume integral, qualidade só como estímulo de manutenção (tempo
  // longo em RPE moderado), sem tiros curtos.
  BASE: {
    qualityMax: 1,
    volumeFactor: 1,
    qualityRpe: [6, 7],
    longShare: 0.3,
    sharpIntervals: false,
  },
  // Build: volume integral + a maior densidade de qualidade do ciclo.
  BUILD: {
    qualityMax: 2,
    volumeFactor: 1,
    qualityRpe: [7, 8],
    longShare: 0.3,
    sharpIntervals: true,
  },
  // Pico: volume levemente reduzido, qualidade específica de prova.
  PEAK: {
    qualityMax: 2,
    volumeFactor: 0.95,
    qualityRpe: [8, 9],
    longShare: 0.25,
    sharpIntervals: true,
  },
  // Taper: corta VOLUME, preserva INTENSIDADE — reduzir os dois desmonta a
  // adaptação que o ciclo construiu.
  TAPER: {
    qualityMax: 1,
    volumeFactor: 0.55,
    qualityRpe: [8, 9],
    longShare: 0.2,
    sharpIntervals: true,
  },
  // Transição: só volume fácil, zero qualidade.
  TRANSITION: {
    qualityMax: 0,
    volumeFactor: 0.5,
    qualityRpe: [3, 4],
    longShare: 0.2,
    sharpIntervals: false,
  },
};

// ---------------------------------------------------------------------------
// Regra 3 — tetos por nível. Iniciante não sustenta 6 sessões nem 3 sessões de
// qualidade, por mais que a agenda diga que dá.
// ---------------------------------------------------------------------------
const LEVEL_CAPS: Record<AthleteLevel, { sessions: number; quality: number }> = {
  BEGINNER: { sessions: 4, quality: 1 },
  INTERMEDIATE: { sessions: 6, quality: 2 },
  ADVANCED: { sessions: 10, quality: 3 },
};

// Volume semanal padrão (km) quando o treinador não definiu alvo na semana nem
// na fase. É um CHUTE EDUCADO e assumido como tal: dispara confiança LOW.
const DEFAULT_VOLUME_KM: Record<Modality, Record<AthleteLevel, number>> = {
  RUNNING: { BEGINNER: 20, INTERMEDIATE: 40, ADVANCED: 65 },
  SWIMMING: { BEGINNER: 4, INTERMEDIATE: 8, ADVANCED: 14 },
  CYCLING: { BEGINNER: 60, INTERMEDIATE: 140, ADVANCED: 250 },
  TRIATHLON: { BEGINNER: 60, INTERMEDIATE: 150, ADVANCED: 260 },
  STRENGTH: { BEGINNER: 0, INTERMEDIATE: 0, ADVANCED: 0 },
  FUNCTIONAL: { BEGINNER: 0, INTERMEDIATE: 0, ADVANCED: 0 },
};

// Semana regenerativa: 60% do volume e ZERO qualidade. A semana regenerativa
// existe para absorver a carga anterior; manter tiros nela anula o propósito.
const RECOVERY_VOLUME_FACTOR = 0.6;

// Divisão do volume (km) do triathlon entre as três modalidades. ATENÇÃO: um
// único alvo escalar em km não é divisível entre nado/pedal/corrida sem
// arbitrar — 1 km de nado não custa o mesmo que 1 km de pedal. Estes números
// refletem uma semana típica de age-grouper, mas SÃO uma suposição: por isso
// triathlon nunca passa de confiança MODERATE.
const TRI_VOLUME_SHARE: Record<"SWIMMING" | "CYCLING" | "RUNNING", number> = {
  SWIMMING: 0.05,
  CYCLING: 0.72,
  RUNNING: 0.23,
};

// Distância da repetição na série principal, por modalidade (metros).
const EFFORT_DISTANCE_M: Record<
  "RUNNING" | "SWIMMING" | "CYCLING",
  { long: number; sharp: number }
> = {
  RUNNING: { long: 1000, sharp: 400 },
  SWIMMING: { long: 200, sharp: 100 },
  CYCLING: { long: 5000, sharp: 2000 },
};

// Pausa entre repetições (segundos). Nado usa pausa curta na borda; pedal
// precisa de mais tempo para reciclar o esforço.
const RECOVERY_SECONDS: Record<"RUNNING" | "SWIMMING" | "CYCLING", number> = {
  RUNNING: 90,
  SWIMMING: 20,
  CYCLING: 180,
};

const MODALITY_LABEL: Record<Modality, string> = {
  RUNNING: "Corrida",
  SWIMMING: "Natação",
  CYCLING: "Ciclismo",
  TRIATHLON: "Triathlon",
  STRENGTH: "Força",
  FUNCTIONAL: "Funcional",
};

// ---------------------------------------------------------------------------
// Datas: mapeia dias ISO disponíveis para as datas reais dentro da janela da
// semana. A última semana do plano pode ser parcial, então varremos a janela
// real em vez de assumir 7 dias.
// ---------------------------------------------------------------------------
function resolveSessionDates(context: WeekContext): string[] {
  const start = Date.parse(`${context.weekStartDate}T00:00:00.000Z`);
  const end = Date.parse(`${context.weekEndDate}T00:00:00.000Z`);
  const allowed = new Set(context.availableWeekdays);
  const dates: string[] = [];
  for (let cursor = start; cursor <= end; cursor += DAY_MS) {
    const date = new Date(cursor);
    const isoWeekday = ((date.getUTCDay() + 6) % 7) + 1; // 1=segunda … 7=domingo
    if (allowed.has(isoWeekday)) dates.push(date.toISOString().slice(0, 10));
  }
  return dates;
}

// ---------------------------------------------------------------------------
// Regra 4 — mix da semana: qual sessão em qual dia.
// O longão vai no último dia disponível (tipicamente fim de semana) e as
// sessões de qualidade são espalhadas entre os demais.
// ---------------------------------------------------------------------------
function buildSessionKinds(
  dayCount: number,
  profile: PhaseProfile,
  levelCap: { sessions: number; quality: number },
  isRecoveryWeek: boolean,
): SessionKind[] {
  const count = Math.min(dayCount, levelCap.sessions);
  if (count === 0) return [];

  if (isRecoveryWeek) {
    // Regenerativa: tudo fácil, sem longão e sem qualidade.
    return Array.from({ length: count }, () => "RECOVERY" as SessionKind);
  }

  const kinds: SessionKind[] = Array.from({ length: count }, () => "EASY");
  const hasLong = count >= 3 && profile.longShare > 0 && profile.qualityMax >= 0;
  if (hasLong) kinds[count - 1] = "LONG";

  // Sobram pelo menos 2 sessões fáceis entre as de qualidade — nunca
  // transformamos a semana inteira em qualidade.
  const qualityCount = Math.min(profile.qualityMax, levelCap.quality, Math.max(0, count - 2));
  const pool = kinds.map((_, i) => i).filter((i) => kinds[i] === "EASY");
  for (let i = 0; i < qualityCount; i += 1) {
    // ponytail: espaçamento aritmético simples — não garante 48h entre
    // sessões duras se a agenda for muito comprimida. Trocar por um
    // espaçador com restrição real se virar queixa do treinador.
    const slot = pool[Math.floor(((i + 1) * pool.length) / (qualityCount + 1))];
    if (slot !== undefined) kinds[slot] = "QUALITY";
  }
  return kinds;
}

// Regra 5 — fatia do volume por sessão. Sempre normalizada para somar 1, então
// a soma das sessões bate com o volume alvo por construção.
function volumeShares(kinds: SessionKind[], longShare: number): number[] {
  const QUALITY_SHARE = 0.15;
  const raw = kinds.map((kind) =>
    kind === "LONG" ? longShare : kind === "QUALITY" ? QUALITY_SHARE : 0.12,
  );
  const total = raw.reduce((sum, value) => sum + value, 0);
  return total > 0 ? raw.map((value) => value / total) : raw;
}

function rpeFor(kind: SessionKind, profile: PhaseProfile): [number, number] {
  if (kind === "QUALITY") return profile.qualityRpe;
  if (kind === "RECOVERY") return [2, 3];
  if (kind === "LONG") return [4, 5];
  return [3, 4];
}

// ---------------------------------------------------------------------------
// Construtores de conteúdo por modalidade.
// ---------------------------------------------------------------------------
function enduranceBlocks(
  discipline: "RUNNING" | "SWIMMING" | "CYCLING",
  kind: SessionKind,
  distanceM: number,
  profile: PhaseProfile,
): WorkoutBlockInput[] {
  const [rpeMin, rpeMax] = rpeFor(kind, profile);

  if (kind !== "QUALITY") {
    return [
      {
        name: kind === "LONG" ? "Volume contínuo" : "Rodagem contínua",
        repetitions: 1,
        steps: [
          {
            stepType: "RODAGEM",
            distanceMeters: Math.max(200, Math.round(distanceM)),
            targetType: "RPE",
            targetMin: rpeMin,
            targetMax: rpeMax,
          },
        ],
        exercises: [],
      },
    ];
  }

  const efforts = EFFORT_DISTANCE_M[discipline];
  const repDistance = profile.sharpIntervals ? efforts.sharp : efforts.long;
  // 60% da sessão vira série principal; o resto é aquecimento + volta à calma.
  const repetitions = clamp(Math.round((distanceM * 0.6) / repDistance), 3, 12);
  const warmup = Math.max(200, Math.round(distanceM * 0.2));

  return [
    {
      name: "Aquecimento",
      repetitions: 1,
      steps: [
        {
          stepType: "RODAGEM",
          distanceMeters: warmup,
          targetType: "RPE",
          targetMin: 3,
          targetMax: 4,
        },
      ],
      exercises: [],
    },
    {
      name: `Série principal — ${repetitions}x${repDistance}m`,
      repetitions,
      steps: [
        {
          stepType: "TIRO",
          distanceMeters: repDistance,
          targetType: "RPE",
          targetMin: rpeMin,
          targetMax: rpeMax,
        },
        { stepType: "PAUSA_ATIVA", durationSeconds: RECOVERY_SECONDS[discipline] },
      ],
      exercises: [],
    },
    {
      name: "Volta à calma",
      repetitions: 1,
      steps: [
        {
          stepType: "RODAGEM",
          distanceMeters: warmup,
          targetType: "RPE",
          targetMin: 2,
          targetMax: 3,
        },
      ],
      exercises: [],
    },
  ];
}

// Força: prescrita em séries/reps/RIR, nunca em %1RM — sem teste de 1RM no
// sistema, um percentual seria precisão inventada.
const STRENGTH_PROFILES: Record<
  PhaseKind,
  { sets: number; reps: number; rir: number; focus: string }
> = {
  BASE: { sets: 3, reps: 12, rir: 3, focus: "resistência de força" },
  BUILD: { sets: 4, reps: 6, rir: 2, focus: "força máxima" },
  PEAK: { sets: 3, reps: 5, rir: 3, focus: "manutenção neural" },
  TAPER: { sets: 2, reps: 6, rir: 4, focus: "manutenção leve" },
  TRANSITION: { sets: 2, reps: 12, rir: 4, focus: "reeducação de movimento" },
};

function strengthBlocks(phaseKind: PhaseKind, isRecoveryWeek: boolean): WorkoutBlockInput[] {
  const base = STRENGTH_PROFILES[phaseKind];
  // Semana regenerativa rebaixa a força junto com o endurance — não adianta
  // cortar volume de corrida e manter 4x6 de agachamento pesado.
  const profile = isRecoveryWeek ? STRENGTH_PROFILES.TRANSITION : base;

  return [
    {
      name: `Bloco principal — ${profile.focus}`,
      repetitions: 1,
      steps: [],
      exercises: [
        {
          exerciseName: "Agachamento livre",
          exerciseCategory: "força",
          sets: profile.sets,
          reps: profile.reps,
          rir: profile.rir,
          restSeconds: 120,
        },
        {
          exerciseName: "Levantamento terra romeno",
          exerciseCategory: "força",
          sets: profile.sets,
          reps: profile.reps,
          rir: profile.rir,
          restSeconds: 120,
        },
        {
          exerciseName: "Afundo com halteres",
          exerciseCategory: "força",
          sets: Math.max(2, profile.sets - 1),
          reps: profile.reps,
          rir: profile.rir,
          restSeconds: 90,
        },
      ],
    },
    {
      name: "Core e estabilidade",
      repetitions: 1,
      steps: [],
      exercises: [
        {
          exerciseName: "Prancha frontal",
          exerciseCategory: "core",
          sets: 3,
          durationSeconds: 40,
          restSeconds: 45,
        },
        {
          exerciseName: "Elevação de panturrilha",
          exerciseCategory: "força",
          sets: 3,
          reps: 15,
          rir: 3,
          restSeconds: 60,
        },
      ],
    },
  ];
}

function sessionTitle(modality: Modality, kind: SessionKind): string {
  const label = MODALITY_LABEL[modality];
  const suffix: Record<SessionKind, string> = {
    EASY: "rodagem leve",
    LONG: "longão",
    QUALITY: "série principal",
    RECOVERY: "regenerativo",
    STRENGTH: "força complementar",
  };
  return `${label} — ${suffix[kind]}`;
}

// Triathlon: rotação nado → pedal → corrida pelos dias, com o longão sempre no
// pedal (a sessão mais longa da semana do triatleta).
const TRI_ROTATION = ["SWIMMING", "CYCLING", "RUNNING"] as const;

function triathlonDiscipline(index: number, kind: SessionKind): "SWIMMING" | "CYCLING" | "RUNNING" {
  if (kind === "LONG") return "CYCLING";
  return TRI_ROTATION[index % TRI_ROTATION.length] ?? "RUNNING";
}

// ---------------------------------------------------------------------------
// planWeek — entrada única do motor.
// ---------------------------------------------------------------------------
export function planWeek(context: WeekContext): WeekPlan {
  const rules: AppliedRule[] = [];
  const missingData: string[] = [];
  const caveats: string[] = [];

  const phase = classifyPhase(context.phaseName);
  const profile = PHASE_PROFILES[phase.kind];
  rules.push({
    id: "phase-classification",
    version: "1",
    explanation: phase.matched
      ? `Fase "${context.phaseName}" classificada como ${phase.kind}: define teto de qualidade (${profile.qualityMax}) e fator de volume (${profile.volumeFactor}).`
      : `Fase não informada ou não reconhecida — assumida BASE (a mais conservadora). Renomeie a fase com base/build/pico/taper/transição para uma prescrição mais específica.`,
  });
  if (!phase.matched) missingData.push("phaseName");

  const level = context.level ?? "INTERMEDIATE";
  if (!context.level) {
    missingData.push("level");
    caveats.push("Nível do atleta não informado — assumido INTERMEDIATE.");
  }
  const levelCap = LEVEL_CAPS[level];
  rules.push({
    id: "level-caps",
    version: "1",
    explanation: `Nível ${level}: no máximo ${levelCap.sessions} sessões e ${levelCap.quality} sessão(ões) de qualidade por semana.`,
  });

  const dates = resolveSessionDates(context);
  if (dates.length === 0) {
    caveats.push("Nenhum dia disponível cai dentro da janela desta semana — nada foi gerado.");
  }

  const kinds = buildSessionKinds(dates.length, profile, levelCap, context.isRecoveryWeek);
  rules.push({
    id: "week-mix",
    version: "1",
    explanation: context.isRecoveryWeek
      ? `Semana regenerativa: ${kinds.length} sessão(ões), todas em baixa intensidade, sem longão e sem qualidade.`
      : `${kinds.length} sessão(ões): ${kinds.filter((k) => k === "QUALITY").length} de qualidade, ${kinds.filter((k) => k === "LONG").length} longão, o restante em baixa intensidade (distribuição polarizada).`,
  });

  // --- Volume ---------------------------------------------------------------
  const endurance = isEndurance(context.modality);
  let weekVolumeKm: number | null = null;

  if (endurance) {
    let baseVolume = context.targetVolumeKm;
    if (baseVolume === undefined || baseVolume === null) {
      baseVolume = DEFAULT_VOLUME_KM[context.modality][level];
      missingData.push("targetVolume");
      caveats.push(
        `Volume alvo ausente na semana e na fase — usado um padrão de referência (${baseVolume} km para ${level}). Defina o volume alvo para a prescrição deixar de ser um chute.`,
      );
    }
    const recoveryFactor = context.isRecoveryWeek ? RECOVERY_VOLUME_FACTOR : 1;
    weekVolumeKm = baseVolume * profile.volumeFactor * recoveryFactor;
    rules.push({
      id: "week-volume",
      version: "1",
      explanation: `Volume da semana = ${baseVolume} km × ${profile.volumeFactor} (fase ${phase.kind})${context.isRecoveryWeek ? ` × ${RECOVERY_VOLUME_FACTOR} (semana regenerativa)` : ""} = ${weekVolumeKm.toFixed(1)} km.`,
    });
    rules.push({
      id: "intensity-prescription",
      version: "1",
      explanation:
        "Intensidade prescrita em RPE (percepção de esforço). Sem testes de pace/FTP/CSS no sistema, prescrever ritmo ou potência exatos seria inventar precisão.",
    });
  }

  if (context.targetIntensity?.trim()) {
    rules.push({
      id: "trainer-intensity-note",
      version: "1",
      explanation: `Intensidade alvo definida pelo treinador na semana ("${context.targetIntensity}") — mantida como nota; o motor não a converte em zonas automaticamente.`,
    });
  }

  // --- Sessões --------------------------------------------------------------
  // Cada "slot" junta tudo que uma sessão precisa (dia, tipo, fatia de volume,
  // disciplina) num objeto só. `kinds` nunca é mais longo que `dates` — vem de
  // buildSessionKinds(dates.length, ...) — então o pareamento por índice é
  // resolvido aqui, uma vez, e o resto do motor trabalha com valores.
  const shares = volumeShares(kinds, profile.longShare);
  const slots = kinds.map((kind, i) => ({
    kind,
    date: dates[i] ?? context.weekStartDate,
    share: shares[i] ?? 0,
    // Para triathlon cada sessão tem sua própria disciplina; para as demais, a
    // disciplina é a própria modalidade.
    discipline:
      context.modality === "TRIATHLON"
        ? triathlonDiscipline(i, kind)
        : (context.modality as "RUNNING" | "SWIMMING" | "CYCLING"),
  }));
  const sessions: PlannedSession[] = [];

  if (endurance) {
    if (context.modality === "TRIATHLON") {
      caveats.push(
        "Volume alvo do triathlon veio como um único valor em km e foi dividido entre nado/pedal/corrida por uma proporção de referência. Km não são equivalentes entre disciplinas — revise o volume de cada sessão.",
      );
      rules.push({
        id: "triathlon-split",
        version: "1",
        explanation: `Divisão do volume entre disciplinas: nado ${TRI_VOLUME_SHARE.SWIMMING * 100}%, pedal ${TRI_VOLUME_SHARE.CYCLING * 100}%, corrida ${TRI_VOLUME_SHARE.RUNNING * 100}% dos km da semana. Rotação nado→pedal→corrida entre os dias, longão sempre no pedal.`,
      });
    }

    for (const slot of slots) {
      let sessionKm: number;

      if (context.modality === "TRIATHLON") {
        // Cada disciplina recebe sua cota de km e a divide entre as sessões
        // dela, na proporção das fatias já calculadas.
        const disciplineTotal = slots
          .filter((other) => other.discipline === slot.discipline)
          .reduce((sum, other) => sum + other.share, 0);
        const disciplineKm = (weekVolumeKm ?? 0) * TRI_VOLUME_SHARE[slot.discipline];
        sessionKm = disciplineTotal > 0 ? (disciplineKm * slot.share) / disciplineTotal : 0;
      } else {
        sessionKm = (weekVolumeKm ?? 0) * slot.share;
      }

      const sessionModality: Modality =
        context.modality === "TRIATHLON" ? slot.discipline : context.modality;
      sessions.push({
        plannedDate: slot.date,
        modality: sessionModality,
        kind: slot.kind,
        title: sessionTitle(sessionModality, slot.kind),
        description: `${context.goal} · fase ${phase.kind}${context.isRecoveryWeek ? " · semana regenerativa" : ""} · ~${sessionKm.toFixed(1)} km · RPE ${rpeFor(slot.kind, profile).join("–")}. Rascunho gerado — revise antes de publicar.`,
        blocks: enduranceBlocks(slot.discipline, slot.kind, sessionKm * 1000, profile),
      });
    }
  } else {
    // Força/funcional como modalidade principal do plano.
    for (const slot of slots) {
      sessions.push({
        plannedDate: slot.date,
        modality: context.modality,
        kind: slot.kind === "QUALITY" ? "STRENGTH" : slot.kind,
        title: sessionTitle(context.modality, "STRENGTH"),
        description: `${context.goal} · fase ${phase.kind} · ${STRENGTH_PROFILES[phase.kind].focus}. Rascunho gerado — revise antes de publicar.`,
        blocks: strengthBlocks(phase.kind, context.isRecoveryWeek),
      });
    }
  }

  // --- Força como complemento ----------------------------------------------
  if (context.includeStrength && endurance && sessions.length > 0) {
    // Força entra nos dias FÁCEIS: nunca na véspera do longão (que fica no
    // último dia) e nunca somada a uma sessão de qualidade.
    const maxStrength = context.isRecoveryWeek || phase.kind !== "BASE" ? 1 : 2;
    const easySlots = slots
      .filter((slot) => slot.kind === "EASY" || slot.kind === "RECOVERY")
      .slice(0, maxStrength);

    for (const slot of easySlots) {
      sessions.push({
        plannedDate: slot.date,
        modality: "FUNCTIONAL",
        kind: "STRENGTH",
        title: sessionTitle("FUNCTIONAL", "STRENGTH"),
        description: `Complemento de força · fase ${phase.kind} · ${STRENGTH_PROFILES[phase.kind].focus}. Rascunho gerado — revise antes de publicar.`,
        blocks: strengthBlocks(phase.kind, context.isRecoveryWeek),
      });
    }

    rules.push({
      id: "strength-complement",
      version: "1",
      explanation: `${easySlots.length} sessão(ões) de força complementar em dias de baixa intensidade (${STRENGTH_PROFILES[phase.kind].focus}), fora da véspera do longão e nunca no mesmo dia de uma sessão de qualidade.`,
    });
  }

  // --- Confiança ------------------------------------------------------------
  // Regra: a confiança é o MENOR teto disparado. Nunca prometemos mais
  // precisão do que os dados de entrada sustentam.
  let confidence: ConfidenceLevel = "HIGH";
  const downgrade = (next: ConfidenceLevel) => {
    const order: ConfidenceLevel[] = ["LOW", "MODERATE", "HIGH"];
    if (order.indexOf(next) < order.indexOf(confidence)) confidence = next;
  };

  if (missingData.includes("targetVolume")) downgrade("LOW");
  if (!context.level) downgrade("MODERATE");
  if (!phase.matched) downgrade("MODERATE");
  if (context.modality === "TRIATHLON") downgrade("MODERATE");
  if (dates.length < 2) {
    downgrade("LOW");
    if (dates.length > 0)
      caveats.push("Menos de dois dias disponíveis — a semana não permite estrutura real.");
  }

  rules.push({
    id: "confidence",
    version: "1",
    explanation: `Confiança ${confidence}.${missingData.length > 0 ? ` Dados ausentes: ${missingData.join(", ")}.` : " Todos os dados de entrada presentes."} Confiança alta significa que o motor tinha os dados que a regra pede — não que a prescrição está certa para este atleta. A revisão do treinador é obrigatória.`,
  });

  caveats.push(
    "ACWR não foi usado para decidir volume ou intensidade: não há suporte para tratá-lo como preditor isolado de lesão.",
  );

  return {
    sessions,
    confidence,
    rationale: {
      algorithmVersion: ALGORITHM_VERSION,
      rationaleVersion: RATIONALE_VERSION,
      phaseKind: phase.kind,
      phaseMatched: phase.matched,
      weekVolumeKm,
      rules,
      missingData,
      caveats,
    },
  };
}
