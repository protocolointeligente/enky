import { statusBadgeClass, uiClasses } from "@/app/_lib/ui";
import { statusLabel } from "@/app/_lib/labels";

// Status pill: renders the humanized PT label with the brand-coded color.
// Never renders the raw enum.
export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`${uiClasses.badge} ${statusBadgeClass[status] ?? "bg-surface text-muted"}`}>
      {statusLabel(status)}
    </span>
  );
}
