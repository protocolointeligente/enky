// Motor de cálculo de protocolos de avaliação da ENKY.
// Cada função é pura: entrada → resultado. Nenhuma chamada a banco de dados,
// nenhum estado compartilhado. Totalmente testável via Vitest.
//
// Convenção de nomenclatura das funções: mesma string do campo `equationCode`
// em protocol-registry.ts, convertida para camelCase.
//
// ─────────────────────────────────────────────────────────────────────────────
// Tipos base
// ─────────────────────────────────────────────────────────────────────────────

/** Campos de entrada digitados pelo avaliador. */
export type ProtocolInputs = Record<string, string | number | boolean | null | undefined>;

export interface CalculationWarning {
  code: string;
  message: string;
  severity: "INFO" | "WARNING" | "ERROR";
}

export interface CalculationResult {
  /** Valor principal do protocolo (ex.: % gordura, VO₂máx, 1RM). */
  primaryValue: number;
  /** Unidade do valor principal. */
  primaryUnit: string;
  /**
   * Valores derivados adicionais calculados a partir das mesmas entradas.
   * Ex.: massa gorda, massa magra, pace por km para VDOT etc.
   */
  derived: Record<string, { value: number; unit: string; label: string }>;
  /**
   * Base científica utilizada.
   * Exemplo: "Equação de Jackson-Pollock (1978) + fórmula de Siri (1956)"
   */
  basis: string;
  /** Confiança estimada do protocolo (0–1). */
  confidence: number;
  warnings: CalculationWarning[];
}

/** Lança um erro tipado para entradas inválidas. */
class ProtocolInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProtocolInputError";
  }
}

function requireNumber(inputs: ProtocolInputs, key: string, label: string): number {
  const v = inputs[key];
  const n = Number(v);
  if (v === null || v === undefined || v === "" || isNaN(n)) {
    throw new ProtocolInputError(`Campo obrigatório ausente ou inválido: "${label}" (${key})`);
  }
  return n;
}

function optionalNumber(inputs: ProtocolInputs, key: string): number | undefined {
  const v = inputs[key];
  if (v === null || v === undefined || v === "") return undefined;
  const n = Number(v);
  return isNaN(n) ? undefined : n;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers científicos
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Converte densidade corporal em % gordura pela equação de Siri (1956).
 * %G = (4.95 / D − 4.50) × 100
 */
function siriBodyFat(density: number): number {
  return (4.95 / density - 4.5) * 100;
}

/**
 * Monta o resultado de composição corporal a partir do % gordura e da massa.
 */
function buildBodyCompositionResult(
  bodyFatPct: number,
  weightKg: number | undefined,
  basis: string,
  confidence: number,
  warnings: CalculationWarning[],
): CalculationResult {
  const derived: CalculationResult["derived"] = {};
  if (weightKg !== undefined && weightKg > 0) {
    const fatMass = (bodyFatPct / 100) * weightKg;
    const leanMass = weightKg - fatMass;
    derived["fat_mass_kg"] = { value: parseFloat(fatMass.toFixed(2)), unit: "kg", label: "Massa gorda" };
    derived["lean_mass_kg"] = { value: parseFloat(leanMass.toFixed(2)), unit: "kg", label: "Massa magra" };
  }
  return {
    primaryValue: parseFloat(bodyFatPct.toFixed(2)),
    primaryUnit: "%",
    derived,
    basis,
    confidence,
    warnings,
  };
}

function bestOf(...values: (number | undefined)[]): number {
  const valid = values.filter((v): v is number => v !== undefined && !isNaN(v));
  if (valid.length === 0) throw new ProtocolInputError("Nenhum valor válido fornecido.");
  return Math.max(...valid);
}

function lowestOf(...values: (number | undefined)[]): number {
  const valid = values.filter((v): v is number => v !== undefined && !isNaN(v));
  if (valid.length === 0) throw new ProtocolInputError("Nenhum valor válido fornecido.");
  return Math.min(...valid);
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPOSIÇÃO CORPORAL — Jackson-Pollock
// ─────────────────────────────────────────────────────────────────────────────

/**
 * JP7_MALE_SIRI
 * Jackson-Pollock 7 Dobras Masculino → Densidade (1978) → Siri (1956)
 */
export function jp7MaleSiri(inputs: ProtocolInputs): CalculationResult {
  const weight = optionalNumber(inputs, "weight_kg");
  const age = requireNumber(inputs, "age_years", "Idade");
  const chest = requireNumber(inputs, "chest_mm", "Peitoral");
  const axilla = requireNumber(inputs, "axilla_mm", "Axilar média");
  const triceps = requireNumber(inputs, "triceps_mm", "Tríceps");
  const subscapular = requireNumber(inputs, "subscapular_mm", "Subescapular");
  const abdominal = requireNumber(inputs, "abdominal_mm", "Abdominal");
  const suprailiac = requireNumber(inputs, "suprailiac_mm", "Suprailíaco");
  const thigh = requireNumber(inputs, "thigh_mm", "Coxa");

  const sum7 = chest + axilla + triceps + subscapular + abdominal + suprailiac + thigh;
  const density =
    1.112 -
    0.00043499 * sum7 +
    0.00000055 * sum7 ** 2 -
    0.00028826 * age;
  const bodyFat = siriBodyFat(density);

  const warnings: CalculationWarning[] = [];
  if (sum7 < 30 || sum7 > 250) {
    warnings.push({ code: "SUM_OUT_OF_RANGE", message: "Soma de dobras fora do intervalo de validação (30–250 mm). Verificar medições.", severity: "WARNING" });
  }

  return buildBodyCompositionResult(
    bodyFat, weight,
    "Jackson-Pollock (1978) — equação de 7 dobras masculino. Densidade → Siri (1956).",
    0.85, warnings,
  );
}

/**
 * JP7_FEMALE_SIRI
 * Jackson-Pollock 7 Dobras Feminino → Densidade (1980) → Siri (1956)
 */
export function jp7FemaleSiri(inputs: ProtocolInputs): CalculationResult {
  const weight = optionalNumber(inputs, "weight_kg");
  const age = requireNumber(inputs, "age_years", "Idade");
  const chest = requireNumber(inputs, "chest_mm", "Peitoral");
  const axilla = requireNumber(inputs, "axilla_mm", "Axilar média");
  const triceps = requireNumber(inputs, "triceps_mm", "Tríceps");
  const subscapular = requireNumber(inputs, "subscapular_mm", "Subescapular");
  const abdominal = requireNumber(inputs, "abdominal_mm", "Abdominal");
  const suprailiac = requireNumber(inputs, "suprailiac_mm", "Suprailíaco");
  const thigh = requireNumber(inputs, "thigh_mm", "Coxa");

  const sum7 = chest + axilla + triceps + subscapular + abdominal + suprailiac + thigh;
  const density =
    1.097 -
    0.00046971 * sum7 +
    0.00000056 * sum7 ** 2 -
    0.00012828 * age;
  const bodyFat = siriBodyFat(density);

  return buildBodyCompositionResult(
    bodyFat, weight,
    "Jackson-Pollock-Ward (1980) — equação de 7 dobras feminino. Densidade → Siri (1956).",
    0.85, [],
  );
}

/**
 * JP3_MALE_SIRI
 * Jackson-Pollock 3 Dobras Masculino: peitoral, abdominal, coxa.
 */
export function jp3MaleSiri(inputs: ProtocolInputs): CalculationResult {
  const weight = optionalNumber(inputs, "weight_kg");
  const age = requireNumber(inputs, "age_years", "Idade");
  const chest = requireNumber(inputs, "chest_mm", "Peitoral");
  const abdominal = requireNumber(inputs, "abdominal_mm", "Abdominal");
  const thigh = requireNumber(inputs, "thigh_mm", "Coxa");

  const sum3 = chest + abdominal + thigh;
  const density =
    1.10938 -
    0.0008267 * sum3 +
    0.0000016 * sum3 ** 2 -
    0.0002574 * age;
  const bodyFat = siriBodyFat(density);

  return buildBodyCompositionResult(
    bodyFat, weight,
    "Jackson-Pollock (1978) — equação de 3 dobras masculino (peitoral, abdominal, coxa). Densidade → Siri (1956).",
    0.80, [],
  );
}

/**
 * JP3_FEMALE_SIRI
 * Jackson-Pollock 3 Dobras Feminino: tríceps, suprailíaco, coxa.
 */
export function jp3FemaleSiri(inputs: ProtocolInputs): CalculationResult {
  const weight = optionalNumber(inputs, "weight_kg");
  const age = requireNumber(inputs, "age_years", "Idade");
  const triceps = requireNumber(inputs, "triceps_mm", "Tríceps");
  const suprailiac = requireNumber(inputs, "suprailiac_mm", "Suprailíaco");
  const thigh = requireNumber(inputs, "thigh_mm", "Coxa");

  const sum3 = triceps + suprailiac + thigh;
  const density =
    1.0994921 -
    0.0009929 * sum3 +
    0.0000023 * sum3 ** 2 -
    0.0001392 * age;
  const bodyFat = siriBodyFat(density);

  return buildBodyCompositionResult(
    bodyFat, weight,
    "Jackson-Pollock-Ward (1980) — equação de 3 dobras feminino (tríceps, suprailíaco, coxa). Densidade → Siri (1956).",
    0.80, [],
  );
}

/**
 * GUEDES_3_SIRI
 * Guedes 3 Dobras — adultos brasileiros.
 * Homens: tríceps + suprailíaco + abdominal
 * Mulheres: tríceps + suprailíaco + panturrilha
 */
export function guedes3Siri(inputs: ProtocolInputs): CalculationResult {
  const weight = optionalNumber(inputs, "weight_kg");
  const age = requireNumber(inputs, "age_years", "Idade");
  const sex = inputs["sex"] as string;
  const triceps = requireNumber(inputs, "triceps_mm", "Tríceps");
  const suprailiac = requireNumber(inputs, "suprailiac_mm", "Suprailíaco");
  const thirdFold = requireNumber(inputs, "abdominal_or_leg_mm", "Abdominal (M) / Panturrilha (F)");

  if (!sex || !["M", "F"].includes(sex)) {
    throw new ProtocolInputError("Sexo biológico é obrigatório para a equação de Guedes.");
  }

  const sum3 = triceps + suprailiac + thirdFold;
  let density: number;
  if (sex === "M") {
    // Guedes 1994: D = 1.1765 − 0.0744 × log₁₀(Σ3)
    density = 1.1765 - 0.0744 * Math.log10(sum3);
  } else {
    // Guedes 1994: D = 1.1665 − 0.0706 × log₁₀(Σ3)
    density = 1.1665 - 0.0706 * Math.log10(sum3);
  }

  const bodyFat = siriBodyFat(density);

  const warnings: CalculationWarning[] = [];
  if (age < 18 || age > 60) {
    warnings.push({ code: "AGE_OUT_OF_VALIDATION", message: "A equação de Guedes foi validada para adultos de 18–60 anos.", severity: "WARNING" });
  }

  return buildBodyCompositionResult(
    bodyFat, weight,
    "Guedes & Guedes (1994) — equação de 3 dobras para adultos brasileiros. Densidade → Siri (1956).",
    0.82, warnings,
  );
}

/**
 * FAULKNER_4
 * Faulkner 4 Dobras: tríceps + subescapular + abdominal + suprailíaco.
 * Fórmula direta de %G (não via densidade).
 */
export function faulkner4(inputs: ProtocolInputs): CalculationResult {
  const weight = optionalNumber(inputs, "weight_kg");
  const triceps = requireNumber(inputs, "triceps_mm", "Tríceps");
  const subscapular = requireNumber(inputs, "subscapular_mm", "Subescapular");
  const abdominal = requireNumber(inputs, "abdominal_mm", "Abdominal");
  const suprailiac = requireNumber(inputs, "suprailiac_mm", "Suprailíaco");

  const sum4 = triceps + subscapular + abdominal + suprailiac;
  const bodyFat = sum4 * 0.153 + 5.783;

  return buildBodyCompositionResult(
    bodyFat, weight,
    "Faulkner (1968) — equação de 4 dobras (tríceps, subescapular, abdominal, suprailíaco).",
    0.72, [],
  );
}

/**
 * PETROSKI_4_MALE_SIRI
 * Petroski 4 Dobras Masculino: peitoral, subescapular, suprailíaco, panturrilha.
 */
export function petroski4MaleSiri(inputs: ProtocolInputs): CalculationResult {
  const weight = optionalNumber(inputs, "weight_kg");
  const age = requireNumber(inputs, "age_years", "Idade");
  const chest = requireNumber(inputs, "chest_mm", "Peitoral");
  const subscapular = requireNumber(inputs, "subscapular_mm", "Subescapular");
  const suprailiac = requireNumber(inputs, "suprailiac_mm", "Suprailíaco");
  const calf = requireNumber(inputs, "calf_mm", "Panturrilha");

  const sum4 = chest + subscapular + suprailiac + calf;
  const density =
    1.10726863 -
    0.00081201 * sum4 +
    0.00000212 * sum4 ** 2 -
    0.00041761 * age;
  const bodyFat = siriBodyFat(density);

  return buildBodyCompositionResult(
    bodyFat, weight,
    "Petroski (1995) — equação de 4 dobras masculino para adultos brasileiros. Densidade → Siri (1956).",
    0.83, [],
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CARDIORRESPIRATÓRIO
// ─────────────────────────────────────────────────────────────────────────────

/**
 * COOPER_VO2MAX
 * Cooper (1968): VO₂máx = (distância_m − 504.9) / 44.73
 */
export function cooperVo2max(inputs: ProtocolInputs): CalculationResult {
  const distanceM = requireNumber(inputs, "distance_m", "Distância percorrida");
  const vo2max = (distanceM - 504.9) / 44.73;

  return {
    primaryValue: parseFloat(Math.max(vo2max, 10).toFixed(2)),
    primaryUnit: "ml/kg/min",
    derived: {},
    basis: "Cooper (1968). JAMA;203(3):201-204.",
    confidence: 0.75,
    warnings: vo2max < 20 ? [{ code: "LOW_VO2_ESTIMATE", message: "Estimativa muito baixa. Verificar se o atleta correu ou caminhou.", severity: "WARNING" }] : [],
  };
}

/**
 * ROCKPORT_VO2MAX
 * Kline et al. (1987):
 * VO₂máx = 132.853 − 0.0769×peso_lb − 0.3877×idade + 6.315×(1 se M, 0 se F)
 *           − 3.2649×tempo_min − 0.1565×FC_final
 */
export function rockportVo2max(inputs: ProtocolInputs): CalculationResult {
  const timeSeconds = requireNumber(inputs, "time_seconds", "Tempo (1 milha)");
  const hrFinal = requireNumber(inputs, "hr_final_bpm", "FC ao final");
  const weightKg = requireNumber(inputs, "weight_kg", "Massa corporal");
  const age = requireNumber(inputs, "age_years", "Idade");
  const sex = inputs["sex"] as string;

  if (!sex || !["M", "F"].includes(sex)) {
    throw new ProtocolInputError("Sexo biológico é obrigatório para o teste de Rockport.");
  }

  const weightLbs = weightKg * 2.20462;
  const timeMin = timeSeconds / 60;
  const sexFactor = sex === "M" ? 1 : 0;

  const vo2max =
    132.853 -
    0.0769 * weightLbs -
    0.3877 * age +
    6.315 * sexFactor -
    3.2649 * timeMin -
    0.1565 * hrFinal;

  return {
    primaryValue: parseFloat(Math.max(vo2max, 10).toFixed(2)),
    primaryUnit: "ml/kg/min",
    derived: {},
    basis: "Kline et al. Med Sci Sports Exerc. 1987;19(3):253-259.",
    confidence: 0.78,
    warnings: [],
  };
}

/**
 * LEGER_VO2MAX
 * Léger et al. (1988):
 * VAM (km/h) = 8 + 0.5 × nível
 * VO₂máx = 31.025 + 3.238×VAM − 3.248×idade + 0.1536×(VAM×idade)
 */
export function legerVo2max(inputs: ProtocolInputs): CalculationResult {
  const lastLevel = requireNumber(inputs, "last_level", "Último nível");
  const age = requireNumber(inputs, "age_years", "Idade");

  const vam = 8 + 0.5 * lastLevel;
  const vo2max = 31.025 + 3.238 * vam - 3.248 * age + 0.1536 * (vam * age);

  return {
    primaryValue: parseFloat(Math.max(vo2max, 10).toFixed(2)),
    primaryUnit: "ml/kg/min",
    derived: {
      vam_kmh: { value: parseFloat(vam.toFixed(1)), unit: "km/h", label: "VAM estimada" },
    },
    basis: "Léger et al. Eur J Appl Physiol. 1988;57:434-442.",
    confidence: 0.82,
    warnings: [],
  };
}

/**
 * SIX_MIN_WALK_VO2
 * Equação de Enright & Sherrill (1998) para referência normativa.
 * Apenas valor de distância é principal (sem conversão a VO₂).
 */
export function sixMinWalkVo2(inputs: ProtocolInputs): CalculationResult {
  const distanceM = requireNumber(inputs, "distance_m", "Distância total");
  return {
    primaryValue: distanceM,
    primaryUnit: "m",
    derived: {},
    basis: "ATS 2002 — TC6M: o resultado principal é a distância percorrida.",
    confidence: 0.90,
    warnings: [],
  };
}

// VDOT (Daniels) — lookup table simplificada
// Tabela: [distância_m, tempo_s, vdot]
const VDOT_TABLE: [number, number, number][] = [
  // 5000m
  [5000, 1200, 60.0], [5000, 1260, 57.5], [5000, 1320, 55.1],
  [5000, 1380, 52.8], [5000, 1440, 50.7], [5000, 1500, 48.7],
  [5000, 1560, 46.8], [5000, 1620, 45.0], [5000, 1680, 43.3],
  [5000, 1740, 41.7], [5000, 1800, 40.2], [5000, 1920, 37.4],
  [5000, 2100, 34.0], [5000, 2400, 29.5],
  // 10000m
  [10000, 2400, 60.0], [10000, 2520, 57.5], [10000, 2700, 54.3],
  [10000, 2880, 51.6], [10000, 3060, 49.2], [10000, 3300, 45.8],
  [10000, 3600, 42.3], [10000, 4200, 37.1], [10000, 4800, 32.5],
  // 21097m (HM)
  [21097, 5400, 59.4], [21097, 5700, 56.7], [21097, 6000, 54.0],
  [21097, 6600, 49.4], [21097, 7200, 45.5], [21097, 7800, 42.0],
  [21097, 8400, 39.0], [21097, 9600, 34.0],
  // 42195m (Marathon)
  [42195, 10800, 59.4], [42195, 11400, 56.5], [42195, 12000, 53.8],
  [42195, 13200, 49.2], [42195, 14400, 45.4], [42195, 15600, 42.0],
  [42195, 16800, 39.0], [42195, 18000, 36.4], [42195, 21600, 29.0],
];

function interpolateVdot(distanceM: number, timeS: number): number {
  const rows = VDOT_TABLE.filter((r) => r[0] === distanceM);
  if (rows.length === 0) {
    // Fallback: usar VO₂max de Daniels: VO₂ = (-4.6 + 0.182258×velocity + 0.000104×velocity²) / (0.8 + 0.1894393×e^(-0.012778×t) + 0.2989558×e^(-0.1932605×t))
    const velocityMpM = distanceM / timeS * 60;
    return parseFloat((velocityMpM * 0.2 + 3.5).toFixed(1)); // simplified fallback
  }
  rows.sort((a, b) => a[1] - b[1]);
  if (timeS <= rows[0][1]) return rows[0][2];
  if (timeS >= rows[rows.length - 1][1]) return rows[rows.length - 1][2];
  for (let i = 0; i < rows.length - 1; i++) {
    if (timeS >= rows[i][1] && timeS <= rows[i + 1][1]) {
      const t = (timeS - rows[i][1]) / (rows[i + 1][1] - rows[i][1]);
      return parseFloat((rows[i][2] + t * (rows[i + 1][2] - rows[i][2])).toFixed(1));
    }
  }
  return rows[rows.length - 1][2];
}

/**
 * VDOT_DANIELS
 * Calcula VDOT a partir de tempo de prova e gera paces de treino.
 */
export function vdotDaniels(inputs: ProtocolInputs): CalculationResult {
  const distanceM = requireNumber(inputs, "race_distance_m", "Distância da prova");
  const timeS = requireNumber(inputs, "race_time_seconds", "Tempo de prova");

  const vdot = interpolateVdot(distanceM, timeS);

  // Paces de treino por zona (segundos por km) — baseados na tabela de Daniels
  const easyPaceSecPerKm = Math.round((1 / (vdot * 0.011)) * 1000);
  const marathonPaceSecPerKm = Math.round((1 / (vdot * 0.0125)) * 1000);
  const thresholdPaceSecPerKm = Math.round((1 / (vdot * 0.0133)) * 1000);
  const intervalPaceSecPerKm = Math.round((1 / (vdot * 0.0148)) * 1000);

  const formatPace = (secPerKm: number): string => {
    const min = Math.floor(secPerKm / 60);
    const sec = secPerKm % 60;
    return `${min}:${String(sec).padStart(2, "0")} min/km`;
  };

  return {
    primaryValue: vdot,
    primaryUnit: "vdot",
    derived: {
      easy_pace: { value: easyPaceSecPerKm, unit: "s/km", label: `Pace Fácil (E) — ${formatPace(easyPaceSecPerKm)}` },
      marathon_pace: { value: marathonPaceSecPerKm, unit: "s/km", label: `Pace Maratona (M) — ${formatPace(marathonPaceSecPerKm)}` },
      threshold_pace: { value: thresholdPaceSecPerKm, unit: "s/km", label: `Pace Limiar (T) — ${formatPace(thresholdPaceSecPerKm)}` },
      interval_pace: { value: intervalPaceSecPerKm, unit: "s/km", label: `Pace Intervalo (I) — ${formatPace(intervalPaceSecPerKm)}` },
    },
    basis: "Daniels J. Daniels' Running Formula. 3rd ed. Human Kinetics; 2014.",
    confidence: 0.88,
    warnings: vdot < 30 ? [{ code: "LOW_VDOT", message: "VDOT abaixo de 30. Verificar se o tempo de prova foi em esforço máximo.", severity: "INFO" }] : [],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// FORÇA
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ONE_RM_DIRECT — sem cálculo, apenas retorna a carga direta.
 */
export function oneRmDirect(inputs: ProtocolInputs): CalculationResult {
  const loadKg = requireNumber(inputs, "load_kg", "Carga (1RM)");
  const weightKg = optionalNumber(inputs, "weight_kg");

  const derived: CalculationResult["derived"] = {};
  if (weightKg !== undefined && weightKg > 0) {
    derived["relative_strength"] = { value: parseFloat((loadKg / weightKg).toFixed(2)), unit: "kg/kg", label: "Força relativa" };
  }

  return {
    primaryValue: loadKg,
    primaryUnit: "kg",
    derived,
    basis: "1RM direto medido em teste incremental (Baechle & Earle, NSCA 2008).",
    confidence: 0.98,
    warnings: [],
  };
}

/**
 * EPLEY_FORMULA
 * 1RM estimado = carga × (1 + reps / 30)
 */
export function epleyFormula(inputs: ProtocolInputs): CalculationResult {
  const load = requireNumber(inputs, "test_load_kg", "Carga de teste");
  const reps = requireNumber(inputs, "reps_completed", "Repetições");
  const weightKg = optionalNumber(inputs, "weight_kg");

  const warnings: CalculationWarning[] = [];
  if (reps > 10) {
    warnings.push({ code: "HIGH_REPS_EPLEY", message: "Acima de 10 repetições a precisão do 1RM estimado reduz significativamente.", severity: "WARNING" });
  }

  const estimated1rm = load * (1 + reps / 30);
  const derived: CalculationResult["derived"] = {};
  if (weightKg) {
    derived["relative_strength"] = { value: parseFloat((estimated1rm / weightKg).toFixed(2)), unit: "kg/kg", label: "Força relativa estimada" };
  }

  return {
    primaryValue: parseFloat(estimated1rm.toFixed(2)),
    primaryUnit: "kg",
    derived,
    basis: "Epley (1985). Equação: 1RM = carga × (1 + reps/30).",
    confidence: reps <= 10 ? 0.80 : 0.60,
    warnings,
  };
}

/**
 * BRZYCKI_FORMULA
 * 1RM estimado = carga / (1.0278 − 0.0278 × reps)
 */
export function brzyckiFormula(inputs: ProtocolInputs): CalculationResult {
  const load = requireNumber(inputs, "test_load_kg", "Carga de teste");
  const reps = requireNumber(inputs, "reps_completed", "Repetições");
  const weightKg = optionalNumber(inputs, "weight_kg");

  const warnings: CalculationWarning[] = [];
  if (reps >= 37) {
    throw new ProtocolInputError("Equação de Brzycki inválida para ≥ 37 repetições (denominador ≤ 0).");
  }
  if (reps > 10) {
    warnings.push({ code: "HIGH_REPS_BRZYCKI", message: "Acurácia reduzida acima de 10 repetições.", severity: "WARNING" });
  }

  const denominator = 1.0278 - 0.0278 * reps;
  const estimated1rm = load / denominator;

  const derived: CalculationResult["derived"] = {};
  if (weightKg) {
    derived["relative_strength"] = { value: parseFloat((estimated1rm / weightKg).toFixed(2)), unit: "kg/kg", label: "Força relativa estimada" };
  }

  return {
    primaryValue: parseFloat(estimated1rm.toFixed(2)),
    primaryUnit: "kg",
    derived,
    basis: "Brzycki (1993). Strength Cond J. Equação: 1RM = carga / (1.0278 − 0.0278 × reps).",
    confidence: reps <= 10 ? 0.82 : 0.62,
    warnings,
  };
}

/**
 * MAYHEW_FORMULA
 * 1RM = (100 × peso) / (52.2 + 41.9 × e^(−0.055 × reps))
 */
export function mayhewFormula(inputs: ProtocolInputs): CalculationResult {
  const load = requireNumber(inputs, "test_load_kg", "Carga de teste");
  const reps = requireNumber(inputs, "reps_completed", "Repetições");
  const weightKg = optionalNumber(inputs, "weight_kg");

  const estimated1rm = (100 * load) / (52.2 + 41.9 * Math.exp(-0.055 * reps));

  const derived: CalculationResult["derived"] = {};
  if (weightKg) {
    derived["relative_strength"] = { value: parseFloat((estimated1rm / weightKg).toFixed(2)), unit: "kg/kg", label: "Força relativa estimada" };
  }

  return {
    primaryValue: parseFloat(estimated1rm.toFixed(2)),
    primaryUnit: "kg",
    derived,
    basis: "Mayhew et al. (1992). J Sports Med Phys Fitness. Validada para supino.",
    confidence: 0.78,
    warnings: [],
  };
}

/**
 * HANDGRIP_ASYMMETRY
 * Calcula melhor valor por lado e índice de assimetria bilateral.
 */
export function handgripAsymmetry(inputs: ProtocolInputs): CalculationResult {
  const r1 = requireNumber(inputs, "right_1_kgf", "Direita — 1ª tentativa");
  const l1 = requireNumber(inputs, "left_1_kgf", "Esquerda — 1ª tentativa");
  const r2 = optionalNumber(inputs, "right_2_kgf");
  const l2 = optionalNumber(inputs, "left_2_kgf");
  const r3 = optionalNumber(inputs, "right_3_kgf");
  const l3 = optionalNumber(inputs, "left_3_kgf");

  const bestRight = bestOf(r1, r2, r3);
  const bestLeft = bestOf(l1, l2, l3);
  const dominant = Math.max(bestRight, bestLeft);
  const nonDominant = Math.min(bestRight, bestLeft);
  const asymmetryIdx = parseFloat(((Math.abs(bestRight - bestLeft) / dominant) * 100).toFixed(1));

  const warnings: CalculationWarning[] = [];
  if (asymmetryIdx > 15) {
    warnings.push({ code: "HIGH_HANDGRIP_ASYMMETRY", message: `Assimetria de ${asymmetryIdx}% (> 15%). Investigar causa: lesão, dominância pronunciada?`, severity: "WARNING" });
  }

  return {
    primaryValue: parseFloat(dominant.toFixed(1)),
    primaryUnit: "kgf",
    derived: {
      right_best_kgf: { value: parseFloat(bestRight.toFixed(1)), unit: "kgf", label: "Melhor preensão — Direita" },
      left_best_kgf: { value: parseFloat(bestLeft.toFixed(1)), unit: "kgf", label: "Melhor preensão — Esquerda" },
      asymmetry_pct: { value: asymmetryIdx, unit: "%", label: "Índice de assimetria bilateral" },
    },
    basis: "Mathiowetz et al. (1985). Arch Phys Med Rehabil. Melhor de 3 tentativas por lado.",
    confidence: 0.95,
    warnings,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// POTÊNCIA
// ─────────────────────────────────────────────────────────────────────────────

/**
 * CMJ_BEST_HEIGHT / SJ_BEST_HEIGHT
 * Retorna a melhor altura e calcula potência estimada se peso disponível.
 * Bosco et al. (1983): P (W) = (√(g × h) × m × 9.81) onde g = 9.81 m/s²
 */
function jumpBestHeight(equationCode: string, inputs: ProtocolInputs): CalculationResult {
  const j1 = requireNumber(inputs, "jump1_cm", "Tentativa 1");
  const j2 = optionalNumber(inputs, "jump2_cm");
  const j3 = optionalNumber(inputs, "jump3_cm");
  const j4 = optionalNumber(inputs, "jump4_cm");
  const j5 = optionalNumber(inputs, "jump5_cm");
  const weightKg = optionalNumber(inputs, "weight_kg");

  const bestCm = bestOf(j1, j2, j3, j4, j5);
  const bestM = bestCm / 100;

  const derived: CalculationResult["derived"] = {};
  if (weightKg !== undefined && weightKg > 0) {
    const velocity = Math.sqrt(2 * 9.81 * bestM);
    const peakPowerW = parseFloat((velocity * weightKg * 9.81).toFixed(0));
    // Sayers equation: PP (W) = 60.7 × height_cm + 45.3 × body_mass_kg − 2055
    const sayers = 60.7 * bestCm + 45.3 * weightKg - 2055;
    derived["peak_power_bosco_w"] = { value: peakPowerW, unit: "W", label: "Potência pico — Bosco (W)" };
    derived["peak_power_sayers_w"] = { value: Math.round(sayers), unit: "W", label: "Potência pico — Sayers (W)" };
  }

  return {
    primaryValue: parseFloat(bestCm.toFixed(1)),
    primaryUnit: "cm",
    derived,
    basis: equationCode.startsWith("SJ")
      ? "Bosco et al. (1983). Eur J Appl Physiol. Squat Jump (concêntrico puro)."
      : "Bosco et al. (1983). Eur J Appl Physiol. CMJ (ciclo estiramento-encurtamento).",
    confidence: 0.92,
    warnings: [],
  };
}

export function cmjBestHeight(inputs: ProtocolInputs): CalculationResult {
  return jumpBestHeight("CMJ_BEST_HEIGHT", inputs);
}

export function sjBestHeight(inputs: ProtocolInputs): CalculationResult {
  return jumpBestHeight("SJ_BEST_HEIGHT", inputs);
}

/**
 * FTP_20MIN_FACTOR
 * FTP = potência média × 0.95
 */
export function ftp20minFactor(inputs: ProtocolInputs): CalculationResult {
  const avgPower = requireNumber(inputs, "avg_power_20min_w", "Potência média (20 min)");
  const weightKg = optionalNumber(inputs, "weight_kg");

  const ftp = parseFloat((avgPower * 0.95).toFixed(0));
  const derived: CalculationResult["derived"] = {};
  if (weightKg !== undefined && weightKg > 0) {
    derived["w_per_kg"] = { value: parseFloat((ftp / weightKg).toFixed(2)), unit: "W/kg", label: "W/kg (FTP)" };
    // Zonas de Coggan
    const zones = [0.55, 0.75, 0.90, 1.05, 1.20, 1.50, 2.00];
    const zoneLabels = ["Z1 (Recuperação ativa)", "Z2 (Endurance)", "Z3 (Tempo)", "Z4 (Limiar)", "Z5 (VO₂máx)", "Z6 (Anaeróbio)", "Z7 (Neuromuscular)"];
    zones.forEach((factor, i) => {
      derived[`zone_${i + 1}`] = {
        value: parseFloat((ftp * factor).toFixed(0)),
        unit: "W",
        label: `${zoneLabels[i]} ≤ ${Math.round(ftp * factor)}W`,
      };
    });
  }

  return {
    primaryValue: ftp,
    primaryUnit: "W",
    derived,
    basis: "Allen & Coggan (2010). FTP = potência média 20 min × 0.95. Zonas calculadas por Coggan.",
    confidence: 0.88,
    warnings: avgPower < 100 ? [{ code: "LOW_FTP", message: "Potência muito baixa. Verificar se o teste foi realizado em esforço máximo.", severity: "WARNING" }] : [],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// VELOCIDADE / AGILIDADE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * SPRINT_BEST_TIME / AGILITY_BEST_TIME
 * Retorna o menor tempo (melhor tentativa) entre as registradas.
 */
function sprintBestTime(inputs: ProtocolInputs): CalculationResult {
  const t1 = requireNumber(inputs, "time1_s", "Tentativa 1");
  const t2 = optionalNumber(inputs, "time2_s");
  const t3 = optionalNumber(inputs, "time3_s");

  const best = lowestOf(t1, t2, t3);
  const timingDevice = inputs["timing_device"] as string | undefined;

  const warnings: CalculationWarning[] = [];
  if (!timingDevice || timingDevice === "MANUAL") {
    warnings.push({ code: "MANUAL_TIMING", message: "Cronometragem manual tem erro humano de ±0.1–0.3s. Para comparação precisa, usar fotocélulas.", severity: "INFO" });
  }

  return {
    primaryValue: parseFloat(best.toFixed(3)),
    primaryUnit: "s",
    derived: {},
    basis: "Melhor tentativa registrada. Para comparações entre sessões, usar mesmo dispositivo de cronometragem.",
    confidence: timingDevice === "PHOTOCELL" ? 0.97 : 0.80,
    warnings,
  };
}

export function sprintBestTimeExport(inputs: ProtocolInputs): CalculationResult {
  return sprintBestTime(inputs);
}

export function agilityBestTime(inputs: ProtocolInputs): CalculationResult {
  return sprintBestTime(inputs);
}

// ─────────────────────────────────────────────────────────────────────────────
// FLEXIBILIDADE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * WELLS_BEST
 * Retorna melhor alcance do teste de Wells (Sentar-e-Alcançar).
 */
export function wellsBest(inputs: ProtocolInputs): CalculationResult {
  const r1 = requireNumber(inputs, "reach1_cm", "1ª tentativa");
  const r2 = optionalNumber(inputs, "reach2_cm");
  const r3 = optionalNumber(inputs, "reach3_cm");

  const best = bestOf(r1, r2, r3);
  return {
    primaryValue: parseFloat(best.toFixed(1)),
    primaryUnit: "cm",
    derived: {},
    basis: "Wells & Dillon (1952). Melhor de 3 tentativas. Valores negativos indicam alcance abaixo dos pés.",
    confidence: 0.85,
    warnings: [],
  };
}

/**
 * DORSIFLEXION_ASYMMETRY
 * Lunge test bilateral — valor principal = menor (mais restrito), assimetria calculada.
 */
export function dorsiflexionAsymmetry(inputs: ProtocolInputs): CalculationResult {
  const right = requireNumber(inputs, "right_cm", "Lado direito");
  const left = requireNumber(inputs, "left_cm", "Lado esquerdo");

  const min = Math.min(right, left);
  const asymmetryPct = parseFloat(((Math.abs(right - left) / Math.max(right, left)) * 100).toFixed(1));

  const warnings: CalculationWarning[] = [];
  if (asymmetryPct > 10) {
    warnings.push({ code: "DORSIFLEXION_ASYMMETRY", message: `Assimetria de ${asymmetryPct}% (> 10%). Pode indicar restrição unilateral de mobilidade.`, severity: "WARNING" });
  }
  if (min < 9) {
    warnings.push({ code: "LOW_DORSIFLEXION", message: "Dorsiflexão < 9 cm é associada a maior risco de lesão em atletas.", severity: "WARNING" });
  }

  return {
    primaryValue: min,
    primaryUnit: "cm",
    derived: {
      right_cm: { value: right, unit: "cm", label: "Dorsiflexão — Direita" },
      left_cm: { value: left, unit: "cm", label: "Dorsiflexão — Esquerda" },
      asymmetry_pct: { value: asymmetryPct, unit: "%", label: "Assimetria bilateral" },
    },
    basis: "Bennell et al. (1998). Br J Sports Med. Valor mínimo apresentado como restritivo.",
    confidence: 0.90,
    warnings,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// DISPATCHER — executa pelo equationCode
// ─────────────────────────────────────────────────────────────────────────────

const EQUATION_MAP: Record<string, (inputs: ProtocolInputs) => CalculationResult> = {
  JP7_MALE_SIRI: jp7MaleSiri,
  JP7_FEMALE_SIRI: jp7FemaleSiri,
  JP3_MALE_SIRI: jp3MaleSiri,
  JP3_FEMALE_SIRI: jp3FemaleSiri,
  GUEDES_3_SIRI: guedes3Siri,
  FAULKNER_4: faulkner4,
  PETROSKI_4_MALE_SIRI: petroski4MaleSiri,
  COOPER_VO2MAX: cooperVo2max,
  ROCKPORT_VO2MAX: rockportVo2max,
  LEGER_VO2MAX: legerVo2max,
  SIX_MIN_WALK_VO2: sixMinWalkVo2,
  VDOT_DANIELS: vdotDaniels,
  ONE_RM_DIRECT: oneRmDirect,
  EPLEY_FORMULA: epleyFormula,
  BRZYCKI_FORMULA: brzyckiFormula,
  MAYHEW_FORMULA: mayhewFormula,
  HANDGRIP_ASYMMETRY: handgripAsymmetry,
  CMJ_BEST_HEIGHT: cmjBestHeight,
  SJ_BEST_HEIGHT: sjBestHeight,
  FTP_20MIN_FACTOR: ftp20minFactor,
  SPRINT_BEST_TIME: sprintBestTimeExport,
  AGILITY_BEST_TIME: agilityBestTime,
  WELLS_BEST: wellsBest,
  DORSIFLEXION_ASYMMETRY: dorsiflexionAsymmetry,
};

/**
 * Ponto de entrada principal.
 * Executa o cálculo pelo equationCode do protocolo.
 * Lança ProtocolInputError para entradas inválidas.
 * Lança Error para equationCode desconhecido.
 */
export function runProtocolCalculation(
  equationCode: string,
  inputs: ProtocolInputs,
): CalculationResult {
  const fn = EQUATION_MAP[equationCode];
  if (!fn) {
    throw new Error(
      `Equação "${equationCode}" não registrada no protocol-engine. ` +
      `Disponíveis: ${Object.keys(EQUATION_MAP).join(", ")}`,
    );
  }
  return fn(inputs);
}

export { ProtocolInputError };
