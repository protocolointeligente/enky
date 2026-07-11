"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch, ApiClientError } from "@/app/_lib/api-client";
import { toast } from "@/app/_lib/toast";
import { useExerciseOptions } from "@/app/_lib/use-exercise-options";
import { useRequireRole } from "@/app/_lib/use-session";
import { uiClasses } from "@/app/_lib/ui";
import {
  AthleteOption,
  buildPrescriptionPayload,
  TemplateOption,
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
        stepType:
          step.stepType as WorkoutPrescriptionFormValues["blocks"][number]["steps"][number]["stepType"],
        repetitions: step.repetitions?.toString() ?? "",
        durationSeconds: step.durationSeconds?.toString() ?? "",
        distanceMeters: step.distanceMeters?.toString() ?? "",
        targetType: (step.targetType ??
          "") as WorkoutPrescriptionFormValues["blocks"][number]["steps"][number]["targetType"],
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
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [initialValues, setInitialValues] = useState<WorkoutPrescriptionFormValues | null>(null);
  const [lockVersion, setLockVersion] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const exerciseOptions = useExerciseOptions(checked);

  useEffect(() => {
    if (!checked) return;
    Promise.all([
      apiFetch<{ athletes: AthleteOption[] }>("/api/trainer/athletes"),
      apiFetch<{ workout: WorkoutEditDto }>(`/api/trainer/workouts/${id}`),
      apiFetch<{ templates: TemplateOption[] }>("/api/trainer/templates").catch(() => ({
        templates: [],
      })),
    ])
      .then(([athletesResult, workoutResult, templatesResult]) => {
        if (workoutResult.workout.status !== "DRAFT") {
          setError("Somente treinos em rascunho podem ser editados.");
          return;
        }
        setAthletes(athletesResult.athletes);
        setTemplates(templatesResult.templates);
        setInitialValues(toFormValues(workoutResult.workout));
        setLockVersion(workoutResult.workout.lockVersion);
      })
      .catch((err) => setError(err instanceof ApiClientError ? err.message : "Erro inesperado."));
  }, [checked, id]);

  // Persists the current edits. Returns the fresh lockVersion so a follow-up
  // action (publish, save-as-template) can chain without a stale-lock conflict.
  async function persist(values: WorkoutPrescriptionFormValues): Promise<void> {
    if (lockVersion === null) throw new Error("no-lock");
    const payload = { ...buildPrescriptionPayload(values), lockVersion };
    await apiFetch(`/api/trainer/workouts/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  }

  async function handleSaveDraft(values: WorkoutPrescriptionFormValues) {
    setError(null);
    setSubmitting(true);
    try {
      await persist(values);
      toast.success("Rascunho atualizado.");
      router.push(`/treinador/treinos/${id}`);
    } catch (err) {
      const message = err instanceof ApiClientError ? err.message : "Erro inesperado.";
      setError(message);
      toast.error(message);
      setSubmitting(false);
    }
  }

  async function handleReviewPublish(values: WorkoutPrescriptionFormValues) {
    setError(null);
    setSubmitting(true);
    try {
      await persist(values);
      router.push(`/treinador/treinos/${id}?revisar=1`);
    } catch (err) {
      const message = err instanceof ApiClientError ? err.message : "Erro inesperado.";
      setError(message);
      toast.error(message);
      setSubmitting(false);
    }
  }

  async function handleSaveAsTemplate(values: WorkoutPrescriptionFormValues) {
    setError(null);
    setSubmitting(true);
    try {
      await persist(values);
      await apiFetch(`/api/trainer/workouts/${id}/save-as-template`, {
        method: "POST",
        body: JSON.stringify({ title: values.title.trim() || "Template", tags: [] }),
      });
      toast.success("Treino salvo como template.");
      router.push(`/treinador/treinos/${id}`);
    } catch (err) {
      const message = err instanceof ApiClientError ? err.message : "Erro inesperado.";
      setError(message);
      toast.error(message);
      setSubmitting(false);
    }
  }

  if (!checked || (!initialValues && !error)) {
    return (
      <main className={uiClasses.page}>
        <p className="text-muted">Carregando...</p>
      </main>
    );
  }

  if (error && !initialValues) {
    return (
      <main className={uiClasses.page}>
        <div className={uiClasses.container}>
          <Link href={`/treinador/treinos/${id}`} className={uiClasses.link}>
            ← Voltar ao treino
          </Link>
          <p className={uiClasses.error}>{error}</p>
        </div>
      </main>
    );
  }

  return (
    <main className={uiClasses.page}>
      <div className={uiClasses.wide}>
        <div className="flex flex-col gap-1">
          <Link href={`/treinador/treinos/${id}`} className={uiClasses.link}>
            ← Voltar ao treino
          </Link>
          <h1 className={uiClasses.heading}>Editar treino</h1>
        </div>
        <WorkoutPrescriptionForm
          mode="edit"
          athletes={athletes}
          templates={templates}
          initialValues={initialValues as WorkoutPrescriptionFormValues}
          submitting={submitting}
          error={error}
          onSaveDraft={handleSaveDraft}
          onReviewPublish={handleReviewPublish}
          onSaveAsTemplate={handleSaveAsTemplate}
          onCancel={() => router.push(`/treinador/treinos/${id}`)}
          exerciseOptions={exerciseOptions}
        />
      </div>
    </main>
  );
}
