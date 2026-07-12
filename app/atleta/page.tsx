"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiFetch, ApiClientError } from "@/app/_lib/api-client";
import { toISODate } from "@/app/_lib/calendar";
import { modalityLabel } from "@/app/_lib/labels";
import { modalityMeta } from "@/app/_lib/modality";
import { uiClasses } from "@/app/_lib/ui";
import { useRequireRole } from "@/app/_lib/use-session";
import { StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { CalendarIcon, ChevronRightIcon, ClockIcon } from "@/components/ui/icons";

interface WorkoutListItem {
  id: string;
  title: string;
  modality: string;
  status: string;
  plannedDate: string;
  plannedStartAt?: string | null;
  feedback: { id: string; loadStatus: string } | null;
}

const DONE_STATUSES = ["COMPLETED", "PARTIAL", "MISSED"];

function timeOf(item: WorkoutListItem): string | null {
  if (!item.plannedStartAt) return null;
  return new Date(item.plannedStartAt).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AthleteHomePage() {
  const { user, checked } = useRequireRole("ATHLETE");
  const [workouts, setWorkouts] = useState<WorkoutListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const todayIso = useMemo(() => toISODate(new Date()), []);

  useEffect(() => {
    if (!checked) return;
    apiFetch<{ workouts: WorkoutListItem[] }>("/api/athlete/workouts")
      .then((result) => setWorkouts(result.workouts))
      .catch((err) => setError(err instanceof ApiClientError ? err.message : "Erro inesperado."))
      .finally(() => setLoading(false));
  }, [checked]);

  const today = workouts.filter((w) => w.plannedDate.slice(0, 10) === todayIso);
  const pending = workouts.filter(
    (w) => w.status === "PUBLISHED" && w.plannedDate.slice(0, 10) < todayIso && !w.feedback,
  );
  const upcoming = workouts
    .filter((w) => w.status === "PUBLISHED" && w.plannedDate.slice(0, 10) > todayIso)
    .sort((a, b) => a.plannedDate.localeCompare(b.plannedDate))
    .slice(0, 5);
  const completed = workouts
    .filter((w) => DONE_STATUSES.includes(w.status))
    .sort((a, b) => b.plannedDate.localeCompare(a.plannedDate))
    .slice(0, 5);

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
            {new Date().toLocaleDateString("pt-BR", {
              weekday: "long",
              day: "2-digit",
              month: "long",
            })}
          </span>
          <h1 className={uiClasses.heading}>Olá, {user?.name?.split(" ")[0] ?? "atleta"}</h1>
        </header>

        {error && <p className={uiClasses.error}>{error}</p>}

        {/* Check-in de prontidão */}
        <Link
          href="/atleta/prontidao"
          className="flex items-center justify-between rounded-xl border border-line bg-petrol/70 p-4 transition-colors hover:border-line-strong"
        >
          <div className="min-w-0">
            <p className="font-medium text-ink">Check-in de prontidão</p>
            <p className="truncate text-xs text-muted">Como você está hoje? (sono, fadiga, dor…)</p>
          </div>
          <ChevronRightIcon className="shrink-0 text-faint" />
        </Link>

        {/* Relatórios */}
        <Link
          href="/atleta/relatorios"
          className="flex items-center justify-between rounded-xl border border-line bg-petrol/70 p-4 transition-colors hover:border-line-strong"
        >
          <div className="min-w-0">
            <p className="font-medium text-ink">Relatórios</p>
            <p className="truncate text-xs text-muted">Resumos que seu treinador compartilhou</p>
          </div>
          <ChevronRightIcon className="shrink-0 text-faint" />
        </Link>

        {/* Treino de hoje */}
        <section className="flex flex-col gap-2">
          <h2 className={uiClasses.subheading}>Treino de hoje</h2>
          {today.length === 0 ? (
            <EmptyState
              title="Dia de descanso"
              description="Você não tem treino programado para hoje."
              icon={<CalendarIcon width={28} height={28} />}
            />
          ) : (
            today.map((w) => <TodayCard key={w.id} workout={w} />)
          )}
        </section>

        {/* Precisa de atenção */}
        {pending.length > 0 && (
          <section className="flex flex-col gap-2">
            <h2 className={uiClasses.subheading}>Precisa de atenção</h2>
            {pending.map((w) => (
              <WorkoutRow key={w.id} workout={w} cta="Enviar feedback" />
            ))}
          </section>
        )}

        {/* Próximos treinos */}
        <section className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h2 className={uiClasses.subheading}>Próximos treinos</h2>
            <Link href="/atleta/calendario" className={uiClasses.link}>
              Calendário
            </Link>
          </div>
          {upcoming.length === 0 ? (
            <p className="text-sm text-muted">Nenhum treino programado.</p>
          ) : (
            upcoming.map((w) => <WorkoutRow key={w.id} workout={w} />)
          )}
        </section>

        {/* Concluídos */}
        {completed.length > 0 && (
          <section className="flex flex-col gap-2">
            <h2 className={uiClasses.subheading}>Concluídos recentemente</h2>
            {completed.map((w) => (
              <WorkoutRow key={w.id} workout={w} />
            ))}
          </section>
        )}
      </div>
    </main>
  );
}

function TodayCard({ workout }: { workout: WorkoutListItem }) {
  const meta = modalityMeta(workout.modality);
  const time = timeOf(workout);
  return (
    <Link
      href={`/atleta/treinos/${workout.id}`}
      className="flex flex-col gap-3 rounded-2xl border border-line bg-petrol/70 p-5 transition-colors hover:border-line-strong"
      style={{ borderLeft: `4px solid ${meta.accent}` }}
    >
      <div className="flex items-center justify-between">
        <span
          className="flex items-center gap-2 text-sm font-medium"
          style={{ color: meta.accent }}
        >
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

function WorkoutRow({ workout, cta }: { workout: WorkoutListItem; cta?: string }) {
  const meta = modalityMeta(workout.modality);
  const date = new Date(`${workout.plannedDate.slice(0, 10)}T00:00:00`).toLocaleDateString(
    "pt-BR",
    {
      weekday: "short",
      day: "2-digit",
      month: "short",
    },
  );
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
        <p className="truncate text-xs text-muted capitalize">
          {date} · {modalityLabel(workout.modality)}
        </p>
      </div>
      {cta ? (
        <span className="shrink-0 rounded-lg bg-orange px-3 py-1.5 text-xs font-semibold text-deep">
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
