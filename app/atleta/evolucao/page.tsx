"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch, ApiClientError } from "@/app/_lib/api-client";
import { modalityLabel } from "@/app/_lib/labels";
import { modalityMeta } from "@/app/_lib/modality";
import { uiClasses } from "@/app/_lib/ui";
import { useRequireRole } from "@/app/_lib/use-session";
import type { HomeWorkout } from "@/modules/athletes/get-athlete-home";
import { StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ChevronRightIcon, TrendingUpIcon } from "@/components/ui/icons";

interface HomeData {
  recentCompleted: HomeWorkout[];
  summary: { completed7d: number; scheduled7d: number; adherence7d: number | null; streak: number };
}

// Evolução do atleta (§26, versão mínima): reaproveita o agregado da home — sem
// endpoint novo. Sem histórico suficiente, orienta em vez de mostrar gráfico vazio.
export default function AthleteEvolucaoPage() {
  const { checked } = useRequireRole("ATHLETE");
  const [home, setHome] = useState<HomeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!checked) return;
    apiFetch<{ home: HomeData }>("/api/athlete/home")
      .then((result) => setHome(result.home))
      .catch((err) => setError(err instanceof ApiClientError ? err.message : "Erro inesperado."))
      .finally(() => setLoading(false));
  }, [checked]);

  if (!checked || loading) {
    return (
      <main className={uiClasses.page}>
        <p className="text-muted">Carregando...</p>
      </main>
    );
  }

  const hasHistory =
    home != null &&
    (home.recentCompleted.length > 0 || home.summary.scheduled7d > 0 || home.summary.completed7d > 0);

  return (
    <main className={uiClasses.page}>
      <div className="mx-auto flex max-w-xl flex-col gap-6">
        <header className="flex flex-col gap-0.5">
          <span className={uiClasses.eyebrow}>Sua evolução</span>
          <h1 className={uiClasses.heading}>Como você vem treinando</h1>
        </header>

        {error && <p className={uiClasses.error}>{error}</p>}

        {!hasHistory ? (
          <EmptyState
            title="Ainda não há histórico suficiente"
            description="Conclua alguns treinos para começar a acompanhar sua evolução."
            icon={<TrendingUpIcon width={28} height={28} />}
          />
        ) : (
          home && (
            <>
              <section className="grid grid-cols-3 gap-2">
                <Tile
                  label="Aderência 7d"
                  value={home.summary.adherence7d != null ? `${home.summary.adherence7d}%` : "—"}
                />
                <Tile label="Concluídos 7d" value={String(home.summary.completed7d)} />
                <Tile label="Sequência" value={String(home.summary.streak)} />
              </section>

              {home.recentCompleted.length > 0 && (
                <section className="flex flex-col gap-2">
                  <h2 className={uiClasses.subheading}>Treinos recentes</h2>
                  {home.recentCompleted.map((w) => (
                    <CompletedRow key={w.id} workout={w} />
                  ))}
                </section>
              )}

              <Link
                href="/atleta/relatorios"
                className="flex items-center justify-between rounded-xl border border-line bg-petrol/70 p-4 transition-colors hover:border-line-strong"
              >
                <div className="min-w-0">
                  <p className="font-medium text-ink">Relatórios do treinador</p>
                  <p className="truncate text-xs text-muted">Resumos e análises compartilhados com você</p>
                </div>
                <ChevronRightIcon className="shrink-0 text-faint" />
              </Link>
            </>
          )
        )}
      </div>
    </main>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-petrol/70 p-4 text-center">
      <p className="tabular text-2xl font-semibold text-ink">{value}</p>
      <p className="mt-1 text-[11px] text-muted">{label}</p>
    </div>
  );
}

function CompletedRow({ workout }: { workout: HomeWorkout }) {
  const meta = modalityMeta(workout.modality);
  const date = new Date(`${workout.plannedDate}T00:00:00`).toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
  return (
    <Link
      href={`/atleta/treinos/${workout.id}`}
      className="flex items-center gap-3 rounded-xl border border-line bg-petrol/70 p-3 transition-colors hover:border-line-strong"
      style={{ borderLeft: `3px solid ${meta.accent}` }}
    >
      <span className="shrink-0" style={{ color: meta.accent }}>
        {meta.icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-ink">{workout.title}</p>
        <p className="truncate text-xs capitalize text-muted">
          {date} · {modalityLabel(workout.modality)}
        </p>
      </div>
      <StatusBadge status={workout.status} />
    </Link>
  );
}
