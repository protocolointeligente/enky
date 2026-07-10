"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch, ApiClientError } from "@/app/_lib/api-client";
import { useRequireRole } from "@/app/_lib/use-session";
import { statusBadgeClass, uiClasses } from "@/app/_lib/ui";

interface AthleteOption {
  athleteProfileId: string;
  name: string | null;
  email: string | null;
}

interface WorkoutListItem {
  id: string;
  title: string;
  modality: string;
  status: string;
  plannedDate: string;
}

export default function TrainerDashboardPage() {
  const { checked } = useRequireRole("TRAINER");
  const [athletes, setAthletes] = useState<AthleteOption[]>([]);
  const [workouts, setWorkouts] = useState<WorkoutListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!checked) return;
    Promise.all([
      apiFetch<{ athletes: AthleteOption[] }>("/api/trainer/athletes"),
      apiFetch<{ workouts: WorkoutListItem[] }>("/api/trainer/workouts"),
    ])
      .then(([athletesResult, workoutsResult]) => {
        setAthletes(athletesResult.athletes);
        setWorkouts(workoutsResult.workouts);
      })
      .catch((err) => setError(err instanceof ApiClientError ? err.message : "Erro inesperado."))
      .finally(() => setLoading(false));
  }, [checked]);

  if (!checked || loading) {
    return (
      <main className={uiClasses.page}>
        <p className="text-slate-400">Carregando...</p>
      </main>
    );
  }

  return (
    <main className={uiClasses.page}>
      <div className={uiClasses.container}>
        <div className="flex items-center justify-between">
          <h1 className={uiClasses.heading}>Painel do treinador</h1>
          <Link href="/treinador/treinos/novo" className={uiClasses.button}>
            + Novo treino
          </Link>
        </div>

        {error && <p className={uiClasses.error}>{error}</p>}

        <section className={`${uiClasses.card} flex flex-col gap-3`}>
          <h2 className="font-semibold text-slate-100">Atletas vinculados ({athletes.length})</h2>
          {athletes.length === 0 ? (
            <p className="text-sm text-slate-400">
              Nenhum atleta vinculado ainda.{" "}
              <Link href="/treinador/atletas" className={uiClasses.link}>
                Convide um atleta
              </Link>{" "}
              para começar a prescrever treinos.
            </p>
          ) : (
            <ul className="flex flex-col gap-1 text-sm text-slate-300">
              {athletes.map((athlete) => (
                <li key={athlete.athleteProfileId}>{athlete.name ?? athlete.email}</li>
              ))}
            </ul>
          )}
        </section>

        <section className={`${uiClasses.card} flex flex-col gap-3`}>
          <h2 className="font-semibold text-slate-100">Treinos ({workouts.length})</h2>
          {workouts.length === 0 ? (
            <p className="text-sm text-slate-400">Nenhum treino criado ainda.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {workouts.map((workout) => (
                <li key={workout.id}>
                  <Link
                    href={`/treinador/treinos/${workout.id}`}
                    className="flex items-center justify-between rounded-lg border border-slate-800 p-3 hover:border-slate-600"
                  >
                    <div>
                      <p className="font-medium text-slate-100">{workout.title}</p>
                      <p className="text-xs text-slate-400">
                        {workout.modality} — {workout.plannedDate.slice(0, 10)}
                      </p>
                    </div>
                    <span
                      className={`${uiClasses.badge} ${statusBadgeClass[workout.status] ?? ""}`}
                    >
                      {workout.status}
                    </span>
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
