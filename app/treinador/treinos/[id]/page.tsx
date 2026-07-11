"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch, ApiClientError } from "@/app/_lib/api-client";
import { loadStatusLabel, modalityLabel } from "@/app/_lib/labels";
import { toast } from "@/app/_lib/toast";
import { uiClasses } from "@/app/_lib/ui";
import { useRequireRole } from "@/app/_lib/use-session";
import { StatusBadge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { WorkoutBlocksView, type BlockView } from "@/components/workout-blocks-view";

interface FeedbackView {
  id: string;
  actualDurationMinutes: number | null;
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
  athleteId: string;
  title: string;
  description: string | null;
  modality: string;
  status: string;
  plannedDate: string;
  plannedStartAt: string | null;
  lockVersion: number;
  blocks: BlockView[];
  feedback: FeedbackView | null;
}

interface AthleteOption {
  athleteProfileId: string;
  name: string | null;
  email: string | null;
}

function formatDate(iso: string): string {
  return new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });
}

function formatTime(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export default function TrainerWorkoutDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { checked } = useRequireRole("TRAINER");
  const router = useRouter();
  const searchParams = useSearchParams();

  const [workout, setWorkout] = useState<WorkoutDetailView | null>(null);
  const [athletes, setAthletes] = useState<AthleteOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [publishModalOpen, setPublishModalOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [templateTitle, setTemplateTitle] = useState("");
  const [savingTemplate, setSavingTemplate] = useState(false);

  function reload() {
    return apiFetch<{ workout: WorkoutDetailView }>(`/api/trainer/workouts/${id}`).then((result) =>
      setWorkout(result.workout),
    );
  }

  useEffect(() => {
    if (!checked) return;
    Promise.all([
      apiFetch<{ workout: WorkoutDetailView }>(`/api/trainer/workouts/${id}`),
      apiFetch<{ athletes: AthleteOption[] }>("/api/trainer/athletes").catch(() => ({
        athletes: [],
      })),
    ])
      .then(([workoutResult, athletesResult]) => {
        setWorkout(workoutResult.workout);
        setAthletes(athletesResult.athletes);
        if (searchParams.get("revisar") === "1" && workoutResult.workout.status === "DRAFT") {
          setReviewing(true);
        }
      })
      .catch((err) => setError(err instanceof ApiClientError ? err.message : "Erro inesperado."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checked, id]);

  async function handlePublish() {
    setPublishing(true);
    try {
      await apiFetch(`/api/trainer/workouts/${id}/publish`, { method: "POST" });
      toast.success("Treino publicado. Já está no calendário do atleta.");
      setPublishModalOpen(false);
      setReviewing(false);
      router.replace(`/treinador/treinos/${id}`);
      await reload();
    } catch (err) {
      const message = err instanceof ApiClientError ? err.message : "Erro inesperado.";
      toast.error(message);
    } finally {
      setPublishing(false);
    }
  }

  async function handleSaveAsTemplate() {
    if (templateTitle.trim() === "") return;
    setSavingTemplate(true);
    try {
      await apiFetch(`/api/trainer/workouts/${id}/save-as-template`, {
        method: "POST",
        body: JSON.stringify({ title: templateTitle.trim(), tags: [] }),
      });
      toast.success("Treino salvo como template.");
      setTemplateModalOpen(false);
    } catch (err) {
      const message = err instanceof ApiClientError ? err.message : "Erro inesperado.";
      toast.error(message);
    } finally {
      setSavingTemplate(false);
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
          <Link href="/treinador" className={uiClasses.link}>
            ← Painel
          </Link>
          <p className={uiClasses.error}>{error}</p>
        </div>
      </main>
    );
  }

  const current = workout as WorkoutDetailView;
  const athleteName =
    athletes.find((a) => a.athleteProfileId === current.athleteId)?.name ??
    athletes.find((a) => a.athleteProfileId === current.athleteId)?.email ??
    "o atleta";
  const time = formatTime(current.plannedStartAt);
  const isDraft = current.status === "DRAFT";

  // ---- Tela de revisão (somente leitura) ----
  if (reviewing) {
    return (
      <main className={uiClasses.page}>
        <div className={uiClasses.container}>
          <span className={uiClasses.eyebrow}>Revisão antes de publicar</span>
          <h1 className={uiClasses.heading}>{current.title}</h1>

          <div className={`${uiClasses.card} flex flex-col gap-3`}>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <ReviewRow label="Atleta" value={athleteName} />
              <ReviewRow label="Modalidade" value={modalityLabel(current.modality)} />
              <ReviewRow label="Data" value={formatDate(current.plannedDate)} />
              <ReviewRow label="Horário" value={time ?? "Não definido"} />
              <ReviewRow label="Blocos" value={String(current.blocks.length)} />
            </dl>
            {current.description && <p className="text-sm text-muted">{current.description}</p>}
          </div>

          <WorkoutBlocksView blocks={current.blocks} />

          <div className="rounded-lg border border-electric/30 bg-electric/10 p-3 text-sm text-electric-hi">
            Ao publicar, <strong>{athleteName}</strong> passa a ver este treino no calendário e pode
            registrar o feedback.
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Link href={`/treinador/treinos/${id}/editar`} className={uiClasses.buttonGhost}>
              Voltar e editar
            </Link>
            <button className={uiClasses.buttonSecondary} onClick={() => setReviewing(false)}>
              Manter como rascunho
            </button>
            <button className={uiClasses.button} onClick={() => setPublishModalOpen(true)}>
              Publicar treino
            </button>
          </div>
        </div>

        <PublishModal
          open={publishModalOpen}
          onClose={() => setPublishModalOpen(false)}
          onConfirm={handlePublish}
          onEdit={() => router.push(`/treinador/treinos/${id}/editar`)}
          publishing={publishing}
          athleteName={athleteName}
          title={current.title}
          date={formatDate(current.plannedDate)}
          time={time}
          modality={modalityLabel(current.modality)}
          blockCount={current.blocks.length}
        />
      </main>
    );
  }

  // ---- Tela de detalhe ----
  return (
    <main className={uiClasses.page}>
      <div className={uiClasses.container}>
        <Link href="/treinador" className={uiClasses.link}>
          ← Painel
        </Link>

        {error && <p className={uiClasses.error}>{error}</p>}

        <div className={`${uiClasses.card} flex flex-col gap-3`}>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h1 className={uiClasses.heading}>{current.title}</h1>
            <StatusBadge status={current.status} />
          </div>
          <p className="text-sm text-muted">
            {athleteName} · {modalityLabel(current.modality)} · {formatDate(current.plannedDate)}
            {time ? ` · ${time}` : ""}
          </p>
          {current.description && <p className="text-sm text-muted">{current.description}</p>}

          <div className="mt-1 flex flex-wrap gap-2">
            {isDraft && (
              <>
                <Link
                  href={`/treinador/treinos/${id}/editar`}
                  className={uiClasses.buttonSecondary}
                >
                  Editar rascunho
                </Link>
                <button className={uiClasses.button} onClick={() => setReviewing(true)}>
                  Revisar e publicar
                </button>
              </>
            )}
            <button
              className={uiClasses.buttonGhost}
              onClick={() => {
                setTemplateTitle(current.title);
                setTemplateModalOpen(true);
              }}
            >
              Salvar como template
            </button>
          </div>
        </div>

        <WorkoutBlocksView blocks={current.blocks} />

        <div className={`${uiClasses.card} flex flex-col gap-2`}>
          <h3 className={uiClasses.subheading}>Feedback do atleta</h3>
          {!current.feedback ? (
            <p className="text-sm text-muted">O atleta ainda não enviou feedback.</p>
          ) : (
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
              <dt className="text-faint">Fadiga</dt>
              <dd className="text-ink">{current.feedback.fatigueLevel ?? "—"}</dd>
              <dt className="text-faint">Recuperação</dt>
              <dd className="text-ink">{current.feedback.recoveryLevel ?? "—"}</dd>
              <dt className="text-faint">Dor</dt>
              <dd className="text-ink">
                {current.feedback.painLevel}
                {current.feedback.painRegion ? ` — ${current.feedback.painRegion}` : ""}
              </dd>
              {current.feedback.notes && (
                <>
                  <dt className="text-faint">Notas</dt>
                  <dd className="text-ink">{current.feedback.notes}</dd>
                </>
              )}
            </dl>
          )}
        </div>
      </div>

      <Modal
        open={templateModalOpen}
        onClose={() => setTemplateModalOpen(false)}
        title="Salvar como template"
        description="Cria um template reutilizável a partir do conteúdo atual deste treino."
        footer={
          <>
            <button className={uiClasses.buttonGhost} onClick={() => setTemplateModalOpen(false)}>
              Cancelar
            </button>
            <button
              className={uiClasses.button}
              onClick={handleSaveAsTemplate}
              disabled={savingTemplate || templateTitle.trim() === ""}
            >
              {savingTemplate ? "Salvando..." : "Salvar template"}
            </button>
          </>
        }
      >
        <label className={uiClasses.label} htmlFor="templateTitle">
          Nome do template
        </label>
        <input
          id="templateTitle"
          className={uiClasses.input}
          value={templateTitle}
          maxLength={200}
          onChange={(e) => setTemplateTitle(e.target.value)}
        />
      </Modal>
    </main>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-faint">{label}</dt>
      <dd className="text-right font-medium text-ink">{value}</dd>
    </>
  );
}

interface PublishModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  onEdit: () => void;
  publishing: boolean;
  athleteName: string;
  title: string;
  date: string;
  time: string | null;
  modality: string;
  blockCount: number;
}

function PublishModal({
  open,
  onClose,
  onConfirm,
  onEdit,
  publishing,
  athleteName,
  title,
  date,
  time,
  modality,
  blockCount,
}: PublishModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Publicar treino para o atleta?"
      description="Após a publicação, o treino ficará disponível no calendário do atleta."
      footer={
        <>
          <button className={uiClasses.buttonGhost} onClick={onClose} disabled={publishing}>
            Cancelar
          </button>
          <button className={uiClasses.buttonSecondary} onClick={onEdit} disabled={publishing}>
            Voltar para editar
          </button>
          <button className={uiClasses.button} onClick={onConfirm} disabled={publishing}>
            {publishing ? "Publicando..." : "Publicar treino"}
          </button>
        </>
      }
    >
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg border border-line bg-deep p-3 text-sm">
        <dt className="text-faint">Atleta</dt>
        <dd className="text-right font-medium text-ink">{athleteName}</dd>
        <dt className="text-faint">Treino</dt>
        <dd className="text-right font-medium text-ink">{title}</dd>
        <dt className="text-faint">Data</dt>
        <dd className="text-right font-medium text-ink">{date}</dd>
        <dt className="text-faint">Horário</dt>
        <dd className="text-right font-medium text-ink">{time ?? "Não definido"}</dd>
        <dt className="text-faint">Modalidade</dt>
        <dd className="text-right font-medium text-ink">{modality}</dd>
        <dt className="text-faint">Blocos</dt>
        <dd className="text-right font-medium text-ink">{blockCount}</dd>
      </dl>
      <p className="text-sm text-muted">
        O treino ficará visível para <strong className="text-ink">{athleteName}</strong> no
        calendário.
      </p>
    </Modal>
  );
}
