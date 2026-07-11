"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, ApiClientError } from "@/app/_lib/api-client";
import { useExerciseOptions } from "@/app/_lib/use-exercise-options";
import { useRequireRole } from "@/app/_lib/use-session";
import { uiClasses } from "@/app/_lib/ui";
import {
  AthleteOption,
  buildPrescriptionPayload,
  emptyPrescriptionForm,
  WorkoutPrescriptionForm,
  WorkoutPrescriptionFormValues,
} from "@/components/workout-prescription-form";

interface CreateWorkoutResponse {
  workoutId: string;
}

export default function NewWorkoutPage() {
  const { checked } = useRequireRole("TRAINER");
  const router = useRouter();
  const [athletes, setAthletes] = useState<AthleteOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const exerciseOptions = useExerciseOptions(checked);

  useEffect(() => {
    if (!checked) return;
    apiFetch<{ athletes: AthleteOption[] }>("/api/trainer/athletes")
      .then((result) => setAthletes(result.athletes))
      .catch((err) => setError(err instanceof ApiClientError ? err.message : "Erro inesperado."));
  }, [checked]);

  async function handleSubmit(values: WorkoutPrescriptionFormValues) {
    setError(null);
    setSubmitting(true);
    try {
      const payload = buildPrescriptionPayload(values);
      const result = await apiFetch<CreateWorkoutResponse>("/api/trainer/workouts", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      router.push(`/treinador/treinos/${result.workoutId}`);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Erro inesperado.");
      setSubmitting(false);
    }
  }

  if (!checked) {
    return (
      <main className={uiClasses.page}>
        <p className="text-slate-400">Carregando...</p>
      </main>
    );
  }

  return (
    <main className={uiClasses.page}>
      <div className={uiClasses.container}>
        <h1 className={uiClasses.heading}>Novo treino</h1>
        <WorkoutPrescriptionForm
          athletes={athletes}
          initialValues={emptyPrescriptionForm()}
          submitLabel="Salvar rascunho"
          submitting={submitting}
          error={error}
          onSubmit={handleSubmit}
          exerciseOptions={exerciseOptions}
        />
      </div>
    </main>
  );
}
