"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch, ApiClientError } from "@/app/_lib/api-client";
import { loadStatusLabel, modalityLabel } from "@/app/_lib/labels";
import { modalityMeta } from "@/app/_lib/modality";
import { toast } from "@/app/_lib/toast";
import { uiClasses } from "@/app/_lib/ui";
import { useRequireRole } from "@/app/_lib/use-session";
import { StatusBadge } from "@/components/ui/badge";
import { WorkoutBlocksView, type BlockView } from "@/components/workout-blocks-view";
import { WorkoutExecution } from "@/components/workout-execution";
import {
  buildFeedbackPayload,
  emptyFeedbackForm,
  FeedbackFormValues,
  WorkoutFeedbackForm,
} from "@/components/workout-feedback-form";

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
  blocks: BlockView[];
  feedback: FeedbackView | null;
}

function formatDate(iso: string): string {
  return new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });
}

export default function AthleteWorkoutDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { checked } = useRequireRole("ATHLETE");
  const [workout, setWorkout] = useState<WorkoutDetailView | null>(null);
  const [editingFeedback, setEditingFeedback] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Ephemeral execution flow (client-only): view -> executing -> feedback.
  const [mode, setMode] = useState<"view" | "executing" | "feedback">("view");
  const [initialCompletion, setInitialCompletion] = useState<"COMPLETED" | "PARTIAL" | "MISSED">(
    "COMPLETED",
  );

  function reload() {
    return apiFetch<{ workout: WorkoutDetailView }>(`/api/athlete/workouts/${id}`).then((result) =>
      setWorkout(result.workout),
    );
  }

  useEffect(() => {
    if (!checked) return;
    reload().catch((err) =>
      setError(err instanceof ApiClientError ? err.message : "Erro inesperado."),
    );
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
      toast.success("Feedback enviado. Obrigado!");
      await reload();
    } catch (err) {
      const message = err instanceof ApiClientError ? err.message : "Erro inesperado.";
      setError(message);
      toast.error(message);
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
        body: JSON.stringify({
          ...buildFeedbackPayload(values),
          knownUpdatedAt: workout.feedback.updatedAt,
        }),
      });
      toast.success("Feedback atualizado.");
      setEditingFeedback(false);
      await reload();
    } catch (err) {
      const message = err instanceof ApiClientError ? err.message : "Erro inesperado.";
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  if (!checked || (!workout && !error)) {
    return (
      <main className={uiClasses.page}>
        <p className="text-muted">Carregando...</p>
      </main>
    );
  }

  if (error && !workout) {
    return (
      <main className={uiClasses.page}>
        <div className={uiClasses.container}>
          <Link href="/atleta" className={uiClasses.link}>
            ← Meus treinos
          </Link>
          <p className={uiClasses.error}>{error}</p>
        </div>
      </main>
    );
  }

  const current = workout as WorkoutDetailView;
  const meta = modalityMeta(current.modality);
  const canSubmitFeedback =
    !current.feedback && (current.status === "PUBLISHED" || current.status === "IN_PROGRESS");

  return (
    <main className={uiClasses.page}>
      <div className={uiClasses.container}>
        <Link href="/atleta" className={uiClasses.link}>
          ← Meus treinos
        </Link>

        <div
          className={`${uiClasses.card} flex flex-col gap-2`}
          style={{ borderLeft: `4px solid ${meta.accent}` }}
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <span
              className="flex items-center gap-2 text-sm font-medium"
              style={{ color: meta.accent }}
            >
              {meta.icon}
              {modalityLabel(current.modality)}
            </span>
            <StatusBadge status={current.status} />
          </div>
          <h1 className={uiClasses.heading}>{current.title}</h1>
          <p className="text-sm capitalize text-muted">{formatDate(current.plannedDate)}</p>
          {current.description && (
            <p className="mt-1 rounded-lg bg-surface/60 p-3 text-sm text-muted">
              {current.description}
            </p>
          )}
        </div>

        {mode !== "executing" && <WorkoutBlocksView blocks={current.blocks} />}

        {canSubmitFeedback && mode === "view" && (
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              className={`${uiClasses.button} sm:flex-[2]`}
              onClick={() => setMode("executing")}
            >
              Iniciar treino
            </button>
            <button
              type="button"
              className={`${uiClasses.buttonSecondary} sm:flex-1`}
              onClick={() => {
                setInitialCompletion("COMPLETED");
                setMode("feedback");
              }}
            >
              Registrar feedback
            </button>
          </div>
        )}

        {canSubmitFeedback && mode === "executing" && (
          <WorkoutExecution
            blocks={current.blocks}
            onFinish={(status) => {
              setInitialCompletion(status);
              setMode("feedback");
            }}
            onAbandon={() => {
              setInitialCompletion("MISSED");
              setMode("feedback");
            }}
          />
        )}

        {canSubmitFeedback && mode === "feedback" && (
          <div className="flex flex-col gap-2">
            <h2 className={uiClasses.subheading}>Como foi o treino?</h2>
            <WorkoutFeedbackForm
              initialValues={{ ...emptyFeedbackForm(), completionStatus: initialCompletion }}
              submitLabel="Enviar feedback"
              submitting={submitting}
              error={error}
              onSubmit={handleSubmitFeedback}
            />
          </div>
        )}

        {current.feedback && !editingFeedback && (
          <div className={`${uiClasses.card} flex flex-col gap-2`}>
            <div className="flex items-center justify-between">
              <h3 className={uiClasses.subheading}>Seu feedback</h3>
              <button className={uiClasses.link} onClick={() => setEditingFeedback(true)}>
                Editar
              </button>
            </div>
            <dl className="grid grid-cols-2 gap-2 text-sm text-muted">
              <dt className="text-faint">Carga (Session-RPE)</dt>
              <dd className="text-ink">
                {current.feedback.sessionRpeLoad ?? "—"}
                {current.feedback.sessionRpeLoad
                  ? ` · ${loadStatusLabel(current.feedback.loadStatus)}`
                  : ""}
              </dd>
              <dt className="text-faint">Duração real</dt>
              <dd className="text-ink">{current.feedback.actualDurationMinutes ?? "—"} min</dd>
              <dt className="text-faint">RPE da sessão</dt>
              <dd className="text-ink">{current.feedback.sessionRpe ?? "—"}</dd>
              <dt className="text-faint">Dor</dt>
              <dd className="text-ink">{current.feedback.painLevel}</dd>
            </dl>
          </div>
        )}

        {current.feedback && editingFeedback && (
          <WorkoutFeedbackForm
            initialValues={{
              ...emptyFeedbackForm(),
              completionStatus:
                current.status === "COMPLETED" ||
                current.status === "PARTIAL" ||
                current.status === "MISSED"
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
