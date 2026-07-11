"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch, ApiClientError } from "@/app/_lib/api-client";
import { useRequireRole } from "@/app/_lib/use-session";
import { statusBadgeClass, uiClasses } from "@/app/_lib/ui";

interface WorkoutStepView {
  id: string;
  sequence: number;
  stepType: string;
  repetitions: number | null;
  durationSeconds: number | null;
  distanceMeters: number | null;
  targetType: string | null;
  targetMin: string | null;
  targetMax: string | null;
}

interface WorkoutExerciseView {
  id: string;
  sequence: number;
  sets: number;
  reps: number | null;
  loadKg: string | null;
  rpeTarget: number | null;
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
  lockVersion: number;
  blocks: WorkoutBlockView[];
  feedback: FeedbackView | null;
}

export default function TrainerWorkoutDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { checked } = useRequireRole("TRAINER");
  const [workout, setWorkout] = useState<WorkoutDetailView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [savingTemplate, setSavingTemplate] = useState(false);

  function reload() {
    return apiFetch<{ workout: WorkoutDetailView }>(`/api/trainer/workouts/${id}`).then((result) =>
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

  async function handlePublish() {
    setError(null);
    setPublishing(true);
    try {
      await apiFetch(`/api/trainer/workouts/${id}/publish`, { method: "POST" });
      await reload();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Erro inesperado.");
    } finally {
      setPublishing(false);
    }
  }

  async function handleSaveAsTemplate() {
    const title = window.prompt("Nome do template:", workout?.title ?? "");
    if (!title || title.trim() === "") return;
    setError(null);
    setNotice(null);
    setSavingTemplate(true);
    try {
      await apiFetch(`/api/trainer/workouts/${id}/save-as-template`, {
        method: "POST",
        body: JSON.stringify({ title: title.trim(), tags: [] }),
      });
      setNotice("Treino salvo como template.");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Erro inesperado.");
    } finally {
      setSavingTemplate(false);
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

  return (
    <main className={uiClasses.page}>
      <div className={uiClasses.container}>
        <Link href="/treinador" className={uiClasses.link}>
          ← Voltar
        </Link>

        {error && <p className={uiClasses.error}>{error}</p>}
        {notice && <p className={uiClasses.success}>{notice}</p>}

        <div className={`${uiClasses.card} flex flex-col gap-2`}>
          <div className="flex items-center justify-between">
            <h1 className={uiClasses.heading}>{current.title}</h1>
            <span className={`${uiClasses.badge} ${statusBadgeClass[current.status] ?? ""}`}>
              {current.status}
            </span>
          </div>
          <p className="text-sm text-slate-400">
            {current.modality} — {current.plannedDate.slice(0, 10)}
          </p>
          {current.description && <p className="text-sm text-slate-300">{current.description}</p>}

          <div className="mt-2 flex flex-wrap gap-3">
            {current.status === "DRAFT" && (
              <>
                <Link
                  href={`/treinador/treinos/${id}/editar`}
                  className={uiClasses.buttonSecondary}
                >
                  Editar rascunho
                </Link>
                <button className={uiClasses.button} onClick={handlePublish} disabled={publishing}>
                  {publishing ? "Publicando..." : "Publicar treino"}
                </button>
              </>
            )}
            <button
              className={uiClasses.buttonSecondary}
              onClick={handleSaveAsTemplate}
              disabled={savingTemplate}
            >
              {savingTemplate ? "Salvando..." : "Salvar como template"}
            </button>
          </div>
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
                      {step.targetType
                        ? ` (${step.targetType} ${step.targetMin ?? ""}-${step.targetMax ?? ""})`
                        : ""}
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
                      {exercise.rpeTarget ? ` (RPE ${exercise.rpeTarget})` : ""}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>

        <div className={`${uiClasses.card} flex flex-col gap-2`}>
          <h3 className="font-semibold text-slate-100">Feedback do atleta</h3>
          {!current.feedback ? (
            <p className="text-sm text-slate-400">O atleta ainda não enviou feedback.</p>
          ) : (
            <dl className="grid grid-cols-2 gap-2 text-sm text-slate-300">
              <dt className="text-slate-500">Carga (Session-RPE)</dt>
              <dd>
                {current.feedback.sessionRpeLoad ?? "—"} ({current.feedback.loadStatus})
              </dd>
              <dt className="text-slate-500">Duração real</dt>
              <dd>{current.feedback.actualDurationMinutes ?? "—"} min</dd>
              <dt className="text-slate-500">RPE da sessão</dt>
              <dd>{current.feedback.sessionRpe ?? "—"}</dd>
              <dt className="text-slate-500">Fadiga</dt>
              <dd>{current.feedback.fatigueLevel ?? "—"}</dd>
              <dt className="text-slate-500">Recuperação</dt>
              <dd>{current.feedback.recoveryLevel ?? "—"}</dd>
              <dt className="text-slate-500">Dor</dt>
              <dd>
                {current.feedback.painLevel}
                {current.feedback.painRegion ? ` — ${current.feedback.painRegion}` : ""}
                {current.feedback.painLaterality ? ` (${current.feedback.painLaterality})` : ""}
              </dd>
              {current.feedback.notes && (
                <>
                  <dt className="text-slate-500">Notas</dt>
                  <dd>{current.feedback.notes}</dd>
                </>
              )}
            </dl>
          )}
        </div>
      </div>
    </main>
  );
}
