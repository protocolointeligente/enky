"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch, ApiClientError } from "@/app/_lib/api-client";
import { modalityLabel, loadStatusLabel } from "@/app/_lib/labels";
import { uiClasses } from "@/app/_lib/ui";
import { useRequireRole } from "@/app/_lib/use-session";
import { PlannedVsActual } from "@/components/planned-vs-actual";
import { StatusBadge } from "@/components/ui/badge";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  CalendarIcon,
  CheckIcon,
  ChevronRightIcon,
  DumbbellIcon,
  PlusIcon,
} from "@/components/ui/icons";

interface AthleteInfo {
  athleteProfileId: string;
  name: string | null;
  email: string | null;
}

interface WorkoutFeedbackSummary {
  id: string;
  loadStatus: string;
  painLevel: number;
}

interface WorkoutRow {
  id: string;
  title: string;
  modality: string;
  status: string;
  plannedDate: string;
  feedback: WorkoutFeedbackSummary | null;
}

function formatDate(iso: string): string {
  return new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function TrainerAthleteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { checked } = useRequireRole("TRAINER");

  const [athlete, setAthlete] = useState<AthleteInfo | null>(null);
  const [workouts, setWorkouts] = useState<WorkoutRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!checked) return;

    Promise.all([
      apiFetch<{ athletes: AthleteInfo[] }>("/api/trainer/athletes"),
      apiFetch<{ workouts: WorkoutRow[] }>(
        `/api/trainer/workouts?athleteId=${id}`,
      ),
    ])
      .then(([athletesResult, workoutsResult]) => {
        const match = athletesResult.athletes.find(
          (a) => a.athleteProfileId === id,
        );
        if (!match) {
          setError("Atleta não encontrado ou sem vínculo ativo.");
        } else {
          setAthlete(match);
        }
        setWorkouts(workoutsResult.workouts);
      })
      .catch((err) =>
        setError(
          err instanceof ApiClientError ? err.message : "Erro inesperado.",
        ),
      )
      .finally(() => setLoading(false));
  }, [checked, id]);

  if (!checked || loading) {
    return (
      <main className={uiClasses.page}>
        <p className="text-muted">Carregando...</p>
      </main>
    );
  }

  if (error || !athlete) {
    return (
      <main className={uiClasses.page}>
        <div className={uiClasses.container}>
          <p className={uiClasses.error}>{error ?? "Atleta não encontrado."}</p>
          <Link href="/treinador/atletas" className={uiClasses.link}>
            ← Voltar aos atletas
          </Link>
        </div>
      </main>
    );
  }

  const completed = workouts.filter((w) => w.status === "COMPLETED").length;
  const withFeedback = workouts.filter((w) => w.feedback).length;
  const missed = workouts.filter((w) => w.status === "MISSED").length;
  const painAlerts = workouts.filter(
    (w) => w.feedback && w.feedback.painLevel >= 4,
  ).length;

  return (
    <main className={uiClasses.page}>
      <div className={uiClasses.container}>
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-1">
            <Link
              href="/treinador/atletas"
              className="text-xs text-muted transition-colors hover:text-ink"
            >
              ← Atletas
            </Link>
            <h1 className={uiClasses.heading}>
              {athlete.name ?? "Atleta sem nome"}
            </h1>
            {athlete.email && (
              <p className="text-sm text-muted">{athlete.email}</p>
            )}
          </div>
          <Link
            href={`/treinador/treinos/novo?athleteId=${id}`}
            className={uiClasses.button}
          >
            <PlusIcon />
            Criar treino
          </Link>
        </div>

        {/* KPIs */}
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            label="Treinos"
            value={workouts.length}
            icon={<DumbbellIcon />}
          />
          <StatCard
            label="Concluídos"
            value={completed}
            icon={<CheckIcon />}
            tone="turq"
          />
          <StatCard
            label="Feedbacks"
            value={withFeedback}
            icon={<CalendarIcon />}
            tone="electric"
          />
          {painAlerts > 0 ? (
            <StatCard
              label="Alertas de dor"
              value={painAlerts}
              tone="orange"
              hint="Dor ≥ 4 no feedback"
            />
          ) : (
            <StatCard label="Não realizados" value={missed} tone="orange" />
          )}
        </section>

        {/* Planejado × Realizado (Fase 11). Auto-suficiente: busca sozinho e
            degrada sozinho, para que uma falha na integração não derrube o
            detalhe do atleta. */}
        <PlannedVsActual athleteId={id} />

        {/* Workout list */}
        <section className={uiClasses.panel}>
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <h2 className={uiClasses.subheading}>Treinos prescritos</h2>
            <span className="text-xs text-faint">
              {workouts.length} treino{workouts.length !== 1 ? "s" : ""}
            </span>
          </div>

          {workouts.length === 0 ? (
            <div className="p-5">
              <EmptyState
                title="Nenhum treino ainda"
                description="Crie o primeiro treino para este atleta."
                icon={<DumbbellIcon width={28} height={28} />}
                action={{
                  label: "Criar treino",
                  href: `/treinador/treinos/novo?athleteId=${id}`,
                }}
              />
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {workouts.map((workout) => (
                <li key={workout.id}>
                  <Link
                    href={`/treinador/treinos/${workout.id}`}
                    className="flex items-center gap-4 px-5 py-3 transition-colors hover:bg-surface"
                  >
                    <div className="w-20 shrink-0">
                      <span className="text-sm font-semibold text-ink">
                        {formatDate(workout.plannedDate)}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-ink">
                        {workout.title}
                      </p>
                      <p className="truncate text-xs text-muted">
                        {modalityLabel(workout.modality)}
                        {workout.feedback
                          ? ` · Carga: ${loadStatusLabel(workout.feedback.loadStatus)}`
                          : ""}
                        {workout.feedback && workout.feedback.painLevel > 0
                          ? ` · Dor: ${workout.feedback.painLevel}/10`
                          : ""}
                      </p>
                    </div>
                    <StatusBadge status={workout.status} />
                    <ChevronRightIcon className="shrink-0 text-faint" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
