"use client";
/* eslint-disable @next/next/no-img-element -- capas vêm de blogs externos variados */

import { useEffect, useMemo, useState } from "react";
import { apiFetch, ApiClientError } from "@/app/_lib/api-client";
import { modalityMeta, MODALITY_ORDER } from "@/app/_lib/modality";
import { useRequireRole } from "@/app/_lib/use-session";
import { uiClasses } from "@/app/_lib/ui";

interface FeedItem {
  title: string;
  link: string;
  date: string | null;
  excerpt: string;
  image: string | null;
  modality?: string;
  source?: string;
}

function fmtDate(raw: string | null): string | null {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime())
    ? null
    : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

export default function TrainerNewsPage() {
  const { checked } = useRequireRole("TRAINER");
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("");

  useEffect(() => {
    if (!checked) return;
    apiFetch<{ items: FeedItem[] }>("/api/novidades")
      .then((r) => setItems(r.items))
      .catch((err) => setError(err instanceof ApiClientError ? err.message : "Erro inesperado."))
      .finally(() => setLoading(false));
  }, [checked]);

  // Modalidades presentes, na ordem canônica, para as abas de filtro.
  const modalities = useMemo(() => {
    const present = new Set(items.map((i) => i.modality).filter(Boolean) as string[]);
    return MODALITY_ORDER.filter((m) => present.has(m));
  }, [items]);

  const visible = filter ? items.filter((i) => i.modality === filter) : items;

  if (!checked || loading) {
    return (
      <main className={uiClasses.page}>
        <p className="text-muted">Carregando...</p>
      </main>
    );
  }

  return (
    <main className={uiClasses.page}>
      <div className={uiClasses.wide}>
        <div className="flex flex-col gap-1">
          <span className={uiClasses.eyebrow}>Área do cliente</span>
          <h1 className={uiClasses.heading}>Novidades</h1>
          <p className={uiClasses.hint}>
            Conteúdo dos melhores blogs de cada modalidade, reunido para você acompanhar.
          </p>
        </div>

        {error && <p className={uiClasses.error}>{error}</p>}

        {modalities.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <FilterChip active={filter === ""} onClick={() => setFilter("")} label="Todas" />
            {modalities.map((m) => (
              <FilterChip
                key={m}
                active={filter === m}
                onClick={() => setFilter(m)}
                label={modalityMeta(m).label}
                accent={modalityMeta(m).accent}
              />
            ))}
          </div>
        )}

        {visible.length === 0 ? (
          <div className={`${uiClasses.card} text-sm text-muted`}>
            Nenhuma novidade no momento. Volte em breve.
          </div>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((item) => {
              const date = fmtDate(item.date);
              const meta = item.modality ? modalityMeta(item.modality) : null;
              return (
                <li key={item.link}>
                  <a
                    href={item.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-full flex-col overflow-hidden rounded-xl border border-line bg-petrol/60 transition-colors hover:border-line-strong hover:bg-petrol"
                  >
                    {item.image ? (
                      <img
                        src={item.image}
                        alt=""
                        className="h-40 w-full bg-surface object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div
                        className="h-40 w-full"
                        style={{
                          background: meta
                            ? `linear-gradient(135deg, ${meta.accent}33, ${meta.accent}0a)`
                            : "var(--color-surface)",
                        }}
                      />
                    )}
                    <div className="flex flex-1 flex-col gap-2 p-4">
                      <div className="flex items-center gap-2 text-xs text-faint">
                        {meta && (
                          <span className={`${uiClasses.badge} ${meta.chip}`}>{meta.label}</span>
                        )}
                        {date && <span>{date}</span>}
                      </div>
                      <h2 className="font-display font-semibold leading-snug text-ink">
                        {item.title}
                      </h2>
                      {item.excerpt && (
                        <p className="line-clamp-3 text-sm text-muted">{item.excerpt}</p>
                      )}
                      <span className="mt-auto pt-1 text-sm font-medium text-electric-hi">
                        {item.source ? `Ler no ${item.source} →` : "Ler mais →"}
                      </span>
                    </div>
                  </a>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}

function FilterChip({
  active,
  onClick,
  label,
  accent,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  accent?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
        active
          ? "border-line-strong bg-surface text-ink"
          : "border-line text-muted hover:bg-surface/60 hover:text-ink"
      }`}
    >
      {accent && (
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: accent }} />
      )}
      {label}
    </button>
  );
}
