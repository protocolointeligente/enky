"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ApiClientError, apiFetch } from "@/app/_lib/api-client";
import { uiClasses } from "@/app/_lib/ui";
import { useRequireRole } from "@/app/_lib/use-session";
import { ErrorNotice } from "@/components/ui/error-notice";

// Busca global (Etapa 4 §24). Termo → resultados comerciais agrupados, cada um
// linkando para sua área. Debounce; escopo por tenant no servidor.

interface Named {
  id: string;
  name: string;
  status?: string;
  email?: string | null;
}
interface Trainer {
  userId: string;
  name: string;
  email: string;
  role: string;
}
interface Results {
  leads: Named[];
  clients: Named[];
  groups: Named[];
  trainers: Trainer[];
}

const EMPTY: Results = { leads: [], clients: [], groups: [], trainers: [] };

export default function SearchPage() {
  const { checked } = useRequireRole("TRAINER");
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Results>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    if (!checked) return;
    if (q.trim().length < 2) {
      setResults(EMPTY);
      return;
    }
    setLoading(true);
    const t = setTimeout(() => {
      apiFetch<Results>(`/api/trainer/search?q=${encodeURIComponent(q.trim())}`)
        .then(setResults)
        .catch((e: ApiClientError) => setError(e))
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(t);
  }, [checked, q]);

  if (!checked) return null;

  const total = results.leads.length + results.clients.length + results.groups.length + results.trainers.length;

  return (
    <main className={uiClasses.page}>
      <div className={uiClasses.container}>
        <header className="flex flex-col gap-1">
          <p className={uiClasses.eyebrow}>Gestão · Busca</p>
          <h1 className={uiClasses.heading}>Busca global</h1>
        </header>

        <input
          className={uiClasses.input}
          placeholder="Buscar cliente, lead, grupo, treinador…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoFocus
        />

        <ErrorNotice error={error} />
        {q.trim().length < 2 ? (
          <p className={uiClasses.hint}>Digite ao menos 2 caracteres.</p>
        ) : loading ? (
          <p className={uiClasses.hint}>Buscando…</p>
        ) : total === 0 ? (
          <p className={uiClasses.hint}>Nada encontrado.</p>
        ) : (
          <div className="flex flex-col gap-4">
            <ResultGroup title="Clientes" href="/treinador/gestao/clientes" items={results.clients.map((c) => ({ key: c.id, label: c.name, sub: c.email ?? undefined }))} />
            <ResultGroup title="Leads" href="/treinador/gestao/leads" items={results.leads.map((l) => ({ key: l.id, label: l.name, sub: l.email ?? undefined }))} />
            <ResultGroup title="Grupos" href="/treinador/gestao/grupos" items={results.groups.map((g) => ({ key: g.id, label: g.name }))} />
            <ResultGroup title="Treinadores" href="/treinador/gestao/treinadores" items={results.trainers.map((t) => ({ key: t.userId, label: t.name, sub: t.email }))} />
          </div>
        )}
      </div>
    </main>
  );
}

function ResultGroup({
  title,
  href,
  items,
}: {
  title: string;
  href: string;
  items: { key: string; label: string; sub?: string }[];
}) {
  if (items.length === 0) return null;
  return (
    <section className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className={uiClasses.eyebrow}>{title}</span>
        <Link href={href} className={uiClasses.link}>
          Abrir área →
        </Link>
      </div>
      <ul className={`${uiClasses.panel} divide-y divide-line/50`}>
        {items.map((i) => (
          <li key={i.key} className="px-4 py-2">
            <span className="text-ink">{i.label}</span>
            {i.sub ? <span className="block text-xs text-faint">{i.sub}</span> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
