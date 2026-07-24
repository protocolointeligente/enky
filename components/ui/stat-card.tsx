import type { ReactNode } from "react";
import Link from "next/link";

interface StatCardProps {
  label: string;
  value: number | string;
  icon?: ReactNode;
  href?: string;
  tone?: "default" | "orange" | "electric" | "turq" | "danger" | "warning";
  hint?: string;
  /** Trend: positive number → turq up, negative → danger down, undefined → hidden */
  trend?: number;
  /** Short description of what the trend compares against (e.g. "vs semana anterior") */
  trendLabel?: string;
  /** Sub-value shown below main value in muted text */
  subValue?: string;
}

const TONE_ICON: Record<NonNullable<StatCardProps["tone"]>, string> = {
  default: "text-muted",
  orange:  "text-orange-hi",
  electric:"text-electric-hi",
  turq:    "text-turq",
  danger:  "text-danger",
  warning: "text-warning",
};

const TONE_BORDER: Record<NonNullable<StatCardProps["tone"]>, string> = {
  default: "border-l-line",
  orange:  "border-l-orange/70",
  electric:"border-l-electric/70",
  turq:    "border-l-turq/70",
  danger:  "border-l-danger/70",
  warning: "border-l-warning/70",
};

function TrendBadge({ value, label }: { value: number; label?: string }) {
  const isUp = value > 0;
  const isDown = value < 0;
  const cls = isUp ? "trend-up" : isDown ? "trend-down" : "trend-neutral";
  const arrow = isUp ? "↑" : isDown ? "↓" : "→";
  return (
    <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular ${cls}`}>
      <span aria-hidden="true">{arrow}</span>
      {Math.abs(value)}%
      {label && <span className="ml-0.5 font-normal opacity-70">{label}</span>}
    </span>
  );
}

// Premium KPI card — valor dominante, borda lateral semântica, microtrend.
// Números usam tabular-nums para alinhamento perfeito em grids.
export function StatCard({
  label,
  value,
  icon,
  href,
  tone = "default",
  hint,
  trend,
  trendLabel,
  subValue,
}: StatCardProps) {
  const body = (
    <>
      {/* Cabeçalho: label + ícone */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-faint">{label}</span>
        {icon && (
          <span className={`shrink-0 opacity-80 ${TONE_ICON[tone]}`}>{icon}</span>
        )}
      </div>

      {/* Valor principal */}
      <div className="flex items-end gap-2">
        <span className="tabular font-display text-[2rem] font-bold leading-none text-ink">{value}</span>
        {subValue && (
          <span className="mb-0.5 text-sm font-medium text-muted">{subValue}</span>
        )}
      </div>

      {/* Trend + hint */}
      <div className="flex items-center gap-2 min-h-[18px]">
        {trend !== undefined && (
          <TrendBadge value={trend} label={trendLabel} />
        )}
        {hint && !trend && (
          <span className="text-xs text-muted">{hint}</span>
        )}
      </div>
    </>
  );

  const baseClass = `flex flex-col gap-2 rounded-2xl border border-line border-l-4 ${TONE_BORDER[tone]} bg-kpi-bg p-4 transition-colors`;

  if (href) {
    return (
      <Link href={href} className={`${baseClass} hover:border-line-strong hover:bg-surface`}>
        {body}
      </Link>
    );
  }
  return <div className={baseClass}>{body}</div>;
}
