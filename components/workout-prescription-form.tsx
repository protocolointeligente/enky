"use client";

import { useMemo, useState } from "react";
import { apiFetch } from "@/app/_lib/api-client";
import { modalityLabel } from "@/app/_lib/labels";
import { toast } from "@/app/_lib/toast";
import { uiClasses } from "@/app/_lib/ui";
import { Modal } from "@/components/ui/modal";
import { AlertIcon, LayersIcon } from "@/components/ui/icons";
import {
  BlocksEditor,
  blocksInputToState,
  buildBlocksPayload,
  emptyBlock,
  MODALITIES,
  type BlockFormState,
  type ExerciseOption,
  type Modality,
} from "@/components/blocks-editor";

// The single canonical prescription form — reused by "novo treino" and
// "editar treino". Block/step/exercise editing lives in the shared
// BlocksEditor (also used by the workout-template form). This component owns
// only layout, the live summary, and the state-aware action bar.

export type { ExerciseOption };

export interface WorkoutPrescriptionFormValues {
  athleteId: string;
  title: string;
  description: string;
  modality: Modality;
  plannedDate: string;
  plannedStartAt: string;
  plannedEndAt: string;
  blocks: BlockFormState[];
}

export interface AthleteOption {
  athleteProfileId: string;
  name: string | null;
  email: string | null;
}

export interface TemplateOption {
  id: string;
  title: string;
  modality: string;
}

export function emptyPrescriptionForm(): WorkoutPrescriptionFormValues {
  return {
    athleteId: "",
    title: "",
    description: "",
    modality: "RUNNING",
    plannedDate: "",
    plannedStartAt: "",
    plannedEndAt: "",
    blocks: [emptyBlock()],
  };
}

// Builds the exact JSON payload the create/update draft API routes expect
// (validated server-side by prescription-schema.ts).
export function buildPrescriptionPayload(values: WorkoutPrescriptionFormValues) {
  return {
    athleteId: values.athleteId,
    title: values.title,
    description: values.description.trim() === "" ? undefined : values.description,
    modality: values.modality,
    plannedDate: values.plannedDate,
    plannedStartAt:
      values.plannedStartAt === "" ? undefined : new Date(values.plannedStartAt).toISOString(),
    plannedEndAt:
      values.plannedEndAt === "" ? undefined : new Date(values.plannedEndAt).toISOString(),
    blocks: buildBlocksPayload(values.blocks),
  };
}

function countMovements(blocks: BlockFormState[]): { steps: number; blocks: number } {
  const filled = blocks.filter((b) => b.steps.length > 0 || b.exercises.length > 0);
  const steps = filled.reduce((sum, b) => sum + b.steps.length + b.exercises.length, 0);
  return { steps, blocks: filled.length };
}

// Rough estimate from the step timings the trainer entered (duration + active
// recovery, multiplied by block repetitions). Null when nothing timed was
// entered — we never fabricate a number.
function estimateMinutes(blocks: BlockFormState[]): number | null {
  let seconds = 0;
  for (const block of blocks) {
    const reps = Math.max(1, Number.parseInt(block.repetitions, 10) || 1);
    let blockSeconds = 0;
    for (const step of block.steps) {
      blockSeconds += Number.parseInt(step.durationSeconds, 10) || 0;
      blockSeconds += Number.parseInt(step.recoverySeconds, 10) || 0;
    }
    seconds += blockSeconds * reps;
  }
  return seconds > 0 ? Math.round(seconds / 60) : null;
}

interface WorkoutPrescriptionFormProps {
  mode: "create" | "edit";
  athletes: AthleteOption[];
  initialValues: WorkoutPrescriptionFormValues;
  submitting: boolean;
  error: string | null;
  onSaveDraft: (values: WorkoutPrescriptionFormValues) => void;
  onCancel: () => void;
  exerciseOptions?: ExerciseOption[];
  templates?: TemplateOption[];
  // Edit-mode only: persist the current edits, then take the trainer to the
  // review step. Absent in create mode (nothing to publish before first save).
  onReviewPublish?: (values: WorkoutPrescriptionFormValues) => void;
  onSaveAsTemplate?: (values: WorkoutPrescriptionFormValues) => void;
}

export function WorkoutPrescriptionForm({
  mode,
  athletes,
  initialValues,
  submitting,
  error,
  onSaveDraft,
  onCancel,
  exerciseOptions = [],
  templates = [],
  onReviewPublish,
  onSaveAsTemplate,
}: WorkoutPrescriptionFormProps) {
  const [values, setValues] = useState<WorkoutPrescriptionFormValues>(initialValues);
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [loadingTemplate, setLoadingTemplate] = useState<string | null>(null);

  const set = <K extends keyof WorkoutPrescriptionFormValues>(
    key: K,
    value: WorkoutPrescriptionFormValues[K],
  ) => setValues((current) => ({ ...current, [key]: value }));

  const { steps, blocks: filledBlocks } = useMemo(
    () => countMovements(values.blocks),
    [values.blocks],
  );
  const minutes = useMemo(() => estimateMinutes(values.blocks), [values.blocks]);

  const warnings = useMemo(() => {
    const list: string[] = [];
    if (!values.athleteId) list.push("Selecione o atleta.");
    if (!values.title.trim()) list.push("Informe o título do treino.");
    if (!values.plannedDate) list.push("Defina a data planejada.");
    if (filledBlocks === 0) list.push("Adicione ao menos um bloco com passo ou exercício.");
    return list;
  }, [values.athleteId, values.title, values.plannedDate, filledBlocks]);

  const canPublish = warnings.length === 0;
  const athleteName =
    athletes.find((a) => a.athleteProfileId === values.athleteId)?.name ??
    athletes.find((a) => a.athleteProfileId === values.athleteId)?.email ??
    null;

  async function applyTemplate(templateId: string) {
    setLoadingTemplate(templateId);
    try {
      const { template } = await apiFetch<{
        template: { title: string; modality: string; content: { blocks: unknown[] } };
      }>(`/api/trainer/templates/${templateId}`);
      setValues((current) => ({
        ...current,
        title: current.title.trim() === "" ? template.title : current.title,
        modality: template.modality as Modality,
        blocks: blocksInputToState(template.content.blocks as never),
      }));
      setTemplatePickerOpen(false);
      toast.success("Template carregado no treino.");
    } catch {
      toast.error("Não foi possível carregar o template.");
    } finally {
      setLoadingTemplate(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {error && <p className={uiClasses.error}>{error}</p>}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Coluna esquerda — dados gerais */}
        <div className="flex flex-col gap-4 lg:col-span-4">
          <div className={`${uiClasses.card} flex flex-col gap-4`}>
            <h2 className={uiClasses.subheading}>Dados do treino</h2>
            <div>
              <label className={uiClasses.label} htmlFor="athleteId">
                Atleta
              </label>
              <select
                id="athleteId"
                required
                className={uiClasses.select}
                value={values.athleteId}
                onChange={(e) => set("athleteId", e.target.value)}
              >
                <option value="" disabled>
                  Selecione um atleta
                </option>
                {athletes.map((athlete) => (
                  <option key={athlete.athleteProfileId} value={athlete.athleteProfileId}>
                    {athlete.name ?? athlete.email ?? athlete.athleteProfileId}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={uiClasses.label} htmlFor="title">
                Título
              </label>
              <input
                id="title"
                required
                maxLength={200}
                className={uiClasses.input}
                value={values.title}
                onChange={(e) => set("title", e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={uiClasses.label} htmlFor="modality">
                  Modalidade
                </label>
                <select
                  id="modality"
                  className={uiClasses.select}
                  value={values.modality}
                  onChange={(e) => set("modality", e.target.value as Modality)}
                >
                  {MODALITIES.map((modality) => (
                    <option key={modality} value={modality}>
                      {modalityLabel(modality)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={uiClasses.label} htmlFor="plannedDate">
                  Data
                </label>
                <input
                  id="plannedDate"
                  type="date"
                  required
                  className={uiClasses.input}
                  value={values.plannedDate}
                  onChange={(e) => set("plannedDate", e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={uiClasses.label} htmlFor="plannedStartAt">
                  Início (opcional)
                </label>
                <input
                  id="plannedStartAt"
                  type="datetime-local"
                  className={uiClasses.input}
                  value={values.plannedStartAt}
                  onChange={(e) => set("plannedStartAt", e.target.value)}
                />
              </div>
              <div>
                <label className={uiClasses.label} htmlFor="plannedEndAt">
                  Fim (opcional)
                </label>
                <input
                  id="plannedEndAt"
                  type="datetime-local"
                  className={uiClasses.input}
                  value={values.plannedEndAt}
                  onChange={(e) => set("plannedEndAt", e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className={uiClasses.label} htmlFor="description">
                Objetivo / descrição (opcional)
              </label>
              <textarea
                id="description"
                maxLength={2000}
                rows={3}
                className={uiClasses.textarea}
                value={values.description}
                onChange={(e) => set("description", e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Coluna central — construtor */}
        <div className="flex flex-col gap-4 lg:col-span-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className={uiClasses.subheading}>Estrutura da sessão</h2>
            {templates.length > 0 && (
              <button
                type="button"
                className={uiClasses.buttonSecondary}
                onClick={() => setTemplatePickerOpen(true)}
              >
                <LayersIcon />
                Usar template
              </button>
            )}
          </div>
          <BlocksEditor
            blocks={values.blocks}
            modality={values.modality}
            exerciseOptions={exerciseOptions}
            athleteId={values.athleteId || undefined}
            onChange={(blocks) => set("blocks", blocks)}
          />
        </div>

        {/* Coluna direita — resumo + ações */}
        <div className="lg:col-span-3">
          <div className="flex flex-col gap-4 lg:sticky lg:top-20">
            <div className={`${uiClasses.card} flex flex-col gap-3`}>
              <h2 className={uiClasses.subheading}>Resumo</h2>
              <dl className="flex flex-col gap-2 text-sm">
                <SummaryRow label="Atleta" value={athleteName ?? "—"} />
                <SummaryRow label="Modalidade" value={modalityLabel(values.modality)} />
                <SummaryRow label="Data" value={values.plannedDate || "—"} />
                <SummaryRow label="Duração estimada" value={minutes ? `${minutes} min` : "—"} />
                <SummaryRow label="Blocos" value={String(filledBlocks)} />
                <SummaryRow label="Passos / exercícios" value={String(steps)} />
              </dl>

              {warnings.length > 0 && (
                <div className="flex flex-col gap-1 rounded-lg border border-orange/30 bg-orange/10 p-3 text-xs text-orange-hi">
                  <span className="flex items-center gap-1.5 font-semibold">
                    <AlertIcon width={14} height={14} />
                    Pendências de preenchimento
                  </span>
                  <ul className="list-disc pl-4">
                    {warnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2">
              {mode === "edit" && onReviewPublish && (
                <button
                  type="button"
                  className={uiClasses.button}
                  disabled={submitting || !canPublish}
                  title={canPublish ? undefined : "Complete os campos obrigatórios para publicar."}
                  onClick={() => onReviewPublish(values)}
                >
                  Revisar e publicar
                </button>
              )}
              <button
                type="button"
                className={
                  mode === "edit" && onReviewPublish ? uiClasses.buttonSecondary : uiClasses.button
                }
                disabled={submitting}
                onClick={() => onSaveDraft(values)}
              >
                {submitting ? "Salvando..." : "Salvar rascunho"}
              </button>
              {mode === "edit" && onSaveAsTemplate && (
                <button
                  type="button"
                  className={uiClasses.buttonGhost}
                  disabled={submitting}
                  onClick={() => onSaveAsTemplate(values)}
                >
                  Salvar como template
                </button>
              )}
              <button
                type="button"
                className={uiClasses.buttonGhost}
                disabled={submitting}
                onClick={onCancel}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      </div>

      <Modal
        open={templatePickerOpen}
        onClose={() => setTemplatePickerOpen(false)}
        title="Usar template"
        description="Carrega a estrutura do template neste treino. Você pode ajustar antes de salvar."
      >
        {templates.length === 0 ? (
          <p className={uiClasses.hint}>Nenhum template disponível.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {templates.map((template) => (
              <li key={template.id}>
                <button
                  type="button"
                  disabled={loadingTemplate !== null}
                  onClick={() => applyTemplate(template.id)}
                  className="flex w-full items-center justify-between rounded-lg border border-line bg-surface px-4 py-3 text-left transition-colors hover:border-electric hover:bg-surface-2 disabled:opacity-50"
                >
                  <span className="font-medium text-ink">{template.title}</span>
                  <span className="text-xs text-muted">{modalityLabel(template.modality)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-medium text-ink">{value}</dd>
    </div>
  );
}
