"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch, ApiClientError } from "@/app/_lib/api-client";
import { toast } from "@/app/_lib/toast";
import { useExerciseOptions } from "@/app/_lib/use-exercise-options";
import { useRequireRole } from "@/app/_lib/use-session";
import { uiClasses } from "@/app/_lib/ui";
import {
  AthleteOption,
  buildPrescriptionPayload,
  emptyPrescriptionForm,
  TemplateOption,
  WorkoutPrescriptionForm,
  WorkoutPrescriptionFormValues,
} from "@/components/workout-prescription-form";

interface CreateWorkoutResponse {
  workoutId: string;
}

function NewWorkoutInner() {
  const { checked } = useRequireRole("TRAINER");
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefilledAthleteId = searchParams.get("athleteId") ?? "";
  const [athletes, setAthletes] = useState<AthleteOption[]>([]);
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const exerciseOptions = useExerciseOptions(checked);
  const initialValues = useMemo(
    () => ({ ...emptyPrescriptionForm(), athleteId: prefilledAthleteId }),
    [prefilledAthleteId],
  );

  useEffect(() => {
    if (!checked) return;
    Promise.all([
      apiFetch<{ athletes: AthleteOption[] }>("/api/trainer/athletes"),
      apiFetch<{ templates: TemplateOption[] }>("/api/trainer/templates").catch(() => ({
        templates: [],
      })),
    ])
      .then(([athletesResult, templatesResult]) => {
        setAthletes(athletesResult.athletes);
        setTemplates(templatesResult.templates);
      })
      .catch((err) => setError(err instanceof ApiClientError ? err.message : "Erro inesperado."));
  }, [checked]);

  async function handleSaveDraft(values: WorkoutPrescriptionFormValues) {
    setError(null);
    setSubmitting(true);
    try {
      const payload = buildPrescriptionPayload(values);
      const result = await apiFetch<CreateWorkoutResponse>("/api/trainer/workouts", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      toast.success("Treino salvo como rascunho.");
      router.push(`/treinador/treinos/${result.workoutId}`);
    } catch (err) {
      const message = err instanceof ApiClientError ? err.message : "Erro inesperado.";
      setError(message);
      toast.error(message);
      setSubmitting(false);
    }
  }

  if (!checked) {
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
          <Link href="/treinador" className={uiClasses.link}>
            ← Painel
          </Link>
          <h1 className={uiClasses.heading}>Novo treino</h1>
        </div>
        <WorkoutPrescriptionForm
          mode="create"
          athletes={athletes}
          templates={templates}
          initialValues={initialValues}
          submitting={submitting}
          error={error}
          onSaveDraft={handleSaveDraft}
          onCancel={() => router.push("/treinador")}
          exerciseOptions={exerciseOptions}
        />
      </div>
    </main>
  );
}

export default function NewWorkoutPage() {
  return (
    <Suspense
      fallback={
        <main className={uiClasses.page}>
          <p className="text-muted">Carregando...</p>
        </main>
      }
    >
      <NewWorkoutInner />
    </Suspense>
  );
}
