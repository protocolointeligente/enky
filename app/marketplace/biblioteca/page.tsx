"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ApiClientError, apiFetch } from "@/app/_lib/api-client";
import { uiClasses } from "@/app/_lib/ui";
import { useRequireRole } from "@/app/_lib/use-session";
import { productTypeLabel } from "@/modules/marketplace-catalog/labels";
import type { LibraryItem } from "@/modules/marketplace-orders/library";

// Comprador = User de qualquer papel; a biblioteca é para todos.
const ALL_ROLES = ["SUPERADMIN", "ADMIN", "TRAINER", "ATHLETE"] as const;

const TYPE_ICON: Record<string, string> = {
  TRAINING_PLAN:          "🏃",
  COACHING_SERVICE:       "🧠",
  ASSESSMENT_SERVICE:     "📊",
  PERIODIZATION_TEMPLATE: "📅",
  WORKOUT_TEMPLATE_PACK:  "💪",
  EXERCISE_LIBRARY_PACK:  "🗂️",
  EDUCATIONAL_CONTENT:    "📚",
  CONSULTATION:           "🎯",
  EVENT_PROGRAM:          "🏆",
};

function StatusBadge({ status }: { status: string }) {
  if (status === "ACTIVE") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-turq-lo px-2.5 py-0.5 text-xs font-semibold text-turq">
        <span className="h-1.5 w-1.5 rounded-full bg-turq dot-pulse" aria-hidden="true" />
        Liberado
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-warning-lo px-2.5 py-0.5 text-xs font-semibold text-warning">
      <span className="h-1.5 w-1.5 rounded-full bg-warning dot-pulse" aria-hidden="true" />
      Aguardando
    </span>
  );
}

export default function LibraryPage() {
  const { checked } = useRequireRole(ALL_ROLES);
  const [items, setItems] = useState<LibraryItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!checked) return;
    apiFetch<{ items: LibraryItem[] }>("/api/marketplace/library")
      .then((r) => setItems(r.items))
      .catch((e) => setError(e instanceof ApiClientError ? e.message : "Erro ao carregar."));
  }, [checked]);

  if (!checked || (items === null && !error)) {
    return (
      <main className="min-h-screen bg-deep px-5 py-14 sm:px-6">
        <div className="mx-auto flex max-w-3xl flex-col gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-2xl bg-surface" />
          ))}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-deep px-5 py-14 text-ink sm:px-6">
      <div className="mx-auto flex max-w-3xl flex-col gap-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-1">
            <span className={uiClasses.eyebrow}>Marketplace</span>
            <h1 className="font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
              Minha biblioteca
            </h1>
            {items && items.length > 0 && (
              <p className="text-sm text-muted">
                {items.length} item{items.length !== 1 ? "ns" : ""} adquirido{items.length !== 1 ? "s" : ""}
              </p>
            )}
          </div>
          <Link href="/marketplace" className={uiClasses.buttonSecondary + " text-sm shrink-0"}>
            Explorar marketplace
          </Link>
        </header>

        {error && <p className={uiClasses.error}>{error}</p>}

        {items && items.length === 0 && (
          <div className="flex flex-col items-center gap-5 rounded-2xl border border-dashed border-line py-20 text-center">
            <span className="text-5xl" aria-hidden="true">📚</span>
            <div className="flex flex-col gap-1">
              <p className="font-semibold text-ink">Sua biblioteca está vazia</p>
              <p className="text-sm text-muted">Compre um produto no marketplace e ele aparecerá aqui.</p>
            </div>
            <Link href="/marketplace" className={uiClasses.button}>
              Explorar produtos →
            </Link>
          </div>
        )}

        {items && items.length > 0 && (
          <ul className="flex flex-col gap-3">
            {items.map((item) => (
              <li
                key={item.entitlementId}
                className="flex items-center gap-4 rounded-2xl border border-line bg-petrol p-5 transition-colors hover:border-line-strong"
              >
                {/* Ícone do tipo */}
                <span
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-surface text-2xl"
                  aria-hidden="true"
                >
                  {TYPE_ICON[item.entitlementType] ?? "📦"}
                </span>

                {/* Info */}
                <div className="min-w-0 flex-1 flex flex-col gap-0.5">
                  <span className={uiClasses.eyebrow}>
                    {productTypeLabel[item.entitlementType as keyof typeof productTypeLabel] ?? item.entitlementType}
                  </span>
                  {item.productSlug ? (
                    <Link
                      href={`/marketplace/produtos/${item.productSlug}`}
                      className="truncate font-semibold text-ink hover:text-electric-hi transition-colors"
                    >
                      {item.title}
                    </Link>
                  ) : (
                    <span className="truncate font-semibold text-ink">{item.title}</span>
                  )}
                </div>

                {/* Status */}
                <StatusBadge status={item.status} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
