"use client";

import { uiClasses } from "@/app/_lib/ui";
import { SearchIcon } from "@/components/ui/icons";

// Peças repetidas pelos painéis do /admin. Não é uma design system nova — é o
// mesmo vocabulário de app/_lib/ui.ts, agrupado para as tabelas do admin.

export const adminTable = {
  wrap: "overflow-x-auto",
  table: "w-full text-left text-sm",
  headRow: "border-b border-line text-xs uppercase tracking-wider text-faint",
  th: "px-5 py-3 font-semibold",
  body: "divide-y divide-line",
  td: "px-5 py-3 text-muted",
  tdStrong: "px-5 py-3 text-ink",
} as const;

// Estado binário reversível (ativo/bloqueado, ativa/suspensa). Verde = opera
// normalmente; vermelho = cortado pelo admin. Nunca cinza: um estado desses
// nunca é "neutro", alguém decidiu.
export function StateBadge({
  active,
  activeLabel,
  inactiveLabel,
}: {
  active: boolean;
  activeLabel: string;
  inactiveLabel: string;
}) {
  return (
    <span
      className={`${uiClasses.badge} ${
        active ? "bg-turq/15 text-turq" : "bg-danger/15 text-danger"
      }`}
    >
      {active ? activeLabel : inactiveLabel}
    </span>
  );
}

export function SearchField({
  value,
  onChange,
  placeholder,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label: string;
}) {
  return (
    <div className="relative sm:w-72">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint">
        <SearchIcon />
      </span>
      <input
        type="search"
        className={`${uiClasses.input} pl-9`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
      />
    </div>
  );
}

export function PanelState({ loading, error, empty }: { loading: boolean; error: string | null; empty: boolean }) {
  if (loading) return <p className="p-5 text-sm text-muted">Carregando...</p>;
  if (error) return <p className="p-5 text-sm text-danger">{error}</p>;
  if (empty) return <p className="p-5 text-sm text-muted">Nenhum resultado.</p>;
  return null;
}

export function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}
