import {
  invalidInput,
  missingInput,
  velocityFractionsToPaceBands,
  type ZoneComputation,
} from "./training-zone-types";

// Zonas de PACE (corrida). Cada método tem a sua fórmula e a sua tabela — não há
// função genérica que misture referências (limiar × VDOT × velocidade crítica).
// Internamente tudo vira velocidade (m/min); a saída é pace em s/km (mais rápido
// = número menor). O front formata mm:ss.

export const PACE_THRESHOLD_VERSION = "1.0.0";
export const PACE_VAM_VERSION = "1.0.0";
export const PACE_CRITICAL_SPEED_VERSION = "1.0.0";
export const PACE_VDOT_VERSION = "1.0.0";

// Frações da velocidade de LIMIAR (referência = vLT).
const THRESHOLD_TABLE = [
  { zoneCode: "RECOVERY", label: "Regenerativo", low: 0.65, high: 0.79 },
  { zoneCode: "EASY", label: "Fácil", low: 0.79, high: 0.87 },
  { zoneCode: "MARATHON", label: "Maratona", low: 0.87, high: 0.94 },
  { zoneCode: "THRESHOLD", label: "Limiar", low: 0.94, high: 1.02 },
  { zoneCode: "INTERVAL", label: "Intervalado", low: 1.02, high: 1.1 },
  { zoneCode: "REPETITION", label: "Repetição", low: 1.1, high: 1.22 },
];

// Frações da velocidade aeróbia máxima (referência = vVO2máx) — VAM/CV/VDOT.
const VVO2_TABLE = [
  { zoneCode: "RECOVERY", label: "Regenerativo", low: 0.5, high: 0.62 },
  { zoneCode: "EASY", label: "Fácil", low: 0.62, high: 0.72 },
  { zoneCode: "MARATHON", label: "Maratona", low: 0.72, high: 0.8 },
  { zoneCode: "THRESHOLD", label: "Limiar", low: 0.8, high: 0.9 },
  { zoneCode: "INTERVAL", label: "Intervalado", low: 0.95, high: 1.0 },
  { zoneCode: "REPETITION", label: "Repetição", low: 1.0, high: 1.1 },
];

function plausiblePace(secPerKm: number): boolean {
  return secPerKm >= 90 && secPerKm <= 1200;
}
function plausibleKmh(v: number): boolean {
  return v >= 3 && v <= 40;
}

export function paceZonesFromThreshold(
  thresholdPaceSecPerKm: number | null | undefined,
): ZoneComputation {
  if (thresholdPaceSecPerKm == null) return missingInput(["thresholdPace"]);
  if (!plausiblePace(thresholdPaceSecPerKm)) return invalidInput("Pace de limiar fora de faixa plausível.");
  const vLT = 60000 / thresholdPaceSecPerKm; // m/min
  return {
    ok: true,
    methodCode: "PACE_THRESHOLD",
    methodVersion: PACE_THRESHOLD_VERSION,
    unit: "s/km",
    zones: velocityFractionsToPaceBands(vLT, THRESHOLD_TABLE, "s/km", 1000),
    limitations: ["Depende de um pace de limiar recente; frações são um default v1 (escola Friel/Pfitzinger)."],
  };
}

export function paceZonesFromVam(vamKmh: number | null | undefined): ZoneComputation {
  if (vamKmh == null) return missingInput(["vam"]);
  if (!plausibleKmh(vamKmh)) return invalidInput("VAM fora de faixa plausível.");
  const vVO2 = (vamKmh * 1000) / 60; // m/min
  return {
    ok: true,
    methodCode: "PACE_VAM",
    methodVersion: PACE_VAM_VERSION,
    unit: "s/km",
    zones: velocityFractionsToPaceBands(vVO2, VVO2_TABLE, "s/km", 1000),
    limitations: ["VAM ≈ velocidade a vVO2máx; frações por zona são aproximação v1."],
  };
}

export function paceZonesFromCriticalSpeed(
  criticalSpeedKmh: number | null | undefined,
): ZoneComputation {
  if (criticalSpeedKmh == null) return missingInput(["criticalSpeed"]);
  if (!plausibleKmh(criticalSpeedKmh)) return invalidInput("Velocidade crítica fora de faixa plausível.");
  const vCV = (criticalSpeedKmh * 1000) / 60;
  // CV ≈ limiar: usamos a tabela de LIMIAR ancorada na velocidade crítica.
  return {
    ok: true,
    methodCode: "PACE_CRITICAL_SPEED",
    methodVersion: PACE_CRITICAL_SPEED_VERSION,
    unit: "s/km",
    zones: velocityFractionsToPaceBands(vCV, THRESHOLD_TABLE, "s/km", 1000),
    limitations: ["Velocidade crítica ≈ limiar; interpretação depende do protocolo de teste."],
  };
}

// Daniels: resolve vVO2máx (m/min) a partir do VDOT invertendo a equação de
// custo de O2: VO2 = -4.60 + 0.182258·v + 0.000104·v². EXPERIMENTAL — as frações
// de %vVO2máx por zona são uma aproximação das paces de Daniels, não a tabela
// oficial. Ver limitations.
export function paceZonesFromVdot(vdot: number | null | undefined): ZoneComputation {
  if (vdot == null) return missingInput(["vdot"]);
  if (vdot < 20 || vdot > 90) return invalidInput("VDOT fora de faixa plausível.");
  // 0.000104 v² + 0.182258 v - (4.60 + vdot) = 0
  const a = 0.000104;
  const b = 0.182258;
  const c = -(4.6 + vdot);
  const v = (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a); // m/min a vVO2máx
  return {
    ok: true,
    methodCode: "PACE_VDOT",
    methodVersion: PACE_VDOT_VERSION,
    unit: "s/km",
    zones: velocityFractionsToPaceBands(v, VVO2_TABLE, "s/km", 1000),
    limitations: [
      "EXPERIMENTAL: aproxima as paces de Daniels por frações de vVO2máx; não substitui a tabela oficial VDOT.",
    ],
  };
}
