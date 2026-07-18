import {
  invalidInput,
  missingInput,
  velocityFractionsToPaceBands,
  type ZoneComputation,
} from "./training-zone-types";

// Zonas de NATAÇÃO a partir do CSS (critical swim speed), guardado como ritmo em
// s/100m. Saída em s/100m (mais rápido = menor). Frações da velocidade de CSS.

export const SWIM_CSS_VERSION = "1.0.0";

const CSS_TABLE = [
  { zoneCode: "RECOVERY", label: "Regenerativo", low: 0.8, high: 0.88 },
  { zoneCode: "EASY", label: "Aeróbico leve", low: 0.88, high: 0.94 },
  { zoneCode: "AEROBIC", label: "Aeróbico", low: 0.94, high: 1.0 },
  { zoneCode: "THRESHOLD", label: "Limiar (CSS)", low: 1.0, high: 1.03 },
  { zoneCode: "VO2", label: "VO2máx", low: 1.03, high: 1.08 },
  { zoneCode: "SPRINT", label: "Velocidade", low: 1.08, high: 1.2 },
];

function plausibleCss(secPer100m: number): boolean {
  return secPer100m >= 40 && secPer100m <= 240;
}

export function swimZonesFromCss(cssSecPer100m: number | null | undefined): ZoneComputation {
  if (cssSecPer100m == null) return missingInput(["css"]);
  if (!plausibleCss(cssSecPer100m)) return invalidInput("CSS fora de faixa plausível.");
  const vCss = 6000 / cssSecPer100m; // m/min (100 m por css s)
  return {
    ok: true,
    methodCode: "SWIM_CSS",
    methodVersion: SWIM_CSS_VERSION,
    unit: "s/100m",
    zones: velocityFractionsToPaceBands(vCss, CSS_TABLE, "s/100m", 100),
    limitations: ["CSS estima o limiar por 2 tempos (400/200 m); não separa ritmo técnico de recuperação."],
  };
}
