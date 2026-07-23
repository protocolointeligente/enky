import { statusBadgeClass, uiClasses } from "@/app/_lib/ui";
import { statusLabel } from "@/app/_lib/labels";

// Status pill: renders the humanized PT label with the brand-coded color.
// Never renders the raw enum. Rounded-full, semibold, compact padding.
export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`${uiClasses.badge} ${statusBadgeClass[status] ?? "bg-surface text-muted"}`}>
      {statusLabel(status)}
    </span>
  );
}

// Readiness semaphore badge — dot pulsante + % + label textual.
// ready: turq · warning: laranja/warning · risk: danger
type ReadinessTone = "ready" | "warning" | "risk" | "unknown";

const READINESS_CLASS: Record<ReadinessTone, string> = {
  ready:   "readiness-ready",
  warning: "readiness-warning",
  risk:    "readiness-risk",
  unknown: "bg-surface text-muted",
};

const READINESS_DOT: Record<ReadinessTone, string> = {
  ready:   "bg-turq",
  warning: "bg-warning",
  risk:    "bg-danger",
  unknown: "bg-muted",
};

const READINESS_LABEL: Record<ReadinessTone, string> = {
  ready:   "Pronto",
  warning: "Atenção",
  risk:    "Risco",
  unknown: "—",
};

export function readinessTone(score: number | null | undefined): ReadinessTone {
  if (score == null) return "unknown";
  if (score >= 70) return "ready";
  if (score >= 45) return "warning";
  return "risk";
}

export function ReadinessBadge({
  score,
  showScore = true,
}: {
  score: number | null | undefined;
  showScore?: boolean;
}) {
  const tone = readinessTone(score);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${READINESS_CLASS[tone]}`}
    >
      <span
        className={`h-1.5 w-1.5 shrink-0 rounded-full dot-pulse ${READINESS_DOT[tone]}`}
        aria-hidden="true"
      />
      {showScore && score != null ? `${score}%` : READINESS_LABEL[tone]}
    </span>
  );
}
