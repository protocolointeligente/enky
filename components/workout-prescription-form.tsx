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

// The single canonical prescription form — reused by "novo treino" and
// "editar treino". The block/step/exercise editing lives in the shared
// BlocksEditor so the same tree also powers the workout-template form.

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

interface WorkoutPrescriptionFormProps {
  athletes: AthleteOption[];
  initialValues: WorkoutPrescriptionFormValues;
  submitLabel: string;
  submitting: boolean;
  error: string | null;
  onSubmit: (values: WorkoutPrescriptionFormValues) => void;
  exerciseOptions?: ExerciseOption[];
}

export function WorkoutPrescriptionForm({
  athletes,
  initialValues,
  submitLabel,
  submitting,
  error,
  onSubmit,
  exerciseOptions = [],
}: WorkoutPrescriptionFormProps) {
  const [values, setValues] = useState<WorkoutPrescriptionFormValues>(initialValues);

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
          <label className={uiClasses.label} htmlFor="athleteId">
            Atleta
          </label>
          <select
            id="athleteId"
            required
            className={uiClasses.select}
            value={values.athleteId}
            onChange={(event) =>
              setValues((current) => ({ ...current, athleteId: event.target.value }))
            }
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
            onChange={(event) =>
              setValues((current) => ({ ...current, title: event.target.value }))
            }
          />
        </div>

        <div>
          <label className={uiClasses.label} htmlFor="description">
            Descrição (opcional)
          </label>
          <textarea
            id="description"
            maxLength={2000}
            rows={2}
            className={uiClasses.input}
            value={values.description}
            onChange={(event) =>
              setValues((current) => ({ ...current, description: event.target.value }))
            }
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={uiClasses.label} htmlFor="modality">
              Modalidade
            </label>
            <select
              id="modality"
              className={uiClasses.select}
              value={values.modality}
              onChange={(event) =>
                setValues((current) => ({ ...current, modality: event.target.value as Modality }))
              }
            >
              {MODALITIES.map((modality) => (
                <option key={modality} value={modality}>
                  {modality}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={uiClasses.label} htmlFor="plannedDate">
              Data planejada
            </label>
            <input
              id="plannedDate"
              type="date"
              required
              className={uiClasses.input}
              value={values.plannedDate}
              onChange={(event) =>
                setValues((current) => ({ ...current, plannedDate: event.target.value }))
              }
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={uiClasses.label} htmlFor="plannedStartAt">
              Início planejado (opcional)
            </label>
            <input
              id="plannedStartAt"
              type="datetime-local"
              className={uiClasses.input}
              value={values.plannedStartAt}
              onChange={(event) =>
                setValues((current) => ({ ...current, plannedStartAt: event.target.value }))
              }
            />
          </div>
          <div>
            <label className={uiClasses.label} htmlFor="plannedEndAt">
              Fim planejado (opcional)
            </label>
            <input
              id="plannedEndAt"
              type="datetime-local"
              className={uiClasses.input}
              value={values.plannedEndAt}
              onChange={(event) =>
                setValues((current) => ({ ...current, plannedEndAt: event.target.value }))
              }
            />
          </div>
        </div>
      </div>

      <BlocksEditor
        blocks={values.blocks}
        modality={values.modality}
        exerciseOptions={exerciseOptions}
        onChange={(blocks) => setValues((current) => ({ ...current, blocks }))}
      />

      <button type="submit" className={uiClasses.button} disabled={submitting}>
        {submitting ? "Salvando..." : submitLabel}
      </button>
    </form>
  );
}
