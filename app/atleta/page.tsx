"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch, ApiClientError } from "@/app/_lib/api-client";
import { useRequireRole } from "@/app/_lib/use-session";
import { statusBadgeClass, uiClasses } from "@/app/_lib/ui";

interface WorkoutListItem {
  id: string;
  title: string;
  modality: string;
  status: string;
  plannedDate: string;
  feedback: { id: string; loadStatus: string } | null;
}

export default function AthleteWorkoutsPage() {
  const { checked } = useRequireRole("ATHLETE");
  const [workouts, setWorkouts] = useState<WorkoutListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!checked) return;
    apiFetch<{ workouts: WorkoutListItem[] }>("/api/athlete/workouts")
      .then((result) => setWorkouts(result.workouts))
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
        <h1 className={uiClasses.heading}>Meus treinos</h1>

        {error && <p className={uiClasses.error}>{error}</p>}

        {!error && workouts.length === 0 && (
          <p className="text-sm text-slate-400">Nenhum treino publicado ainda.</p>
        )}

        {!error && workouts.length > 0 && (
          <ul className="flex flex-col gap-2">
            {workouts.map((workout) => (
              <li key={workout.id}>
                <Link
                  href={`/atleta/treinos/${workout.id}`}
                  className="flex items-center justify-between rounded-lg border border-slate-800 p-3 hover:border-slate-600"
                >
                  <div>
                    <p className="font-medium text-slate-100">{workout.title}</p>
                    <p className="text-xs text-slate-400">
                      {workout.modality} — {workout.plannedDate.slice(0, 10)}
                    </p>
                  </div>
                  <span className={`${uiClasses.badge} ${statusBadgeClass[workout.status] ?? ""}`}>
                    {workout.status}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
