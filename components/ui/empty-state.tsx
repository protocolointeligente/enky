import type { ReactNode } from "react";
import Link from "next/link";
import { uiClasses } from "@/app/_lib/ui";

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: { label: string; href: string } | { label: string; onClick: () => void };
}

// Empty states orient the next action instead of just saying "nothing here".
export function EmptyState({ title, description, icon, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-line bg-petrol/40 px-6 py-10 text-center">
      {icon && <span className="text-faint">{icon}</span>}
      <div className="flex flex-col gap-1">
        <p className="font-display text-base font-semibold text-ink">{title}</p>
        {description && <p className="text-sm text-muted">{description}</p>}
      </div>
      {action &&
        ("href" in action ? (
          <Link href={action.href} className={uiClasses.button}>
            {action.label}
          </Link>
        ) : (
          <button type="button" onClick={action.onClick} className={uiClasses.button}>
            {action.label}
          </button>
        ))}
    </div>
  );
}
