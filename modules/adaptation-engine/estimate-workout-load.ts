import type { Modality, SessionKind } from "@/modules/periodization/generation-rules";

// ============================================================================
// ESTIMADOR DE CARGA DE UM TREINO (Fase 4 — recálculo com dado real).
// ============================================================================
// Para o recálculo da semana funcionar sobre os treinos DE VERDADE (rascunhos e
// publicados, não só a sugestão), precisamos de uma carga por treino. Quando o
// atleta já executou, usamos o sRPE REAL (feedback). Quando é só planejado,
// ESTIMAMOS a carga a partir da prescrição — e assumimos que é estimativa.
//
// POSTURA: isto NÃO inventa pace/potência. Estima carga INTERNA (UA) para
// comparar semanas (polarização, salto), sempre marcada como estimativa. A
// fórmula é sRPE-like: RPE × minutos, minutos vindos da duração ou, na falta
// dela, de uma velocidade nominal por modalidade (aproximação declarada).

export const LOAD_ESTIMATOR_VERSION = "load-estimator-v1";

export interface StepInput {
  stepType: string;
  repetitions?: number | null;
  durationSeconds?: number | null;
  distanceMeters?: number | null;
  targetType?: string | null;
  targetMin?: number | null;
  targetMax?: number | null;
}
export interface ExerciseInput {
  sets: number;
  reps?: number | null;
  durationSeconds?: number | null;
  rpeTarget?: number | null;
  rir?: number | null;
}
export interface BlockInput {
  repetitions?: number | null;
  steps: StepInput[];
  exercises: ExerciseInput[];
}
export interface WorkoutInput {
  modality: Modality;
  blocks: BlockInput[];
}

export interface WorkoutLoadEstimate {
  load: number; // carga interna estimada (UA)
  kind: SessionKind; // tipo inferido da prescrição
  volumeKm: number | null; // km somados (endurance)
  estimated: true; // sempre estimativa — o chamador troca por sRPE se houver
}

// Velocidade nominal (m/min) só para converter DISTÂNCIA em minutos quando a
// duração não foi prescrita. Declaradamente grosseira — serve para dimensionar
// carga relativa, não para prescrever ritmo.
const NOMINAL_SPEED_M_PER_MIN: Record<Modality, number> = {
  RUNNING: 175, // ~10,5 km/h
  CYCLING: 500, // ~30 km/h
  SWIMMING: 55, // ~3,3 km/h
  TRIATHLON: 175,
  STRENGTH: 0,
  FUNCTIONAL: 0,
};

function stepRpe(step: StepInput): number {
  if (step.targetType === "RPE" && (step.targetMin != null || step.targetMax != null)) {
    const lo = step.targetMin ?? step.targetMax ?? 4;
    const hi = step.targetMax ?? step.targetMin ?? lo;
    return (Number(lo) + Number(hi)) / 2;
  }
  const t = step.stepType.toUpperCase();
  if (t.includes("TIRO") || t.includes("SPRINT")) return 8;
  if (t.includes("PAUSA") || t.includes("RECUP")) return 1;
  if (t.includes("AQUEC") || t.includes("CALMA")) return 3;
  return 4; // rodagem/contínuo padrão
}

function stepMinutes(step: StepInput, modality: Modality): number {
  if (step.durationSeconds != null && step.durationSeconds > 0) return step.durationSeconds / 60;
  const speed = NOMINAL_SPEED_M_PER_MIN[modality];
  if (step.distanceMeters != null && step.distanceMeters > 0 && speed > 0) {
    return step.distanceMeters / speed;
  }
  return 0;
}

export function estimateWorkoutLoad(workout: WorkoutInput): WorkoutLoadEstimate {
  let load = 0;
  let distanceM = 0;
  let enduranceMinutes = 0;
  let maxRpe = 0;
  let hasEndurance = false;
  let hasStrength = false;

  for (const block of workout.blocks) {
    const blockReps = block.repetitions ?? 1;

    for (const step of block.steps) {
      hasEndurance = true;
      const count = blockReps * (step.repetitions ?? 1);
      const rpe = stepRpe(step);
      const minutes = stepMinutes(step, workout.modality);
      load += rpe * minutes * count;
      enduranceMinutes += minutes * count;
      if (rpe > maxRpe && !step.stepType.toUpperCase().includes("PAUSA")) maxRpe = rpe;
      if (step.distanceMeters != null) distanceM += step.distanceMeters * count;
    }

    for (const ex of block.exercises) {
      hasStrength = true;
      // RPE do exercício: alvo explícito, ou 10 − RIR, ou 7 como padrão.
      const rpe = ex.rpeTarget ?? (ex.rir != null ? Math.max(1, 10 - ex.rir) : 7);
      // ~1,5 min por série (execução + descanso), independente de duração exata.
      const minutes = ex.sets * 1.5;
      load += rpe * minutes * blockReps;
      if (rpe > maxRpe) maxRpe = rpe;
    }
  }

  // Tipo inferido da prescrição.
  let kind: SessionKind;
  if (hasStrength && !hasEndurance) {
    kind = "STRENGTH";
  } else if (maxRpe >= 7) {
    kind = "QUALITY";
  } else if (maxRpe > 0 && maxRpe <= 3) {
    kind = "RECOVERY";
  } else if (enduranceMinutes >= 75) {
    kind = "LONG";
  } else {
    kind = "EASY";
  }

  return {
    load: Math.round(load),
    kind,
    volumeKm: distanceM > 0 ? Math.round((distanceM / 1000) * 10) / 10 : null,
    estimated: true,
  };
}
