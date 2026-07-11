"use client";

import { useMemo, useState } from "react";
import { apiFetch, ApiClientError } from "@/app/_lib/api-client";
import { toast } from "@/app/_lib/toast";
import { uiClasses } from "@/app/_lib/ui";
import { MODALITY_ORDER, modalityMeta } from "@/app/_lib/modality";
import { Modal } from "@/components/ui/modal";
import { LayersIcon } from "@/components/ui/icons";
import {
  BlocksEditor,
  blocksInputToState,
  emptyBlock,
  type BlockFormState,
  type ExerciseOption,
  type Modality,
} from "@/components/blocks-editor";
import {
  buildPrescriptionPayload,
  type AthleteOption,
  type TemplateOption,
  type WorkoutPrescriptionFormValues,
} from "@/components/workout-prescription-form";

interface PrescriptionModalProps {
  open: boolean;
  onClose: () => void;
  athletes: AthleteOption[];
  exerciseOptions: ExerciseOption[];
  templates: TemplateOption[];
  initialDate?: string;
  initialAthleteId?: string;
  initialModality?: Modality;
  onCreated: () => void | Promise<void>;
}

function seed(
  date?: string,
  athleteId?: string,
  modality?: Modality,
): WorkoutPrescriptionFormValues {
  return {
    athleteId: athleteId ?? "",
    title: "",
    description: "",
    modality: modality ?? "RUNNING",
    plannedDate: date ?? "",
    plannedStartAt: "",
    plannedEndAt: "",
    blocks: [emptyBlock()],
  };
}

export function PrescriptionModal({
  open,
  onClose,
  athletes,
  exerciseOptions,
  templates,
  initialDate,
  initialAthleteId,
  initialModality,
  onCreated,
}: PrescriptionModalProps) {
  const [values, setValues] = useState<WorkoutPrescriptionFormValues>(() =>
    seed(initialDate, initialAthleteId, initialModality),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [templatesOpen, setTemplatesOpen] = useState(false);

  // Re-seed whenever the modal is (re)opened for a different day/athlete.
  const seedKey = `${open}:${initialDate}:${initialAthleteId}:${initialModality}`;
  const [lastSeed, setLastSeed] = useState(seedKey);
  if (seedKey !== lastSeed) {
    setLastSeed(seedKey);
    setValues(seed(initialDate, initialAthleteId, initialModality));
    setError(null);
  }

  const set = <K extends keyof WorkoutPrescriptionFormValues>(
    key: K,
    value: WorkoutPrescriptionFormValues[K],
  ) => setValues((current) => ({ ...current, [key]: value }));

  const filledBlocks = values.blocks.filter(
    (b) => b.steps.length > 0 || b.exercises.length > 0,
  ).length;
  const canSave = Boolean(values.athleteId && values.title.trim() && values.plannedDate);
  const canPublish = canSave && filledBlocks > 0;

  const missing = useMemo(() => {
    const list: string[] = [];
    if (!values.athleteId) list.push("atleta");
    if (!values.title.trim()) list.push("título");
    if (!values.plannedDate) list.push("data");
    if (filledBlocks === 0) list.push("um bloco com conteúdo");
    return list;
  }, [values.athleteId, values.title, values.plannedDate, filledBlocks]);

  async function create(): Promise<string> {
    const payload = buildPrescriptionPayload(values);
    const result = await apiFetch<{ workoutId: string }>("/api/trainer/workouts", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return result.workoutId;
  }

  async function handleSaveDraft() {
    setBusy(true);
    setError(null);
    try {
      await create();
      toast.success("Treino salvo como rascunho.");
      await onCreated();
      onClose();
    } catch (err) {
      const message = err instanceof ApiClientError ? err.message : "Erro inesperado.";
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  async function handlePublish() {
    setBusy(true);
    setError(null);
    try {
      const workoutId = await create();
      await apiFetch(`/api/trainer/workouts/${workoutId}/publish`, { method: "POST" });
      toast.success("Treino publicado. Já está no calendário do atleta.");
      await onCreated();
      onClose();
    } catch (err) {
      const message = err instanceof ApiClientError ? err.message : "Erro inesperado.";
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  async function loadTemplate(templateId: string) {
    try {
      const { template } = await apiFetch<{
        template: { title: string; modality: string; content: { blocks: unknown[] } };
      }>(`/api/trainer/templates/${templateId}`);
      setValues((current) => ({
        ...current,
        title: current.title.trim() === "" ? template.title : current.title,
        modality: template.modality as Modality,
        blocks: blocksInputToState(template.content.blocks as never) as BlockFormState[],
      }));
      setTemplatesOpen(false);
      toast.success("Template carregado.");
    } catch {
      toast.error("Não foi possível carregar o template.");
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title="Prescrever treino"
      description={initialDate ? formatHeaderDate(initialDate) : "Novo treino"}
      footer={
        <>
          <button className={uiClasses.buttonGhost} onClick={onClose} disabled={busy}>
            Cancelar
          </button>
          <button
            className={uiClasses.buttonSecondary}
            onClick={handleSaveDraft}
            disabled={busy || !canSave}
          >
            {busy ? "Salvando..." : "Salvar rascunho"}
          </button>
          <button
            className={uiClasses.button}
            onClick={handlePublish}
            disabled={busy || !canPublish}
            title={canPublish ? undefined : `Faltam: ${missing.join(", ")}`}
          >
            Publicar
          </button>
        </>
      }
    >
      {error && <p className={uiClasses.error}>{error}</p>}

      {/* Seletor de modalidade — ícone + cor por esporte */}
      <div className="flex flex-wrap gap-2">
        {MODALITY_ORDER.map((key) => {
          const meta = modalityMeta(key);
          const active = values.modality === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => set("modality", key)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                active
                  ? "border-transparent text-ink"
                  : "border-line text-muted hover:border-line-strong hover:text-ink"
              }`}
              style={
                active ? { backgroundColor: `${meta.accent}22`, color: meta.accent } : undefined
              }
            >
              <span style={{ color: meta.accent }}>{meta.icon}</span>
              {meta.label}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className={uiClasses.label} htmlFor="pm-athlete">
            Atleta
          </label>
          <select
            id="pm-athlete"
            className={uiClasses.select}
            value={values.athleteId}
            onChange={(e) => set("athleteId", e.target.value)}
          >
            <option value="" disabled>
              Selecione
            </option>
            {athletes.map((a) => (
              <option key={a.athleteProfileId} value={a.athleteProfileId}>
                {a.name ?? a.email ?? a.athleteProfileId}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={uiClasses.label} htmlFor="pm-date">
            Data
          </label>
          <input
            id="pm-date"
            type="date"
            className={uiClasses.input}
            value={values.plannedDate}
            onChange={(e) => set("plannedDate", e.target.value)}
          />
        </div>
      </div>

      <div>
        <label className={uiClasses.label} htmlFor="pm-title">
          Título
        </label>
        <input
          id="pm-title"
          maxLength={200}
          className={uiClasses.input}
          value={values.title}
          onChange={(e) => set("title", e.target.value)}
          placeholder="Ex.: Rodagem leve 8 km"
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className={uiClasses.label} htmlFor="pm-start">
            Início (opcional)
          </label>
          <input
            id="pm-start"
            type="datetime-local"
            className={uiClasses.input}
            value={values.plannedStartAt}
            onChange={(e) => set("plannedStartAt", e.target.value)}
          />
        </div>
        <div>
          <label className={uiClasses.label} htmlFor="pm-end">
            Fim (opcional)
          </label>
          <input
            id="pm-end"
            type="datetime-local"
            className={uiClasses.input}
            value={values.plannedEndAt}
            onChange={(e) => set("plannedEndAt", e.target.value)}
          />
        </div>
      </div>

      <div>
        <label className={uiClasses.label} htmlFor="pm-desc">
          Objetivo / descrição (opcional)
        </label>
        <textarea
          id="pm-desc"
          rows={2}
          maxLength={2000}
          className={uiClasses.textarea}
          value={values.description}
          onChange={(e) => set("description", e.target.value)}
        />
      </div>

      <div className="flex items-center justify-between">
        <span className={uiClasses.label}>Estrutura</span>
        {templates.length > 0 && (
          <div className="relative">
            <button
              type="button"
              className={uiClasses.buttonGhost}
              onClick={() => setTemplatesOpen((v) => !v)}
            >
              <LayersIcon />
              Usar template
            </button>
            {templatesOpen && (
              <div className="absolute right-0 z-10 mt-1 w-64 rounded-lg border border-line bg-petrol p-1 shadow-xl">
                {templates.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm text-ink hover:bg-surface"
                    onClick={() => loadTemplate(t.id)}
                  >
                    <span className="truncate">{t.title}</span>
                    <span className="ml-2 shrink-0 text-xs text-muted">
                      {modalityMeta(t.modality).label}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <BlocksEditor
        blocks={values.blocks}
        modality={values.modality}
        exerciseOptions={exerciseOptions}
        onChange={(blocks) => set("blocks", blocks)}
      />
    </Modal>
  );
}

function formatHeaderDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });
}
