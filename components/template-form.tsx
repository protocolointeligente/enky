"use client";

import { useState } from "react";
import { uiClasses } from "@/app/_lib/ui";
import {
  BlocksEditor,
  buildBlocksPayload,
  emptyBlock,
  MODALITIES,
  type BlockFormState,
  type ExerciseOption,
  type Modality,
} from "@/components/blocks-editor";

export interface TemplateFormValues {
  title: string;
  description: string;
  modality: Modality;
  level: string;
  objective: string;
  estimatedDurationMinutes: string;
  tags: string;
  blocks: BlockFormState[];
}

export function emptyTemplateForm(): TemplateFormValues {
  return {
    title: "",
    description: "",
    modality: "STRENGTH",
    level: "",
    objective: "",
    estimatedDurationMinutes: "",
    tags: "",
    blocks: [emptyBlock()],
  };
}

// Serializes into the create/update template API payload (validated by
// template-schema.ts). Reuses the exact block serializer as the workout form.
export function buildTemplatePayload(values: TemplateFormValues) {
  const duration = Number.parseInt(values.estimatedDurationMinutes, 10);
  return {
    title: values.title,
    description: values.description.trim() === "" ? undefined : values.description,
    modality: values.modality,
    content: {
      blocks: buildBlocksPayload(values.blocks),
      level: values.level.trim() === "" ? undefined : values.level.trim(),
      objective: values.objective.trim() === "" ? undefined : values.objective.trim(),
      estimatedDurationMinutes: Number.isNaN(duration) || duration <= 0 ? undefined : duration,
      tags: values.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    },
  };
}

interface TemplateFormProps {
  initialValues: TemplateFormValues;
  submitLabel: string;
  submitting: boolean;
  error: string | null;
  onSubmit: (values: TemplateFormValues) => void;
  exerciseOptions?: ExerciseOption[];
}

export function TemplateForm({
  initialValues,
  submitLabel,
  submitting,
  error,
  onSubmit,
  exerciseOptions = [],
}: TemplateFormProps) {
  const [values, setValues] = useState<TemplateFormValues>(initialValues);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(values);
      }}
      className="flex flex-col gap-6"
    >
      {error && <p className={uiClasses.error}>{error}</p>}

      <div className={`${uiClasses.card} flex flex-col gap-4`}>
        <div>
          <label className={uiClasses.label} htmlFor="tpl-title">
            Título
          </label>
          <input
            id="tpl-title"
            required
            maxLength={200}
            className={uiClasses.input}
            value={values.title}
            onChange={(e) => setValues((v) => ({ ...v, title: e.target.value }))}
          />
        </div>
        <div>
          <label className={uiClasses.label} htmlFor="tpl-description">
            Descrição (opcional)
          </label>
          <textarea
            id="tpl-description"
            rows={2}
            maxLength={2000}
            className={uiClasses.input}
            value={values.description}
            onChange={(e) => setValues((v) => ({ ...v, description: e.target.value }))}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={uiClasses.label} htmlFor="tpl-modality">
              Modalidade
            </label>
            <select
              id="tpl-modality"
              className={uiClasses.select}
              value={values.modality}
              onChange={(e) => setValues((v) => ({ ...v, modality: e.target.value as Modality }))}
            >
              {MODALITIES.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={uiClasses.label} htmlFor="tpl-level">
              Nível (opcional)
            </label>
            <input
              id="tpl-level"
              className={uiClasses.input}
              value={values.level}
              onChange={(e) => setValues((v) => ({ ...v, level: e.target.value }))}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={uiClasses.label} htmlFor="tpl-objective">
              Objetivo (opcional)
            </label>
            <input
              id="tpl-objective"
              className={uiClasses.input}
              value={values.objective}
              onChange={(e) => setValues((v) => ({ ...v, objective: e.target.value }))}
            />
          </div>
          <div>
            <label className={uiClasses.label} htmlFor="tpl-duration">
              Duração estimada (min, opcional)
            </label>
            <input
              id="tpl-duration"
              type="number"
              min={1}
              className={uiClasses.input}
              value={values.estimatedDurationMinutes}
              onChange={(e) =>
                setValues((v) => ({ ...v, estimatedDurationMinutes: e.target.value }))
              }
            />
          </div>
        </div>
        <div>
          <label className={uiClasses.label} htmlFor="tpl-tags">
            Tags (separadas por vírgula, opcional)
          </label>
          <input
            id="tpl-tags"
            className={uiClasses.input}
            value={values.tags}
            onChange={(e) => setValues((v) => ({ ...v, tags: e.target.value }))}
          />
        </div>
      </div>

      <BlocksEditor
        blocks={values.blocks}
        modality={values.modality}
        exerciseOptions={exerciseOptions}
        onChange={(blocks) => setValues((v) => ({ ...v, blocks }))}
      />

      <button type="submit" className={uiClasses.button} disabled={submitting}>
        {submitting ? "Salvando..." : submitLabel}
      </button>
    </form>
  );
}
