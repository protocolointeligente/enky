import {
  invalidInput,
  missingInput,
  type ZoneBand,
  type ZoneComputation,
} from "./training-zone-types";

// Zonas de frequência cardíaca. Três métodos, cada um com a SUA fórmula (não há
// função genérica que misture métodos). Tabelas de percentuais são o default v1,
// versionadas; a configuração por organização é uma fatia futura.

export const HR_MAX_VERSION = "1.0.0";
export const HR_RESERVE_VERSION = "1.0.0";
export const HR_THRESHOLD_VERSION = "1.0.0";

const plausibleHr = (v: number) => v >= 90 && v <= 250; // FC máx/limiar
const plausibleRestingHr = (v: number) => v >= 30 && v <= 120; // FC de repouso

// %FCmáx por zona.
const HR_MAX_TABLE = [
  { zoneCode: "Z1", label: "Recuperação", low: 0.5, high: 0.6 },
  { zoneCode: "Z2", label: "Aeróbico leve", low: 0.6, high: 0.7 },
  { zoneCode: "Z3", label: "Aeróbico", low: 0.7, high: 0.8 },
  { zoneCode: "Z4", label: "Limiar", low: 0.8, high: 0.9 },
  { zoneCode: "Z5", label: "VO2máx", low: 0.9, high: 1.0 },
];

// %FC de limiar (LTHR), estilo Friel.
const HR_THRESHOLD_TABLE = [
  { zoneCode: "Z1", label: "Recuperação", low: 0.6, high: 0.85 },
  { zoneCode: "Z2", label: "Aeróbico", low: 0.85, high: 0.89 },
  { zoneCode: "Z3", label: "Tempo", low: 0.9, high: 0.94 },
  { zoneCode: "Z4", label: "Limiar", low: 0.95, high: 0.99 },
  { zoneCode: "Z5", label: "VO2máx", low: 1.0, high: 1.06 },
];

export function hrMaxZones(maximumHeartRate: number | null | undefined): ZoneComputation {
  if (maximumHeartRate == null) return missingInput(["maximumHeartRate"]);
  if (!plausibleHr(maximumHeartRate)) return invalidInput("FC máxima fora de faixa plausível.");
  const zones: ZoneBand[] = HR_MAX_TABLE.map((z) => ({
    zoneCode: z.zoneCode,
    label: z.label,
    lowerBound: Math.round(z.low * maximumHeartRate),
    upperBound: Math.round(z.high * maximumHeartRate),
    unit: "bpm",
  }));
  return {
    ok: true,
    methodCode: "HR_MAX",
    methodVersion: HR_MAX_VERSION,
    unit: "bpm",
    zones,
    limitations: ["Baseado só na FC máxima; ignora a FC de repouso (indivíduos com FCrep baixa ficam subestimados nas zonas baixas)."],
  };
}

// Karvonen: FC alvo = FCrep + %reserva × (FCmáx − FCrep). Usa a mesma tabela de
// percentuais da FCmáx, mas aplicada à RESERVA — mais individualizada.
export function hrReserveZones(
  maximumHeartRate: number | null | undefined,
  restingHeartRate: number | null | undefined,
): ZoneComputation {
  const missing: string[] = [];
  if (maximumHeartRate == null) missing.push("maximumHeartRate");
  if (restingHeartRate == null) missing.push("restingHeartRate");
  if (missing.length) return missingInput(missing);
  if (!plausibleHr(maximumHeartRate!) || !plausibleRestingHr(restingHeartRate!)) {
    return invalidInput("FC fora de faixa plausível.");
  }
  if (restingHeartRate! >= maximumHeartRate!) {
    return invalidInput("FC de repouso deve ser menor que a FC máxima.");
  }
  const reserve = maximumHeartRate! - restingHeartRate!;
  const zones: ZoneBand[] = HR_MAX_TABLE.map((z) => ({
    zoneCode: z.zoneCode,
    label: z.label,
    lowerBound: Math.round(restingHeartRate! + z.low * reserve),
    upperBound: Math.round(restingHeartRate! + z.high * reserve),
    unit: "bpm",
  }));
  return {
    ok: true,
    methodCode: "HR_RESERVE",
    methodVersion: HR_RESERVE_VERSION,
    unit: "bpm",
    zones,
    limitations: ["Karvonen assume relação linear FC×intensidade; a FC de repouso deve ser medida em condições padronizadas."],
  };
}

export function hrThresholdZones(
  thresholdHeartRate: number | null | undefined,
): ZoneComputation {
  if (thresholdHeartRate == null) return missingInput(["thresholdHeartRate"]);
  if (!plausibleHr(thresholdHeartRate)) return invalidInput("FC de limiar fora de faixa plausível.");
  const zones: ZoneBand[] = HR_THRESHOLD_TABLE.map((z) => ({
    zoneCode: z.zoneCode,
    label: z.label,
    lowerBound: Math.round(z.low * thresholdHeartRate),
    upperBound: Math.round(z.high * thresholdHeartRate),
    unit: "bpm",
  }));
  return {
    ok: true,
    methodCode: "HR_THRESHOLD",
    methodVersion: HR_THRESHOLD_VERSION,
    unit: "bpm",
    zones,
    limitations: ["Depende de um teste de limiar recente e específico da modalidade; LTHR muda entre corrida e ciclismo."],
  };
}
