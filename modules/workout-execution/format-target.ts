// Formatação de alvos de passo por modalidade (§15). PURO e testável. Usa só o
// que a prescrição já modela (stepType, distância, duração, targetType/min/max —
// PACE/HEART_RATE_ZONE/POWER/CADENCE/RPE). NÃO inventa campos ausentes
// (FTP absoluto, zonas Coggan nomeadas, CSS, piscina 25/50m, estilo) — esses
// dependem de extensão da prescription-schema (follow-up do treinador).

export type ExecModality = "RUNNING" | "CYCLING" | "SWIMMING";

export interface TargetStep {
  stepType: string;
  repetitions: number | null;
  durationSeconds: number | null;
  distanceMeters: number | null;
  targetType: string | null;
  targetMin: string | null;
  targetMax: string | null;
}

// segundos → m:ss (ou h:mm:ss acima de 1h).
export function secToClock(total: number): string {
  const s = Math.max(0, Math.round(total));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${pad(sec)}` : `${mm}:${pad(sec)}`;
}

function paceUnit(modality: ExecModality): string {
  return modality === "SWIMMING" ? "/100m" : "/km";
}

function num(v: string | null): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function range(min: string | null, max: string | null, fmt: (n: number) => string): string | null {
  const lo = num(min);
  const hi = num(max);
  if (lo == null && hi == null) return null;
  if (lo != null && hi != null && lo !== hi) return `${fmt(lo)}–${fmt(hi)}`;
  return fmt((lo ?? hi) as number);
}

// Alvo de intensidade formatado para a modalidade, ou null se não há alvo.
export function formatTarget(step: TargetStep, modality: ExecModality): string | null {
  switch (step.targetType) {
    case "PACE":
      return range(step.targetMin, step.targetMax, secToClock)?.concat(` ${paceUnit(modality)}`) ?? null;
    case "POWER":
      return range(step.targetMin, step.targetMax, (n) => `${Math.round(n)}`)?.concat(" W") ?? null;
    case "CADENCE": {
      const unit = modality === "SWIMMING" ? "spm" : "rpm";
      return range(step.targetMin, step.targetMax, (n) => `${Math.round(n)}`)?.concat(` ${unit}`) ?? null;
    }
    case "HEART_RATE_ZONE":
      return range(step.targetMin, step.targetMax, (n) => `${Math.round(n)}`)
        ? `Zona ${range(step.targetMin, step.targetMax, (n) => `${Math.round(n)}`)}`
        : null;
    case "RPE":
      return range(step.targetMin, step.targetMax, (n) => `${n}`)?.replace(/^/, "RPE ") ?? null;
    default:
      return null;
  }
}

// Headline de volume: distância (km para corrida/ciclismo, m para natação) ou
// duração. Retorna null quando o passo não declara nem uma nem outra.
export function formatVolume(step: TargetStep, modality: ExecModality): string | null {
  if (step.distanceMeters != null) {
    if (modality === "SWIMMING") return `${step.distanceMeters} m`;
    const km = step.distanceMeters / 1000;
    return km >= 1 ? `${Number(km.toFixed(2))} km` : `${step.distanceMeters} m`;
  }
  if (step.durationSeconds != null) return secToClock(step.durationSeconds);
  return null;
}
