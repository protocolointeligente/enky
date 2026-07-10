"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch, ApiClientError } from "@/app/_lib/api-client";
import { useRequireRole } from "@/app/_lib/use-session";
import { statusBadgeClass, uiClasses } from "@/app/_lib/ui";
import { buildFeedbackPayload, emptyFeedbackForm, FeedbackFormValues, WorkoutFeedbackForm } from "@/components/workout-feedback-form";

interface WorkoutStepView {
  id: string;
  sequence: number;
  stepType: string;
  repetitions: number | null;
  durationSeconds: number | null;
  distanceMeters: number | null;
}

interface WorkoutExerciseView {
  id: string;
  sequence: number;
  sets: number;
  reps: number | null;
  loadKg: string | null;
  exercise: { name: string; category: string };
}

interface WorkoutBlockView {
  id: string;
  sequence: number;
  name: string | null;
  repetitions: number;
  steps: WorkoutStepView[];
  exercises: WorkoutExerciseView[];
}

interface FeedbackView {
  id: string;
  updatedAt: string;
  actualDurationMinutes: number | null;
  actualDistanceKm: string | null;
  sessionRpe: number | null;
  sessionRpeLoad: string | null;
  loadStatus: string;
  fatigueLevel: number | null;
  recoveryLevel: number | null;
  painLevel: number;
  painLaterality: string | null;
  painRegion: string | null;
  notes: string | null;
}

interface WorkoutDetailView {
  id: string;
  title: string;
  description: string | null;
  modality: string;
  status: string;
  plannedDate: string;
  blocks: WorkoutBlockView[];
  feedback: FeedbackView | null;
}

export default function AthleteWorkoutDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { checked } = useRequireRole("ATHLETE");
  const [workout, setWorkout] = useState<WorkoutDetailView | null>(null);
  const [editingFeedback, setEditingFeedback] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function reload() {
    return apiFetch<{ workout: WorkoutDetailView }>(`/api/athlete/workouts/${id}`).then((result) =>
      setWorkout(result.workout),
    );
  }

  useEffect(() => {
    if (!checked) return;
    reload().catch((err) => setError(err instanceof ApiClientError ? err.message : "Erro inesperado."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checked, id]);

  async function handleSubmitFeedback(values: FeedbackFormValues) {
    setError(null);
    setSubmitting(true);
    try {
      await apiFetch(`/api/athlete/workouts/${id}/feedback`, {
        method: "POST",
        body: JSON.stringify(buildFeedbackPayload(values)),
      });
      await reload();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Erro inesperado.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpdateFeedback(values: FeedbackFormValues) {
    if (!workout?.feedback) return;
    setError(null);
    setSubmitting(true);
    try {
      await apiFetch(`/api/athlete/workouts/${id}/feedback`, {
        method: "PATCH",
        body: JSON.stringify({ ...buildFeedbackPayload(values), knownUpdatedAt: workout.feedback.updatedAt }),
      });
      setEditingFeedback(false);
      await reload();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Erro inesperado.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!checked || (!workout && !error)) {
    return (
      <main className={uiClasses.page}>
        <p className="text-slate-400">Carregando...</p>
      </main>
    );
  }

  if (error && !workout) {
    return (
      <main className={uiClasses.page}>
        <p className={uiClasses.error}>{error}</p>
      </main>
    );
  }

  const current = workout as WorkoutDetailView;
  const canSubmitFeedback = !current.feedback && (current.status === "PUBLISHED" || current.status === "IN_PROGRESS");

  return (
    <main className={uiClasses.page}>
      <div className={uiClasses.container}>
        <Link href="/atleta" className={uiClasses.link}>
          ← Voltar
        </Link>

        <div className={`${uiClasses.card} flex flex-col gap-2`}>
          <div className="flex items-center justify-between">
            <h1 className={uiClasses.heading}>{current.title}</h1>
            <span className={`${uiClasses.badge} ${statusBadgeClass[current.status] ?? ""}`}>{current.status}</span>
          </div>
          <p className="text-sm text-slate-400">
            {current.modality} — {current.plannedDate.slice(0, 10)}
          </p>
          {current.description && <p className="text-sm text-slate-300">{current.description}</p>}
        </div>

        <div className="flex flex-col gap-4">
          {current.blocks.map((block) => (
            <div key={block.id} className={`${uiClasses.card} flex flex-col gap-2`}>
              <h3 className="font-semibold text-slate-100">
                Bloco {block.sequence}
                {block.name ? ` — ${block.name}` : ""} ({block.repetitions}x)
              </h3>
              {block.steps.length > 0 && (
                <ul className="flex flex-col gap-1 text-sm text-slate-300">
                  {block.steps.map((step) => (
                    <li key={step.id}>
                      {step.stepType}
                      {step.repetitions ? ` × ${step.repetitions}` : ""}
                      {step.durationSeconds ? ` — ${step.durationSeconds}s` : ""}
                      {step.distanceMeters ? ` — ${step.distanceMeters}m` : ""}
                    </li>
                  ))}
                </ul>
              )}
              {block.exercises.length > 0 && (
                <ul className="flex flex-col gap-1 text-sm text-slate-300">
                  {block.exercises.map((exercise) => (
                    <li key={exercise.id}>
                      {exercise.exercise.name} — {exercise.sets}x{exercise.reps ?? "-"}
                      {exercise.loadKg ? ` @ ${exercise.loadKg}kg` : ""}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>

        {canSubmitFeedback && (
          <WorkoutFeedbackForm
            initialValues={emptyFeedbackForm()}
            submitLabel="Enviar feedback"
            submitting={submitting}
            error={error}
            onSubmit={handleSubmitFeedback}
          />
        )}

        {current.feedback && !editingFeedback && (
          <div className={`${uiClasses.card} flex flex-col gap-2`}>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-100">Seu feedback</h3>
              <button className="text-sm text-[#00e6c3] hover:underline" onClick={() => setEditingFeedback(true)}>
                Editar
              </button>
            </div>
            <dl className="grid grid-cols-2 gap-2 text-sm text-slate-300">
              <dt className="text-slate-500">Carga (Session-RPE)</dt>
              <dd>
                {current.feedback.sessionRpeLoad ?? "—"} ({current.feedback.loadStatus})
              </dd>
              <dt className="text-slate-500">Duração real</dt>
              <dd>{current.feedback.actualDurationMinutes ?? "—"} min</dd>
              <dt className="text-slate-500">RPE da sessão</dt>
              <dd>{current.feedback.sessionRpe ?? "—"}</dd>
              <dt className="text-slate-500">Dor</dt>
              <dd>{current.feedback.painLevel}</dd>
            </dl>
          </div>
        )}

        {current.feedback && editingFeedback && (
          <WorkoutFeedbackForm
            initialValues={{
              ...emptyFeedbackForm(),
              // completionStatus isn't stored on WorkoutFeedback itself — it
              // was folded into Workout.status by the original submission,
              // so that's the closest source of truth when re-editing.
              completionStatus:
                current.status === "COMPLETED" || current.status === "PARTIAL" || current.status === "MISSED"
                  ? current.status
                  : "COMPLETED",
              actualDurationMinutes: current.feedback.actualDurationMinutes?.toString() ?? "",
              actualDistanceKm: current.feedback.actualDistanceKm ?? "",
              sessionRpe: current.feedback.sessionRpe?.toString() ?? "",
              fatigueLevel: current.feedback.fatigueLevel?.toString() ?? "",
              recoveryLevel: current.feedback.recoveryLevel?.toString() ?? "",
              painLevel: String(current.feedback.painLevel),
              painLaterality: current.feedback.painLaterality ?? "",
              painRegion: current.feedback.painRegion ?? "",
              notes: current.feedback.notes ?? "",
            }}
            submitLabel="Salvar alterações"
            submitting={submitting}
            error={error}
            onSubmit={handleUpdateFeedback}
          />
        )}
      </div>
    </main>
  );
}
