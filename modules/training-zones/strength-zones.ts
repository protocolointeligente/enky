import { invalidInput, type ZoneComputation } from "./training-zone-types";

// Força: estimativa de 1RM (fórmulas clássicas) e faixa de CARGA por %1RM. A
// carga calculada é SUGESTÃO (arredondada aos incrementos disponíveis). RIR/RPE
// são prescrições diretas — não derivam de 1RM e não vivem aqui.

export const ONE_RM_VERSION = "1.0.0";
export const STRENGTH_PERCENT_1RM_VERSION = "1.0.0";

export type OneRmFormula = "ONE_RM_DIRECT" | "EPLEY" | "BRZYCKI" | "LANDER" | "O_CONNER";

// Estima 1RM a partir de carga × repetições. Fórmulas válidas até ~10-12 reps;
// acima disso a extrapolação degrada (retornamos null para reps implausíveis).
export function estimateOneRepMax(
  formula: OneRmFormula,
  loadKg: number,
  reps: number,
): number | null {
  if (loadKg <= 0 || reps < 1 || reps > 30) return null;
  if (formula === "ONE_RM_DIRECT") return reps === 1 ? loadKg : null;
  let oneRm: number;
  switch (formula) {
    case "EPLEY":
      oneRm = loadKg * (1 + reps / 30);
      break;
    case "BRZYCKI":
      // Denominador zera em 37 reps; já barrado por reps<=30, mas guardamos.
      if (37 - reps <= 0) return null;
      oneRm = (loadKg * 36) / (37 - reps);
      break;
    case "LANDER":
      oneRm = (100 * loadKg) / (101.3 - 2.67123 * reps);
      break;
    case "O_CONNER":
      oneRm = loadKg * (1 + 0.025 * reps);
      break;
    default:
      return null;
  }
  return Math.round(oneRm * 10) / 10;
}

export const LOAD_INCREMENTS = [0.5, 1, 2, 2.5, 5] as const;
export type LoadIncrement = (typeof LOAD_INCREMENTS)[number];

function roundTo(value: number, increment: number): number {
  return Math.round(value / increment) * increment;
}

// Faixa de carga (kg) para uma zona de %1RM (ex.: 70–75%). Uma "zona" aqui é o
// próprio intervalo percentual escolhido pelo treinador.
export function strengthLoadFromPercent(
  oneRepMax: number | null | undefined,
  percentLow: number,
  percentHigh: number,
  increment: LoadIncrement = 2.5,
): ZoneComputation {
  if (oneRepMax == null) {
    return { ok: false, error: { code: "MISSING_INPUT", message: "Faltam dados: oneRepMax.", missing: ["oneRepMax"] } };
  }
  if (oneRepMax <= 0 || oneRepMax > 1000) return invalidInput("1RM fora de faixa plausível.");
  if (percentLow <= 0 || percentHigh > 120 || percentLow > percentHigh) {
    return invalidInput("Faixa de %1RM inválida.");
  }
  const lower = roundTo((percentLow / 100) * oneRepMax, increment);
  const upper = roundTo((percentHigh / 100) * oneRepMax, increment);
  return {
    ok: true,
    methodCode: "STRENGTH_PERCENT_1RM",
    methodVersion: STRENGTH_PERCENT_1RM_VERSION,
    unit: "kg",
    zones: [
      {
        zoneCode: `${percentLow}-${percentHigh}%`,
        label: `${percentLow}–${percentHigh}% 1RM`,
        lowerBound: lower,
        upperBound: upper,
        unit: "kg",
      },
    ],
    limitations: [
      "Carga é SUGESTÃO arredondada aos incrementos; o 1RM estimado carrega o erro da fórmula de origem.",
    ],
  };
}
