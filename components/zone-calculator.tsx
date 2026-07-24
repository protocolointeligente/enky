"use client";

import { useState } from "react";
import Link from "next/link";
import type { PerformanceProfile } from "@/modules/assessments/performance-profile";
import type { ZoneProvenance } from "@/modules/workouts/zone-provenance";
import { computeZones, sourceForMethod, zoneInputsFromProfile } from "@/modules/training-zones/zone-engine";
import { zoneMethodsForModality } from "@/modules/training-zones/zone-registry";
import { strengthLoadFromPercent, type LoadIncrement } from "@/modules/training-zones/strength-zones";
import type { ZoneBand } from "@/modules/training-zones/training-zone-types";
import { uiClasses } from "@/app/_lib/ui";

// Seção de intensidade por ZONA (fatia D). O treinador escolhe método e zona; o
// motor (puro, client-side) calcula a faixa real a partir do perfil consolidado
// e mostra a FONTE. Ausência de dado é explícita (nunca zera/inventa); avaliação
// expirada avisa; o resultado aplicado carrega a proveniência para o passo.

type TargetType = "PACE" | "HEART_RATE_ZONE" | "POWER" | "CADENCE" | "RPE";

const METRIC_FOR_TARGET: Record<string, string> = {
  HEART_RATE_ZONE: "HEART_RATE",
  POWER: "POWER",
  // PACE mapeia para natação (s/100m) ou corrida (s/km) conforme a modalidade.
};

function clock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = String(Math.round(seconds % 60)).padStart(2, "0");
  return `${m}:${s}`;
}

export function formatBand(band: ZoneBand): string {
  switch (band.unit) {
    case "bpm":
      return `${band.lowerBound}–${band.upperBound} bpm`;
    case "W":
      return `${band.lowerBound}–${band.upperBound} W`;
    case "s/km":
      return `${clock(band.lowerBound)}–${clock(band.upperBound)}/km`;
    case "s/100m":
      return `${clock(band.lowerBound)}–${clock(band.upperBound)}/100m`;
    case "kg":
      return `${band.lowerBound}–${band.upperBound} kg`;
  }
}

// Carga por %1RM (fatia D2). O treinador escolhe um 1RM avaliado do atleta e um
// intervalo de %; a carga sugerida (arredondada) preenche o campo de carga.
export function StrengthZoneCalculator({
  athleteId,
  profile,
  onApply,
}: {
  athleteId: string;
  profile: PerformanceProfile | null;
  onApply: (loadKg: number, provenance: ZoneProvenance) => void;
}) {
  const [open, setOpen] = useState(false);
  const [exerciseId, setExerciseId] = useState("");
  const [low, setLow] = useState("70");
  const [high, setHigh] = useState("75");
  const [increment, setIncrement] = useState<LoadIncrement>(2.5);

  if (!profile) return <p className="mt-1 text-[11px] text-faint">Carregando avaliações…</p>;

  const options = profile.oneRepMax;
  const selected = options.find((o) => o.exerciseId === exerciseId) ?? options[0] ?? null;
  const result = selected
    ? strengthLoadFromPercent(selected.metric.value, Number(low), Number(high), increment)
    : null;

  return (
    <div className="mt-2 rounded-lg border border-line bg-deep/30 p-2.5">
      <button
        type="button"
        className="flex w-full items-center justify-between text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="text-[11px] font-semibold text-electric-hi">Calcular carga por %1RM</span>
        <span className="text-faint">{open ? "▾" : "▸"}</span>
      </button>
      {open &&
        (options.length === 0 ? (
          <div className="mt-2 rounded-md border border-orange/30 bg-orange/10 p-2 text-[11px] text-orange-hi">
            Este atleta ainda não possui 1RM avaliado.{" "}
            <Link href={`/treinador/atletas/${athleteId}`} className="font-medium underline">
              Cadastrar avaliação
            </Link>
          </div>
        ) : (
          <div className="mt-2 flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <select
                className={`${uiClasses.select} h-8 py-1 text-xs`}
                value={selected?.exerciseId ?? ""}
                onChange={(e) => setExerciseId(e.target.value)}
              >
                {options.map((o) => (
                  <option key={o.exerciseId} value={o.exerciseId}>
                    {(o.exerciseName ?? "Exercício") + ` — ${o.metric.value} kg`}
                    {o.metric.estimated ? " (est.)" : ""}
                  </option>
                ))}
              </select>
              <input
                type="number"
                className={`${uiClasses.input} h-8 w-16 py-1 text-xs`}
                value={low}
                onChange={(e) => setLow(e.target.value)}
                aria-label="% mínimo"
              />
              <span className="text-[11px] text-faint">–</span>
              <input
                type="number"
                className={`${uiClasses.input} h-8 w-16 py-1 text-xs`}
                value={high}
                onChange={(e) => setHigh(e.target.value)}
                aria-label="% máximo"
              />
              <span className="text-[11px] text-faint">%</span>
              <select
                className={`${uiClasses.select} h-8 py-1 text-xs`}
                value={increment}
                onChange={(e) => setIncrement(Number(e.target.value) as LoadIncrement)}
              >
                {[0.5, 1, 2, 2.5, 5].map((i) => (
                  <option key={i} value={i}>
                    {i} kg
                  </option>
                ))}
              </select>
            </div>
            {result && !result.ok && <p className="text-[11px] text-danger">{result.error.message}</p>}
            {result && result.ok && selected && (
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-muted">
                  {formatBand(result.zones[0]!)} · 1RM {selected.metric.value} kg
                  {selected.metric.estimated ? " (estimado)" : ""}
                </span>
                <button
                  type="button"
                  className="rounded-md border border-line bg-surface px-2 py-1 text-[11px] text-ink hover:border-electric hover:text-electric-hi"
                  onClick={() =>
                    onApply(result.zones[0]!.lowerBound, {
                      intensityMethod: "STRENGTH_PERCENT_1RM",
                      zoneCode: result.zones[0]!.zoneCode,
                      calculatedLowerBound: result.zones[0]!.lowerBound,
                      calculatedUpperBound: result.zones[0]!.upperBound,
                      unit: "kg",
                      formulaCode: result.methodCode,
                      formulaVersion: result.methodVersion,
                      assessmentId: selected.metric.assessmentId,
                      assessmentDate: selected.metric.assessmentDate,
                      wasManuallyOverridden: false,
                      overrideReason: null,
                    })
                  }
                >
                  Aplicar carga
                </button>
              </div>
            )}
          </div>
        ))}
    </div>
  );
}

export function ZoneCalculator({
  athleteId,
  modality,
  targetType,
  profile,
  onApply,
}: {
  athleteId: string;
  modality: string;
  targetType: TargetType;
  profile: PerformanceProfile | null;
  onApply: (lower: number, upper: number, provenance: ZoneProvenance) => void;
}) {
  const metricType =
    targetType === "PACE"
      ? modality === "SWIMMING"
        ? "SWIM_PACE"
        : "PACE"
      : METRIC_FOR_TARGET[targetType];

  const methods = metricType
    ? zoneMethodsForModality(modality).filter((m) => m.metricType === metricType)
    : [];

  const [method, setMethod] = useState<string>(methods[0]?.code ?? "");
  const [open, setOpen] = useState(false);

  // RPE/cadência não têm zona calculada — entrada manual segue valendo.
  if (!metricType || methods.length === 0) return null;

  if (!profile) {
    return (
      <p className="mt-1 text-[11px] text-faint">Carregando avaliações do atleta…</p>
    );
  }

  const result = method ? computeZones(method, zoneInputsFromProfile(profile)) : null;
  const source = method ? sourceForMethod(profile, method) : null;

  return (
    <div className="mt-2 rounded-lg border border-line bg-deep/30 p-2.5">
      <button
        type="button"
        className="flex w-full items-center justify-between text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="text-[11px] font-semibold text-electric-hi">Calcular por zona</span>
        <span className="text-faint">{open ? "▾" : "▸"}</span>
      </button>

      {open && (
        <div className="mt-2 flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-[11px] text-faint">Método</label>
            <select
              className={`${uiClasses.select} h-8 py-1 text-xs`}
              value={method}
              onChange={(e) => setMethod(e.target.value)}
            >
              {methods.map((m) => (
                <option key={m.code} value={m.code}>
                  {m.description}
                  {m.status === "EXPERIMENTAL" ? " (experimental)" : ""}
                </option>
              ))}
            </select>
          </div>

          {result && !result.ok && result.error.code === "MISSING_INPUT" && (
            <div className="rounded-md border border-orange/30 bg-orange/10 p-2 text-[11px] text-orange-hi">
              Este atleta ainda não possui os dados necessários para calcular esta zona.
              <div className="mt-1">
                <Link href={`/treinador/atletas/${athleteId}`} className="font-medium underline">
                  Cadastrar avaliação
                </Link>{" "}
                — ou use RPE / informe o valor manualmente acima.
              </div>
            </div>
          )}

          {result && !result.ok && result.error.code !== "MISSING_INPUT" && (
            <p className="text-[11px] text-danger">{result.error.message}</p>
          )}

          {result && result.ok && (
            <>
              {source?.expired && (
                <p className="text-[11px] text-orange-hi">
                  ⚠ Avaliação de origem expirou em {source.validUntil}. Atualize para uma faixa confiável.
                </p>
              )}
              <div className="flex flex-wrap gap-1.5">
                {result.zones.map((band) => (
                  <button
                    key={band.zoneCode}
                    type="button"
                    className="rounded-md border border-line bg-surface px-2 py-1 text-[11px] text-ink transition-colors hover:border-electric hover:text-electric-hi"
                    title={`${band.label}: ${formatBand(band)}`}
                    onClick={() =>
                      onApply(band.lowerBound, band.upperBound, {
                        intensityMethod: method,
                        zoneCode: band.zoneCode,
                        calculatedLowerBound: band.lowerBound,
                        calculatedUpperBound: band.upperBound,
                        unit: band.unit,
                        formulaCode: result.methodCode,
                        formulaVersion: result.methodVersion,
                        assessmentId: source?.assessmentId ?? null,
                        assessmentDate: source?.assessmentDate ?? null,
                        wasManuallyOverridden: false,
                        overrideReason: null,
                      })
                    }
                  >
                    {band.zoneCode}
                  </button>
                ))}
              </div>
              {source && (
                <p className="text-[10px] text-faint">
                  Fonte: {source.source.toLowerCase()}
                  {source.estimated ? " (estimado)" : ""} · avaliação de {source.assessmentDate} ·
                  confiança {source.confidence.toLowerCase()} · fórmula {result.methodCode} v
                  {result.methodVersion}
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
