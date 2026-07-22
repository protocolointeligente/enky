"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ApiClientError, apiFetch } from "@/app/_lib/api-client";
import { uiClasses } from "@/app/_lib/ui";
import { useRequireRole } from "@/app/_lib/use-session";
import { productTypeLabel } from "@/modules/marketplace-catalog/labels";
import type { LibraryItem } from "@/modules/marketplace-orders/library";

// Comprador = User de qualquer papel; a biblioteca é de todos.
const ALL_ROLES = ["SUPERADMIN", "ADMIN", "TRAINER", "ATHLETE"] as const;

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Liberado",
  PENDING: "Aguardando",
};

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
      <main className="mx-auto max-w-3xl px-5 py-14 sm:px-6">
        <p className="text-muted">Carregando...</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 px-5 py-14 sm:px-6">
      <header className="flex flex-col gap-2">
        <span className={uiClasses.eyebrow}>Marketplace</span>
        <h1 className="font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
          Minha biblioteca
        </h1>
      </header>

      {error && <p className={uiClasses.error}>{error}</p>}

      {items && items.length === 0 && (
        <div className="flex flex-col items-start gap-3">
          <p className="text-muted">Você ainda não comprou nada.</p>
          <Link href="/marketplace" className={uiClasses.link}>
            Explorar o marketplace →
          </Link>
        </div>
      )}

      {items && items.length > 0 && (
        <ul className="flex flex-col gap-3">
          {items.map((item) => (
            <li
              key={item.entitlementId}
              className="flex items-center justify-between gap-4 rounded-xl border border-line bg-petrol/60 p-4"
            >
              <div className="flex min-w-0 flex-col gap-1">
                <span className="text-xs uppercase tracking-wide text-faint">
                  {productTypeLabel[item.entitlementType]}
                </span>
                {item.productSlug ? (
                  <Link href={`/marketplace/produtos/${item.productSlug}`} className="font-medium text-ink hover:underline">
                    {item.title}
                  </Link>
                ) : (
                  <span className="font-medium text-ink">{item.title}</span>
                )}
              </div>
              <span className="shrink-0 rounded-full bg-black/20 px-3 py-1 text-xs font-medium text-muted">
                {STATUS_LABEL[item.status] ?? item.status}
              </span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
