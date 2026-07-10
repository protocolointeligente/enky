"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, ApiClientError } from "@/app/_lib/api-client";
import { useRequireRole } from "@/app/_lib/use-session";
import { uiClasses } from "@/app/_lib/ui";
import {
  AthleteOption,
  buildPrescriptionPayload,
  WorkoutPrescriptionForm,
  WorkoutPrescriptionFormValues,
} from "@/components/workout-prescription-form";

interface WorkoutStepDto {
  stepType: string;
  repetitions: number | null;
  durationSeconds: number | null;
  distanceMeters: number | null;
  targetType: string | null;
  targetMin: string | null;
  targetMax: string | null;
  recoverySeconds: number | null;
  recoveryMeters: number | null;
}

interface WorkoutExerciseDto {
  sets: number;
  reps: number | null;
  durationSeconds: number | null;
  loadKg: string | null;
  rir: number | null;
  rpeTarget: number | null;
  restSeconds: number | null;
  notes: string | null;
  exercise: { name: string; category: string };
}

interface WorkoutBlockDto {
  name: string | null;
  repetitions: number;
  steps: WorkoutStepDto[];
  exercises: WorkoutExerciseDto[];
}

interface WorkoutEditDto {
  id: string;
  athleteId: string;
  title: string;
  description: string | null;
  modality: WorkoutPrescriptionFormValues["modality"];
  status: string;
  plannedDate: string;
  plannedStartAt: string | null;
  plannedEndAt: string | null;
  lockVersion: number;
  blocks: WorkoutBlockDto[];
}

function toLocalDateInput(iso: string): string {
  return iso.slice(0, 10);
}

function toLocalDateTimeInput(iso: string | null): string {
  if (!iso) return "";
  return iso.slice(0, 16);
}

function toFormValues(dto: WorkoutEditDto): WorkoutPrescriptionFormValues {
  return {
    athleteId: dto.athleteId,
    title: dto.title,
    description: dto.description ?? "",
    modality: dto.modality,
    plannedDate: toLocalDateInput(dto.plannedDate),
    plannedStartAt: toLocalDateTimeInput(dto.plannedStartAt),
    plannedEndAt: toLocalDateTimeInput(dto.plannedEndAt),
    blocks: dto.blocks.map((block) => ({
      key: Math.random().toString(36).slice(2),
      name: block.name ?? "",
      repetitions: String(block.repetitions),
      steps: block.steps.map((step) => ({
        key: Math.random().toString(36).slice(2),
        stepType: step.stepType as WorkoutPrescriptionFormValues["blocks"][number]["steps"][number]["stepType"],
        repetitions: step.repetitions?.toString() ?? "",
        durationSeconds: step.durationSeconds?.toString() ?? "",
        distanceMeters: step.distanceMeters?.toString() ?? "",
        targetType: (step.targetType ?? "") as WorkoutPrescriptionFormValues["blocks"][number]["steps"][number]["targetType"],
        targetMin: step.targetMin ?? "",
        targetMax: step.targetMax ?? "",
        recoverySeconds: step.recoverySeconds?.toString() ?? "",
        recoveryMeters: step.recoveryMeters?.toString() ?? "",
      })),
      exercises: block.exercises.map((exercise) => ({
        key: Math.random().toString(36).slice(2),
        exerciseName: exercise.exercise.name,
        exerciseCategory: exercise.exercise.category,
        sets: String(exercise.sets),
        reps: exercise.reps?.toString() ?? "",
        durationSeconds: exercise.durationSeconds?.toString() ?? "",
        loadKg: exercise.loadKg ?? "",
        rir: exercise.rir?.toString() ?? "",
        rpeTarget: exercise.rpeTarget?.toString() ?? "",
        restSeconds: exercise.restSeconds?.toString() ?? "",
        notes: exercise.notes ?? "",
      })),
    })),
  };
}

export default function EditWorkoutPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { checked } = useRequireRole("TRAINER");
  const router = useRouter();
  const [athletes, setAthletes] = useState<AthleteOption[]>([]);
  const [initialValues, setInitialValues] = useState<WorkoutPrescriptionFormValues | null>(null);
  const [lockVersion, setLockVersion] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!checked) return;
    Promise.all([
      apiFetch<{ athletes: AthleteOption[] }>("/api/trainer/athletes"),
      apiFetch<{ workout: WorkoutEditDto }>(`/api/trainer/workouts/${id}`),
    ])
      .then(([athletesResult, workoutResult]) => {
        if (workoutResult.workout.status !== "DRAFT") {
          setError("Somente treinos em rascunho podem ser editados.");
          return;
        }
        setAthletes(athletesResult.athletes);
        setInitialValues(toFormValues(workoutResult.workout));
        setLockVersion(workoutResult.workout.lockVersion);
      })
      .catch((err) => setError(err instanceof ApiClientError ? err.message : "Erro inesperado."));
  }, [checked, id]);

  async function handleSubmit(values: WorkoutPrescriptionFormValues) {
    if (lockVersion === null) return;
    setError(null);
    setSubmitting(true);
    try {
      const payload = { ...buildPrescriptionPayload(values), lockVersion };
      await apiFetch(`/api/trainer/workouts/${id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      router.push(`/treinador/treinos/${id}`);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Erro inesperado.");
      setSubmitting(false);
    }
  }

  if (!checked || (!initialValues && !error)) {
    return (
      <main className={uiClasses.page}>
        <p className="text-slate-400">Carregando...</p>
      </main>
    );
  }

  if (error && !initialValues) {
    return (
      <main className={uiClasses.page}>
        <p className={uiClasses.error}>{error}</p>
      </main>
    );
  }

  return (
    <main className={uiClasses.page}>
      <div className={uiClasses.container}>
        <h1 className={uiClasses.heading}>Editar treino</h1>
        <WorkoutPrescriptionForm
          athletes={athletes}
          initialValues={initialValues as WorkoutPrescriptionFormValues}
          submitLabel="Salvar alterações"
          submitting={submitting}
          error={error}
          onSubmit={handleSubmit}
        />
      </div>
    </main>
  );
}
