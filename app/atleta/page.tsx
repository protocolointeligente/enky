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
import { AlertIcon, CalendarIcon, ChevronRightIcon, ClockIcon, TrendingUpIcon } from "@/components/ui/icons";

interface HomeData {
  today: HomeWorkout[];
  upcoming: HomeWorkout[];
  recentCompleted: HomeWorkout[];
  pending: { feedbackMissing: HomeWorkout[]; readinessTodayMissing: boolean };
  readiness: {
    checkInDate: string;
    sleepHours: number | null;
    sleepQuality: number | null;
    fatigue: number | null;
    soreness: number | null;
    stress: number | null;
    motivation: number | null;
  } | null;
  summary: { completed7d: number; scheduled7d: number; adherence7d: number | null; streak: number };
}

function timeOf(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export default function AthleteHomePage() {
  const { user, checked } = useRequireRole("ATHLETE");
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

  return (
    <main className={uiClasses.page}>
      <div className="mx-auto flex max-w-xl flex-col gap-6">
        <header className="flex flex-col gap-0.5">
          <span className={uiClasses.eyebrow}>
            {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
          </span>
          <h1 className={uiClasses.heading}>Olá, {user?.name?.split(" ")[0] ?? "atleta"}</h1>
        </header>

        {error && <p className={uiClasses.error}>{error}</p>}

        {home && (
          <>
            {/* Treino de hoje (§8.1) */}
            <section className="flex flex-col gap-2">
              <h2 className={uiClasses.subheading}>Treino de hoje</h2>
              {home.today.length === 0 ? (
                <EmptyState
                  title="Dia de descanso"
                  description="Você não tem treino programado para hoje."
                  icon={<CalendarIcon width={28} height={28} />}
                />
              ) : (
                home.today.map((w) => <TodayCard key={w.id} workout={w} />)
              )}
            </section>

            {/* Estado atual (§8.2) */}
            <ReadinessCard readiness={home.readiness} missing={home.pending.readinessTodayMissing} />

            {/* Precisa de atenção (§8.3) */}
            {home.pending.feedbackMissing.length > 0 && (
              <section className="flex flex-col gap-2">
                <h2 className={uiClasses.subheading}>Precisa de atenção</h2>
                {home.pending.feedbackMissing.map((w) => (
                  <WorkoutRow key={w.id} workout={w} cta="Enviar feedback" />
                ))}
              </section>
            )}

            {/* Próximos treinos (§8.4) */}
            <section className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <h2 className={uiClasses.subheading}>Próximos treinos</h2>
                <Link href="/atleta/calendario" className={uiClasses.link}>
                  Calendário
                </Link>
              </div>
              {home.upcoming.length === 0 ? (
                <p className="text-sm text-muted">Nenhum treino programado.</p>
              ) : (
                home.upcoming.map((w) => <WorkoutRow key={w.id} workout={w} />)
              )}
            </section>

            {/* Evolução resumida (§8.5) */}
            <EvolutionSummary summary={home.summary} />

            {/* Concluídos */}
            {home.recentCompleted.length > 0 && (
              <section className="flex flex-col gap-2">
                <h2 className={uiClasses.subheading}>Concluídos recentemente</h2>
                {home.recentCompleted.map((w) => (
                  <WorkoutRow key={w.id} workout={w} />
                ))}
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}

function TodayCard({ workout }: { workout: HomeWorkout }) {
  const meta = modalityMeta(workout.modality);
  const time = timeOf(workout.plannedStartAt);
  return (
    <Link
      href={`/atleta/treinos/${workout.id}`}
      className="flex flex-col gap-3 rounded-2xl border border-line bg-petrol/70 p-5 transition-colors hover:border-line-strong"
      style={{ borderLeft: `4px solid ${meta.accent}` }}
    >
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm font-medium" style={{ color: meta.accent }}>
          {meta.icon}
          {modalityLabel(workout.modality)}
        </span>
        <StatusBadge status={workout.status} />
      </div>
      <h3 className="font-display text-xl font-bold text-ink">{workout.title}</h3>
      <div className="flex items-center justify-between">
        {time ? (
          <span className="flex items-center gap-1.5 text-sm text-muted">
            <ClockIcon width={15} height={15} />
            {time}
          </span>
        ) : (
          <span className="text-sm text-muted">Horário livre</span>
        )}
        <span className={uiClasses.button}>Ver treino</span>
      </div>
    </Link>
  );
}

function WorkoutRow({ workout, cta }: { workout: HomeWorkout; cta?: string }) {
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
      {cta ? (
        <span className="shrink-0 rounded-lg bg-orange px-3 py-1.5 text-xs font-semibold text-onbrand">
          {cta}
        </span>
      ) : (
        <>
          <StatusBadge status={workout.status} />
          <ChevronRightIcon className="shrink-0 text-faint" />
        </>
      )}
    </Link>
  );
}

function ReadinessCard({
  readiness,
  missing,
}: {
  readiness: HomeData["readiness"];
  missing: boolean;
}) {
  if (missing) {
    return (
      <Link
        href="/atleta/prontidao"
        className="flex items-center justify-between rounded-xl border border-orange/40 bg-orange/10 p-4 transition-colors hover:border-orange"
      >
        <div className="flex min-w-0 items-center gap-3">
          <AlertIcon className="shrink-0 text-orange-hi" />
          <div className="min-w-0">
            <p className="font-medium text-ink">Prontidão de hoje</p>
            <p className="truncate text-xs text-muted">Leva menos de 30s: sono, fadiga, dor…</p>
          </div>
        </div>
        <ChevronRightIcon className="shrink-0 text-faint" />
      </Link>
    );
  }
  if (!readiness) return null;
  const chips: { label: string; value: number | null }[] = [
    { label: "Sono", value: readiness.sleepHours },
    { label: "Qualidade", value: readiness.sleepQuality },
    { label: "Fadiga", value: readiness.fatigue },
    { label: "Dor", value: readiness.soreness },
  ];
  return (
    <section className="flex flex-col gap-2">
      <h2 className={uiClasses.subheading}>Como você está</h2>
      <div className="grid grid-cols-4 gap-2">
        {chips.map((c) => (
          <div key={c.label} className="rounded-xl border border-line bg-petrol/70 p-3 text-center">
            <p className="tabular text-lg font-semibold text-ink">{c.value ?? "—"}</p>
            <p className="text-[11px] text-muted">{c.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function EvolutionSummary({ summary }: { summary: HomeData["summary"] }) {
  return (
    <Link href="/atleta/evolucao" className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 className={uiClasses.subheading}>Sua evolução</h2>
        <span className="flex items-center gap-1 text-sm text-turq">
          <TrendingUpIcon width={16} height={16} />
          Ver mais
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <SummaryTile label="Aderência 7d" value={summary.adherence7d != null ? `${summary.adherence7d}%` : "—"} />
        <SummaryTile label="Concluídos 7d" value={String(summary.completed7d)} />
        <SummaryTile label="Sequência" value={String(summary.streak)} />
      </div>
    </Link>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-petrol/70 p-3 text-center">
      <p className="tabular text-xl font-semibold text-ink">{value}</p>
      <p className="text-[11px] text-muted">{label}</p>
    </div>
  );
}
