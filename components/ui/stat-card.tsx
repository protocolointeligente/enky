import type { ReactNode } from "react";
import Link from "next/link";

interface StatCardProps {
  label: string;
  value: number | string;
  icon?: ReactNode;
  href?: string;
  tone?: "default" | "orange" | "electric" | "turq";
  hint?: string;
}

const TONE_ICON: Record<NonNullable<StatCardProps["tone"]>, string> = {
  default: "text-muted",
  orange: "text-orange-hi",
  electric: "text-electric-hi",
  turq: "text-turq",
};

// Compact operational indicator. Optional href turns the whole card into a
// link with hover feedback. Numbers use tabular figures so they align.
export function StatCard({ label, value, icon, href, tone = "default", hint }: StatCardProps) {
  const body = (
    <>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-faint">{label}</span>
        {icon && <span className={TONE_ICON[tone]}>{icon}</span>}
      </div>
      <span className="tabular font-display text-3xl font-bold text-ink">{value}</span>
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </>
  );

  const className =
    "flex flex-col gap-2 rounded-xl border border-line bg-petrol/70 p-4 transition-colors";

  if (href) {
    return (
      <Link href={href} className={`${className} hover:border-line-strong hover:bg-surface`}>
        {body}
      </Link>
    );
  }
  return <div className={className}>{body}</div>;
}
