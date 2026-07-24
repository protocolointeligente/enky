"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch, ApiClientError } from "@/app/_lib/api-client";
import { uiClasses } from "@/app/_lib/ui";
import { useRequireRole } from "@/app/_lib/use-session";
import { EmptyState } from "@/components/ui/empty-state";
import { TrendingUpIcon } from "@/components/ui/icons";
import {
  buildPmcChart,
  pmcSummaryText,
  pmcTrend,
  type ChartPoint,
} from "@/modules/metrics/pmc-chart";

interface Metrics {
  points: ChartPoint[];
  current: { ctl: number; atl: number; tsb: number } | null;
  dataDays: number;
  windowDays: number;
}

const RANGES = [
  { days: 28, label: "4 sem" },
  { days: 56, label: "8 sem" },
  { days: 84, label: "12 sem" },
  { days: 182, label: "6 meses" },
  { days: 365, label: "1 ano" },
] as const;

// CTL = fitness (carga crônica), ATL = fadiga (carga aguda), TSB = forma.
const SERIES = [
  { key: "ctl", label: "Fitness (CTL)", color: "var(--color-electric)" },
  { key: "atl", label: "Fadiga (ATL)", color: "var(--color-orange)" },
  { key: "tsb", label: "Forma (TSB)", color: "var(--color-turq)" },
] as const;

export default function AthleteEvolucaoPage() {
  const { checked } = useRequireRole("ATHLETE");
  const [days, setDays] = useState<number>(84);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!checked) return;
    let active = true;
    setLoading(true);
    setError(null);
    apiFetch<{ metrics: Metrics }>(`/api/athlete/metrics?days=${days}`)
      .then((r) => active && setMetrics(r.metrics))
      .catch((err) => active && setError(err instanceof ApiClientError ? err.message : "Erro inesperado."))
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [checked, days]);

  return (
    <main className={uiClasses.page}>
      <div className="mx-auto flex max-w-xl flex-col gap-6">
        <header className="flex flex-col gap-0.5">
          <span className={uiClasses.eyebrow}>Sua evolução</span>
          <h1 className={uiClasses.heading}>Curva de forma (PMC)</h1>
        </header>

        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Intervalo do gráfico">
          {RANGES.map((r) => (
            <button
              key={r.days}
              type="button"
              onClick={() => setDays(r.days)}
              aria-pressed={days === r.days}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                days === r.days
                  ? "border-line-strong bg-surface text-ink"
                  : "border-line bg-petrol/70 text-muted hover:border-line-strong"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>

        {error && <p className={uiClasses.error}>{error}</p>}

        {loading ? (
          <p className="text-muted">Carregando...</p>
        ) : !metrics || metrics.dataDays < 2 ? (
          <EmptyState
            title="Ainda não há dados suficientes"
            description="Registre o feedback (sRPE) de alguns treinos para ver sua curva de fitness, fadiga e forma."
            icon={<TrendingUpIcon width={28} height={28} />}
          />
        ) : (
          <PmcContent metrics={metrics} />
        )}
      </div>
    </main>
  );
}

function PmcContent({ metrics }: { metrics: Metrics }) {
  const [hover, setHover] = useState<number | null>(null);
  const geom = useMemo(() => buildPmcChart(metrics.points), [metrics.points]);
  const trend = useMemo(() => pmcTrend(metrics.points), [metrics.points]);
  const cur = metrics.current;

  if (!geom || !cur) {
    return (
      <EmptyState
        title="Ainda não há dados suficientes"
        description="Registre o feedback (sRPE) de alguns treinos para ver sua curva."
        icon={<TrendingUpIcon width={28} height={28} />}
      />
    );
  }

  const summary = pmcSummaryText(trend, cur.tsb);
  const hovered = hover != null ? metrics.points[hover] : null;

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    if (!geom) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * geom.width;
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < geom.xAt.length; i++) {
      const d = Math.abs(geom.xAt[i]! - px);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    setHover(best);
  }

  return (
    <>
      <section className="grid grid-cols-3 gap-2">
        <Tile label="Fitness (CTL)" value={cur.ctl} color="var(--color-electric)" />
        <Tile label="Fadiga (ATL)" value={cur.atl} color="var(--color-orange)" />
        <Tile label="Forma (TSB)" value={cur.tsb} color="var(--color-turq)" />
      </section>

      {trend && (
        <p className="text-sm text-muted">
          Tendência 7 dias:{" "}
          <span className="font-medium text-ink">
            {trend.direction === "subindo" ? "↑ subindo" : trend.direction === "descendo" ? "↓ recuando" : "→ estável"}
          </span>{" "}
          ({trend.deltaCtl >= 0 ? "+" : ""}
          {trend.deltaCtl} CTL)
        </p>
      )}

      <p className="rounded-xl border border-line bg-petrol/70 p-3 text-sm text-muted">{summary}</p>

      <figure className="flex flex-col gap-2">
        <svg
          viewBox={`0 0 ${geom.width} ${geom.height}`}
          className="w-full touch-none"
          style={{ height: "auto" }}
          role="img"
          aria-label={`Gráfico PMC. Fitness ${cur.ctl}, fadiga ${cur.atl}, forma ${cur.tsb}. ${summary}`}
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
        >
          {geom.yTicks.map((t) => (
            <g key={t.value}>
              <line
                x1={geom.plot.x}
                x2={geom.plot.x + geom.plot.w}
                y1={t.y}
                y2={t.y}
                stroke="var(--color-line)"
                strokeWidth={0.5}
              />
              <text x={geom.plot.x - 4} y={t.y + 3} textAnchor="end" fontSize={9} fill="var(--color-faint)">
                {t.value}
              </text>
            </g>
          ))}
          {geom.zeroY != null && (
            <line
              x1={geom.plot.x}
              x2={geom.plot.x + geom.plot.w}
              y1={geom.zeroY}
              y2={geom.zeroY}
              stroke="var(--color-line-strong)"
              strokeWidth={0.75}
              strokeDasharray="3 3"
            />
          )}

          {geom.loadBars.map((b, i) => (
            <rect key={i} x={b.x} y={b.y} width={b.w} height={b.h} fill="var(--color-line-strong)" opacity={0.35} />
          ))}

          {SERIES.map((s) => (
            <path key={s.key} d={geom.paths[s.key]} fill="none" stroke={s.color} strokeWidth={1.6} />
          ))}

          {geom.xTicks.map((t, i) => (
            <text key={i} x={t.x} y={geom.height - 6} textAnchor="middle" fontSize={9} fill="var(--color-faint)">
              {t.label}
            </text>
          ))}

          {hover != null && (
            <>
              <line
                x1={geom.xAt[hover]}
                x2={geom.xAt[hover]}
                y1={geom.plot.y}
                y2={geom.plot.y + geom.plot.h}
                stroke="var(--color-line-strong)"
                strokeWidth={0.75}
              />
              {SERIES.map((s) => (
                <circle
                  key={s.key}
                  cx={geom.xAt[hover]}
                  cy={yForValue(geom, metrics.points, s.key, hover)}
                  r={2.5}
                  fill={s.color}
                />
              ))}
            </>
          )}
        </svg>

        <figcaption className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted">
          {SERIES.map((s) => (
            <span key={s.key} className="inline-flex items-center gap-1.5">
              <span className="inline-block h-2 w-3 rounded-sm" style={{ background: s.color }} />
              {s.label}
            </span>
          ))}
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-sm bg-line-strong opacity-60" />
            Carga diária
          </span>
        </figcaption>

        {hovered && (
          <div className="rounded-lg border border-line bg-surface p-2 text-xs text-ink" aria-live="polite">
            <span className="font-medium">
              {new Date(`${hovered.date}T00:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
            </span>
            {" · "}CTL {hovered.ctl} · ATL {hovered.atl} · TSB {hovered.tsb} · carga {hovered.load}
          </div>
        )}
      </figure>

      <p className="text-[11px] text-faint">
        {metrics.dataDays} de {metrics.windowDays} dias com carga registrada. Dias sem treino contam como carga zero — nada é preenchido artificialmente.
      </p>
    </>
  );
}

// y do valor de uma série num índice, na mesma escala LINEAR interna do
// buildPmcChart — recuperada exatamente por dois ticks conhecidos (escala é
// linear, então interpolar entre o primeiro e o último tick é exato).
function yForValue(
  geom: NonNullable<ReturnType<typeof buildPmcChart>>,
  points: ChartPoint[],
  key: "ctl" | "atl" | "tsb",
  i: number,
): number {
  const a = geom.yTicks[0]!;
  const b = geom.yTicks[geom.yTicks.length - 1]!;
  const v = points[i]![key];
  if (a.value === b.value) return a.y;
  return a.y + ((v - a.value) / (b.value - a.value)) * (b.y - a.y);
}

function Tile({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-xl border border-line bg-petrol/70 p-3 text-center">
      <p className="tabular text-2xl font-semibold" style={{ color }}>
        {value}
      </p>
      <p className="mt-1 text-[11px] text-muted">{label}</p>
    </div>
  );
}
