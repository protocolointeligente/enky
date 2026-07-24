import {
  type WeekContext,
} from "@/modules/periodization/generation-rules";
import type {
  AppliedRule,
  ConfidenceLevel,
  MacrocycleResult,
  MesocycleBlock,
  MicrocycleWeek,
  StrategicInputs,
} from "./periodization-engine-types";
import {
  DEFAULT_BASE_VOLUME_KM,
  PHASE_STRATEGY,
  STRATEGY_REFERENCES,
  STRATEGY_VERSION,
  deloadEveryNWeeks,
  isEndurance,
  loadWaveMultiplier,
  phaseSpans,
  taperWeeks,
  totalWeeksBetween,
  windowGuard,
} from "./strategy-rules";

// ============================================================================
// buildMacrocycle — ENTRADA ÚNICA do motor estratégico (Fase 1).
// ============================================================================
// Recebe as entradas do atleta/objetivo e devolve o macrociclo completo:
// mesociclos (fases), microciclos (semanas com fase, deload e volume-alvo) e a
// racionalização versionada. Puro e determinístico — testável sem banco.
//
// Fluxo: janela → fases → semanas → deload → onda de carga → confiança.

const DAY_MS = 86_400_000;

function addDaysISO(startISO: string, days: number): string {
  return new Date(Date.parse(`${startISO}T00:00:00.000Z`) + days * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

// Semana N (1-based) começa N-1 semanas após o início. A última semana é aparada
// na data da prova.
function weekWindow(startISO: string, eventISO: string, sequence: number): {
  startDate: string;
  endDate: string;
} {
  const startDate = addDaysISO(startISO, (sequence - 1) * 7);
  const rawEnd = addDaysISO(startDate, 6);
  const endDate = rawEnd > eventISO ? eventISO : rawEnd;
  return { startDate, endDate };
}

export function buildMacrocycle(inputs: StrategicInputs): MacrocycleResult {
  // --- Regra S1: janela ------------------------------------------------------
  if (inputs.eventDate <= inputs.startDate) {
    return {
      ok: false,
      error: {
        code: "INVALID_WINDOW",
        message: "A data da prova deve ser posterior à data de início do plano.",
      },
    };
  }
  const totalWeeks = totalWeeksBetween(inputs.startDate, inputs.eventDate);
  const guard = windowGuard(totalWeeks);
  if (!guard.ok) {
    return { ok: false, error: { code: "WINDOW_TOO_LONG", message: guard.message } };
  }

  const rules: AppliedRule[] = [];
  const missingData: string[] = [];
  const caveats: string[] = [];

  const level = inputs.level ?? "INTERMEDIATE";
  if (!inputs.level) {
    missingData.push("level");
    caveats.push("Nível do atleta não informado — assumido INTERMEDIATE.");
  }

  rules.push({
    id: "strategy-window",
    version: "1",
    explanation: `Janela de ${inputs.startDate} até a prova em ${inputs.eventDate} = ${totalWeeks} semana(s). O pico é ancorado na data da prova.`,
  });

  // --- Regra S2/S3: fases ----------------------------------------------------
  const spans = phaseSpans(totalWeeks, level);
  const taper = taperWeeks(totalWeeks, level);
  rules.push({
    id: "phase-model",
    version: "1",
    explanation: `Modelo de fases (${spans.map((s) => `${s.kind}:${s.weeks}sem`).join(" → ")}). Preparação geral longa, específica média, pico curto; taper de ${taper} semana(s) ao final (Bosquet 2007).`,
  });

  // Expande os spans em mesociclos com datas reais.
  const mesocycles: MesocycleBlock[] = [];
  let weekCursor = 1;
  for (const [i, span] of spans.entries()) {
    const startWeek = weekCursor;
    const endWeek = weekCursor + span.weeks - 1;
    const profile = PHASE_STRATEGY[span.kind];
    mesocycles.push({
      sequence: i + 1,
      name: profile.focus,
      kind: span.kind,
      startWeek,
      endWeek,
      weeks: span.weeks,
      startDate: weekWindow(inputs.startDate, inputs.eventDate, startWeek).startDate,
      endDate: weekWindow(inputs.startDate, inputs.eventDate, endWeek).endDate,
      focus: profile.focus,
      volumeFactor: profile.volumeFactor,
      intensityFocus: profile.intensityFocus,
    });
    weekCursor = endWeek + 1;
  }

  // --- Regra S6/S7: volume-base ---------------------------------------------
  const endurance = isEndurance(inputs.modality);
  let baseVolume: number | null = null;
  if (endurance) {
    if (inputs.baseWeeklyVolumeKm != null && inputs.baseWeeklyVolumeKm > 0) {
      baseVolume = inputs.baseWeeklyVolumeKm;
    } else {
      baseVolume = DEFAULT_BASE_VOLUME_KM[inputs.modality][level];
      missingData.push("baseWeeklyVolumeKm");
      caveats.push(
        `Volume semanal de partida ausente — usado um padrão de referência (${baseVolume} km para ${level}). Informe o volume atual do atleta para a prescrição deixar de ser um chute.`,
      );
    }
    rules.push({
      id: "base-volume",
      version: "1",
      explanation: `Volume-base de partida: ${baseVolume} km/semana. Cada semana aplica o fator da fase e o multiplicador da onda de carga sobre esse valor.`,
    });
  }

  // --- Regra S4/S5/S6: semanas (microciclos) --------------------------------
  const deloadN = deloadEveryNWeeks(level);
  const weeks: MicrocycleWeek[] = [];

  for (const meso of mesocycles) {
    let loadStep = 0; // conta semanas de carga desde o último deload dentro da fase
    for (let seq = meso.startWeek; seq <= meso.endWeek; seq += 1) {
      const isEventWeek = seq === totalWeeks;
      const window = weekWindow(inputs.startDate, inputs.eventDate, seq);

      // Deload: a cada N semanas de carga, exceto no taper (já leve) e na
      // semana da prova. A semana de deload zera o contador de degraus.
      const canDeload = meso.kind !== "TAPER" && !isEventWeek;
      const isDeload = canDeload && loadStep > 0 && loadStep % deloadN === 0;

      if (isDeload) {
        loadStep = 0;
      }
      loadStep += 1;

      let targetVolumeKm: number | null = null;
      if (endurance && baseVolume != null) {
        const mult = loadWaveMultiplier(loadStep, isDeload);
        targetVolumeKm = Math.round(baseVolume * meso.volumeFactor * mult * 10) / 10;
      }

      weeks.push({
        sequence: seq,
        startDate: window.startDate,
        endDate: window.endDate,
        mesocycleSequence: meso.sequence,
        phaseKind: meso.kind,
        phaseName: meso.focus,
        isRecoveryWeek: isDeload,
        isEventWeek,
        loadStep,
        targetVolumeKm,
        intensityFocus: meso.intensityFocus,
      });
    }
  }

  rules.push({
    id: "deload-cadence",
    version: "1",
    explanation: `Cadência de deload ${deloadN}:1 (nível ${level}) — a cada ${deloadN} semanas de carga, uma semana regenerativa a ${Math.round(0.6 * 100)}% do volume, nunca no taper nem na semana da prova.`,
  });
  rules.push({
    id: "load-wave",
    version: "1",
    explanation:
      "Onda de carga: dentro do mesociclo, as semanas de carga sobem em degraus conservadores (~+7%/degrau, teto +21%) e a semana de deload cai. Progressão é sugestão, não limite de segurança calculado.",
  });

  // --- Confiança -------------------------------------------------------------
  let confidence: ConfidenceLevel = "HIGH";
  const downgrade = (next: ConfidenceLevel) => {
    const order: ConfidenceLevel[] = ["LOW", "MODERATE", "HIGH"];
    if (order.indexOf(next) < order.indexOf(confidence)) confidence = next;
  };

  if (!inputs.level) downgrade("MODERATE");
  if (endurance && missingData.includes("baseWeeklyVolumeKm")) downgrade("LOW");
  if (inputs.modality === "TRIATHLON") {
    downgrade("MODERATE");
    caveats.push(
      "Triathlon com um único volume-base em km — a divisão entre nado/pedal/corrida acontece na geração de sessões e é uma proporção de referência.",
    );
  }
  if (totalWeeks < 4) {
    downgrade("MODERATE");
    caveats.push(
      "Janela muito curta (< 4 semanas) — não há espaço para um macrociclo completo; as fases foram colapsadas.",
    );
  }

  rules.push({
    id: "confidence",
    version: "1",
    explanation: `Confiança ${confidence}.${missingData.length ? ` Dados ausentes: ${missingData.join(", ")}.` : " Todas as entradas presentes."} Confiança alta significa que o motor tinha os dados que a regra pede — não que a estratégia está certa para este atleta. A revisão do treinador é obrigatória.`,
  });

  if (inputs.currentLoad) {
    caveats.push(
      `Estado de carga atual (CTL ${inputs.currentLoad.ctl.toFixed(0)} / ATL ${inputs.currentLoad.atl.toFixed(0)} / TSB ${inputs.currentLoad.tsb.toFixed(0)}) exibido como contexto — não foi usado para cortar volume automaticamente.`,
    );
  }

  return {
    ok: true,
    macrocycle: {
      goal: inputs.goal,
      modality: inputs.modality,
      level,
      startDate: inputs.startDate,
      endDate: inputs.eventDate,
      totalWeeks,
    },
    mesocycles,
    weeks,
    confidence,
    rationale: {
      strategyVersion: STRATEGY_VERSION,
      rules,
      missingData,
      caveats,
      references: [...STRATEGY_REFERENCES],
    },
  };
}

// ============================================================================
// PONTE Fase 1 → Fase 3 — cada microciclo vira um WeekContext que o gerador de
// semana (planWeek) consome. É aqui que o motor estratégico "desce" para a
// geração concreta de sessões, sem duplicar nenhuma regra de sessão.
// ============================================================================
export function toWeekContexts(
  result: Extract<MacrocycleResult, { ok: true }>,
  opts: { availableWeekdays: number[]; includeStrength?: boolean },
): WeekContext[] {
  const { macrocycle } = result;
  return result.weeks.map((week) => ({
    goal: macrocycle.goal,
    modality: macrocycle.modality,
    level: macrocycle.level,
    availableWeekdays: opts.availableWeekdays,
    phaseName: week.phaseName,
    isRecoveryWeek: week.isRecoveryWeek,
    targetVolumeKm: week.targetVolumeKm ?? undefined,
    targetIntensity: week.intensityFocus,
    weekStartDate: week.startDate,
    weekEndDate: week.endDate,
    includeStrength: opts.includeStrength ?? false,
  }));
}
