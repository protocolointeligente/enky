// Zonas de treino a partir de um teste de limiar, nos esquemas padrão da
// indústria (mesmos de intervals.icu / TrainingPeaks). Puro: dado o valor de
// limiar (FTP em W, LTHR em bpm), devolve as faixas absolutas. Derivado na
// leitura — nunca persistido — então trocar o esquema não deixa dado velho.

export type ZoneScheme = "POWER_COGGAN" | "HR_FRIEL";

export interface Zone {
  label: string;
  /** Limite inferior inclusivo na unidade do teste (null = aberto para baixo). */
  min: number | null;
  /** Limite superior inclusivo (null = aberto para cima). */
  max: number | null;
}

export interface ZoneSet {
  scheme: ZoneScheme;
  unit: string;
  /** Valor de limiar usado como base (FTP ou LTHR). */
  threshold: number;
  zones: Zone[];
}

interface Band {
  label: string;
  loPct: number;
  hiPct: number | null; // null = sem teto
}

// Coggan (7 zonas, % do FTP). https://www.trainingpeaks.com/ — padrão de ciclismo.
const COGGAN_POWER: Band[] = [
  { label: "Z1 · Recuperação", loPct: 0, hiPct: 0.55 },
  { label: "Z2 · Endurance", loPct: 0.56, hiPct: 0.75 },
  { label: "Z3 · Tempo", loPct: 0.76, hiPct: 0.9 },
  { label: "Z4 · Limiar", loPct: 0.91, hiPct: 1.05 },
  { label: "Z5 · VO2máx", loPct: 1.06, hiPct: 1.2 },
  { label: "Z6 · Anaeróbico", loPct: 1.21, hiPct: 1.5 },
  { label: "Z7 · Neuromuscular", loPct: 1.51, hiPct: null },
];

// Friel (7 zonas, % do LTHR). Padrão de FC para corrida/ciclismo.
const FRIEL_HR: Band[] = [
  { label: "Z1 · Recuperação", loPct: 0, hiPct: 0.84 },
  { label: "Z2 · Aeróbico", loPct: 0.85, hiPct: 0.89 },
  { label: "Z3 · Tempo", loPct: 0.9, hiPct: 0.94 },
  { label: "Z4 · SubLimiar", loPct: 0.95, hiPct: 0.99 },
  { label: "Z5a · SuperLimiar", loPct: 1.0, hiPct: 1.02 },
  { label: "Z5b · Aeróbico Capacity", loPct: 1.03, hiPct: 1.06 },
  { label: "Z5c · Anaeróbico", loPct: 1.07, hiPct: null },
];

function applyBands(threshold: number, bands: Band[], scheme: ZoneScheme, unit: string): ZoneSet {
  const zones: Zone[] = bands.map((b) => ({
    label: b.label,
    min: b.loPct === 0 ? null : Math.round(threshold * b.loPct),
    max: b.hiPct === null ? null : Math.round(threshold * b.hiPct),
  }));
  return { scheme, unit, threshold, zones };
}

export function computePowerZones(ftpWatts: number): ZoneSet {
  return applyBands(ftpWatts, COGGAN_POWER, "POWER_COGGAN", "W");
}

export function computeHrZones(lthrBpm: number): ZoneSet {
  return applyBands(lthrBpm, FRIEL_HR, "HR_FRIEL", "bpm");
}

// Resolve o esquema pela UNIDADE do teste (mais robusto que o texto livre do
// testType). Só limiares numéricos diretos por ora — pace/CSS entram quando o
// input for mm:ss. Valor inválido → sem zonas.
export function computeZonesForTest(unit: string, value: number): ZoneSet | null {
  if (!Number.isFinite(value) || value <= 0) return null;
  const u = unit.trim().toLowerCase();
  if (u === "w" || u === "watts" || u === "watt") return computePowerZones(value);
  if (u === "bpm") return computeHrZones(value);
  return null;
}
