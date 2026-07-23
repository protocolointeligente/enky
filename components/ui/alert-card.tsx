import Link from "next/link";

// ── AlertCard ──────────────────────────────────────────────────────────────
// Card de alerta contextual da ENKY Intelligence. Exibe um sinal capturado
// sobre um atleta com nível de risco e CTA para ação.
//
// severity: "high" → borda vermelha, "mid" → borda laranja/warning, "low" → neutro

export type AlertSeverity = "high" | "mid" | "low";

interface AlertCardProps {
  athleteName: string;
  /** Tipo do alerta: "ACWR alto", "Treino perdido", "Dor", "Fadiga elevada" etc. */
  alertType: string;
  /** Dado de sinal capturado: "ACWR 1.62", "3 dias sem treino" etc. */
  signal?: string;
  severity?: AlertSeverity;
  href?: string;
  /** Label do CTA (padrão: "Ver atleta") */
  ctaLabel?: string;
}

const SEVERITY_WRAPPER: Record<AlertSeverity, string> = {
  high: "border border-danger/30 bg-danger-lo",
  mid:  "border border-warning/30 bg-warning-lo",
  low:  "border border-line bg-surface",
};

const SEVERITY_DOT: Record<AlertSeverity, string> = {
  high: "bg-danger",
  mid:  "bg-warning",
  low:  "bg-muted",
};

const SEVERITY_LABEL: Record<AlertSeverity, string> = {
  high: "Risco alto",
  mid:  "Atenção",
  low:  "Info",
};

const SEVERITY_TEXT: Record<AlertSeverity, string> = {
  high: "text-danger",
  mid:  "text-warning",
  low:  "text-muted",
};

export function AlertCard({
  athleteName,
  alertType,
  signal,
  severity = "mid",
  href,
  ctaLabel = "Ver atleta",
}: AlertCardProps) {
  const content = (
    <div className={`flex items-center gap-3 rounded-2xl p-4 transition-colors ${SEVERITY_WRAPPER[severity]} ${href ? "hover:opacity-90 cursor-pointer" : ""}`}>
      {/* Dot de severidade */}
      <span
        className={`mt-0.5 h-2 w-2 shrink-0 rounded-full dot-pulse ${SEVERITY_DOT[severity]}`}
        aria-label={SEVERITY_LABEL[severity]}
      />

      {/* Avatar de inicial */}
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-petrol border border-line text-xs font-bold text-muted uppercase select-none">
        {athleteName.slice(0, 2)}
      </span>

      {/* Conteúdo */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-ink">{athleteName}</p>
        <p className={`truncate text-xs font-medium ${SEVERITY_TEXT[severity]}`}>{alertType}</p>
        {signal && (
          <p className="truncate text-[11px] text-faint mt-0.5">{signal}</p>
        )}
      </div>

      {/* CTA */}
      {href && (
        <span className="shrink-0 rounded-lg border border-line bg-petrol px-2.5 py-1 text-xs font-medium text-muted transition-colors hover:border-line-strong hover:text-ink">
          {ctaLabel}
        </span>
      )}
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }
  return content;
}
