// Motor de zonas (fatia C) — tipos compartilhados. Toda fórmula é PURA,
// determinística, versionada e retorna erro TIPADO (nunca lança para fluxo de
// negócio). As unidades seguem o contrato das avaliações (ver
// modules/assessments/README.md): bpm, s/km, s/100m, W, kg.

export type ZoneUnit = "bpm" | "s/km" | "s/100m" | "W" | "kg";

export interface ZoneBand {
  zoneCode: string;
  label: string;
  lowerBound: number; // para pace/s-por-100m, o MENOR número é o mais RÁPIDO
  upperBound: number;
  unit: ZoneUnit;
}

export interface ZoneError {
  code: "MISSING_INPUT" | "INVALID_INPUT" | "UNKNOWN_METHOD" | "UNKNOWN_ZONE";
  message: string;
  missing?: string[];
}

export type ZoneComputation =
  | {
      ok: true;
      methodCode: string;
      methodVersion: string;
      unit: ZoneUnit;
      zones: ZoneBand[];
      limitations: string[];
    }
  | { ok: false; error: ZoneError };

export function missingInput(missing: string[]): ZoneComputation {
  return {
    ok: false,
    error: { code: "MISSING_INPUT", message: `Faltam dados: ${missing.join(", ")}.`, missing },
  };
}

export function invalidInput(message: string): ZoneComputation {
  return { ok: false, error: { code: "INVALID_INPUT", message } };
}

// pace (s/km) a partir de velocidade em metros por minuto.
export function paceFromVelocity(metersPerMin: number): number {
  return Math.round(60000 / metersPerMin);
}

// Converte uma tabela de FRAÇÕES de velocidade (de uma referência) em faixas de
// pace. Mais rápido (fração maior) => pace menor, então lowerBound usa fHigh.
export function velocityFractionsToPaceBands(
  refMetersPerMin: number,
  table: { zoneCode: string; label: string; low: number; high: number }[],
  unit: "s/km" | "s/100m",
  distanceMeters: 1000 | 100,
): ZoneBand[] {
  // pace (s por distância) = distância(m) × 60 / velocidade(m/min).
  const paceAt = (fraction: number) => Math.round((distanceMeters * 60) / (fraction * refMetersPerMin));
  return table.map((z) => ({
    zoneCode: z.zoneCode,
    label: z.label,
    lowerBound: paceAt(z.high), // mais rápido
    upperBound: paceAt(z.low), // mais lento
    unit,
  }));
}
