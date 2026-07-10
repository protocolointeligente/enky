"use client";

import { useState } from "react";
import { uiClasses } from "@/app/_lib/ui";

// The single canonical prescription form — reused by the trainer's "novo
// treino" and "editar treino" pages. Never duplicate this shape elsewhere
// (calendar, templates, periodization all reuse this same component when
// they land in later phases).

const MODALITIES = ["RUNNING", "STRENGTH", "FUNCTIONAL", "CYCLING", "SWIMMING", "TRIATHLON"] as const;
const STEP_TYPES = ["TIRO", "RODAGEM", "PAUSA_ATIVA", "PAUSA_PASSIVA", "PROGRESSIVO", "SUBIDA"] as const;
const TARGET_TYPES = ["PACE", "HEART_RATE_ZONE", "POWER", "CADENCE", "RPE"] as const;

const STEP_MODALITIES = new Set(["RUNNING", "CYCLING", "SWIMMING", "TRIATHLON"]);

type Modality = (typeof MODALITIES)[number];

interface StepFormState {
  key: string;
  stepType: (typeof STEP_TYPES)[number];
  repetitions: string;
  durationSeconds: string;
  distanceMeters: string;
  targetType: (typeof TARGET_TYPES)[number] | "";
  targetMin: string;
  targetMax: string;
  recoverySeconds: string;
  recoveryMeters: string;
}

interface ExerciseFormState {
  key: string;
  exerciseName: string;
  exerciseCategory: string;
  sets: string;
  reps: string;
  durationSeconds: string;
  loadKg: string;
  rir: string;
  rpeTarget: string;
  restSeconds: string;
  notes: string;
}

interface BlockFormState {
  key: string;
  name: string;
  repetitions: string;
  steps: StepFormState[];
  exercises: ExerciseFormState[];
}

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

function newKey() {
  return Math.random().toString(36).slice(2);
}

function emptyStep(): StepFormState {
  return {
    key: newKey(),
    stepType: "RODAGEM",
    repetitions: "",
    durationSeconds: "",
    distanceMeters: "",
    targetType: "",
    targetMin: "",
    targetMax: "",
    recoverySeconds: "",
    recoveryMeters: "",
  };
}

function emptyExercise(): ExerciseFormState {
  return {
    key: newKey(),
    exerciseName: "",
    exerciseCategory: "geral",
    sets: "3",
    reps: "",
    durationSeconds: "",
    loadKg: "",
    rir: "",
    rpeTarget: "",
    restSeconds: "",
    notes: "",
  };
}

function emptyBlock(): BlockFormState {
  return { key: newKey(), name: "", repetitions: "1", steps: [], exercises: [] };
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

function toIntOrUndefined(value: string): number | undefined {
  if (value.trim() === "") return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function toFloatOrUndefined(value: string): number | undefined {
  if (value.trim() === "") return undefined;
  const parsed = Number.parseFloat(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

// Builds the exact JSON payload the create/update draft API routes expect
// (validated server-side by prescription-schema.ts). Sequence numbers are
// never included — the server derives them from array position.
export function buildPrescriptionPayload(values: WorkoutPrescriptionFormValues) {
  return {
    athleteId: values.athleteId,
    title: values.title,
    description: values.description.trim() === "" ? undefined : values.description,
    modality: values.modality,
    plannedDate: values.plannedDate,
    plannedStartAt: values.plannedStartAt === "" ? undefined : new Date(values.plannedStartAt).toISOString(),
    plannedEndAt: values.plannedEndAt === "" ? undefined : new Date(values.plannedEndAt).toISOString(),
    blocks: values.blocks.map((block) => ({
      name: block.name.trim() === "" ? undefined : block.name,
      repetitions: toIntOrUndefined(block.repetitions) ?? 1,
      steps: block.steps.map((step) => ({
        stepType: step.stepType,
        repetitions: toIntOrUndefined(step.repetitions),
        durationSeconds: toIntOrUndefined(step.durationSeconds),
        distanceMeters: toIntOrUndefined(step.distanceMeters),
        targetType: step.targetType === "" ? undefined : step.targetType,
        targetMin: toFloatOrUndefined(step.targetMin),
        targetMax: toFloatOrUndefined(step.targetMax),
        recoverySeconds: toIntOrUndefined(step.recoverySeconds),
        recoveryMeters: toIntOrUndefined(step.recoveryMeters),
      })),
      exercises: block.exercises.map((exercise) => ({
        exerciseName: exercise.exerciseName,
        exerciseCategory: exercise.exerciseCategory.trim() === "" ? "geral" : exercise.exerciseCategory,
        sets: toIntOrUndefined(exercise.sets) ?? 1,
        reps: toIntOrUndefined(exercise.reps),
        durationSeconds: toIntOrUndefined(exercise.durationSeconds),
        loadKg: toFloatOrUndefined(exercise.loadKg),
        rir: toIntOrUndefined(exercise.rir),
        rpeTarget: toFloatOrUndefined(exercise.rpeTarget),
        restSeconds: toIntOrUndefined(exercise.restSeconds),
        notes: exercise.notes.trim() === "" ? undefined : exercise.notes,
      })),
    })),
  };
}

interface WorkoutPrescriptionFormProps {
  athletes: AthleteOption[];
  initialValues: WorkoutPrescriptionFormValues;
  submitLabel: string;
  submitting: boolean;
  error: string | null;
  onSubmit: (values: WorkoutPrescriptionFormValues) => void;
}

export function WorkoutPrescriptionForm({
  athletes,
  initialValues,
  submitLabel,
  submitting,
  error,
  onSubmit,
}: WorkoutPrescriptionFormProps) {
  const [values, setValues] = useState<WorkoutPrescriptionFormValues>(initialValues);
  const usesSteps = STEP_MODALITIES.has(values.modality);

  function updateBlock(index: number, patch: Partial<BlockFormState>) {
    setValues((current) => ({
      ...current,
      blocks: current.blocks.map((block, blockIndex) => (blockIndex === index ? { ...block, ...patch } : block)),
    }));
  }

  function addBlock() {
    setValues((current) => ({ ...current, blocks: [...current.blocks, emptyBlock()] }));
  }

  function removeBlock(index: number) {
    setValues((current) => ({ ...current, blocks: current.blocks.filter((_, i) => i !== index) }));
  }

  function blockAt(index: number): BlockFormState {
    const block = values.blocks[index];
    if (!block) throw new Error(`Bloco ${index} não encontrado.`);
    return block;
  }

  function addStep(blockIndex: number) {
    updateBlock(blockIndex, { steps: [...blockAt(blockIndex).steps, emptyStep()] });
  }

  function updateStep(blockIndex: number, stepIndex: number, patch: Partial<StepFormState>) {
    const steps = blockAt(blockIndex).steps.map((step, i) => (i === stepIndex ? { ...step, ...patch } : step));
    updateBlock(blockIndex, { steps });
  }

  function removeStep(blockIndex: number, stepIndex: number) {
    updateBlock(blockIndex, { steps: blockAt(blockIndex).steps.filter((_, i) => i !== stepIndex) });
  }

  function addExercise(blockIndex: number) {
    updateBlock(blockIndex, { exercises: [...blockAt(blockIndex).exercises, emptyExercise()] });
  }

  function updateExercise(blockIndex: number, exerciseIndex: number, patch: Partial<ExerciseFormState>) {
    const exercises = blockAt(blockIndex).exercises.map((exercise, i) =>
      i === exerciseIndex ? { ...exercise, ...patch } : exercise,
    );
    updateBlock(blockIndex, { exercises });
  }

  function removeExercise(blockIndex: number, exerciseIndex: number) {
    updateBlock(blockIndex, { exercises: blockAt(blockIndex).exercises.filter((_, i) => i !== exerciseIndex) });
  }

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
            onChange={(event) => setValues((current) => ({ ...current, athleteId: event.target.value }))}
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
            onChange={(event) => setValues((current) => ({ ...current, title: event.target.value }))}
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
            onChange={(event) => setValues((current) => ({ ...current, description: event.target.value }))}
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
              onChange={(event) => setValues((current) => ({ ...current, plannedDate: event.target.value }))}
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
              onChange={(event) => setValues((current) => ({ ...current, plannedStartAt: event.target.value }))}
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
              onChange={(event) => setValues((current) => ({ ...current, plannedEndAt: event.target.value }))}
            />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {values.blocks.map((block, blockIndex) => (
          <div key={block.key} className={`${uiClasses.card} flex flex-col gap-4`}>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-100">Bloco {blockIndex + 1}</h3>
              {values.blocks.length > 1 && (
                <button
                  type="button"
                  className="text-sm text-red-400 hover:underline"
                  onClick={() => removeBlock(blockIndex)}
                >
                  Remover bloco
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={uiClasses.label}>Nome do bloco (opcional)</label>
                <input
                  className={uiClasses.input}
                  value={block.name}
                  onChange={(event) => updateBlock(blockIndex, { name: event.target.value })}
                />
              </div>
              <div>
                <label className={uiClasses.label}>Repetições do bloco</label>
                <input
                  type="number"
                  min={1}
                  className={uiClasses.input}
                  value={block.repetitions}
                  onChange={(event) => updateBlock(blockIndex, { repetitions: event.target.value })}
                />
              </div>
            </div>

            {usesSteps ? (
              <div className="flex flex-col gap-3">
                {block.steps.map((step, stepIndex) => (
                  <div key={step.key} className="rounded-lg border border-slate-800 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-sm text-slate-400">Tiro/passo {stepIndex + 1}</span>
                      <button
                        type="button"
                        className="text-xs text-red-400 hover:underline"
                        onClick={() => removeStep(blockIndex, stepIndex)}
                      >
                        Remover
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <select
                        className={uiClasses.select}
                        value={step.stepType}
                        onChange={(event) =>
                          updateStep(blockIndex, stepIndex, {
                            stepType: event.target.value as StepFormState["stepType"],
                          })
                        }
                      >
                        {STEP_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                      </select>
                      <input
                        placeholder="Repetições"
                        type="number"
                        className={uiClasses.input}
                        value={step.repetitions}
                        onChange={(event) => updateStep(blockIndex, stepIndex, { repetitions: event.target.value })}
                      />
                      <input
                        placeholder="Duração (s)"
                        type="number"
                        className={uiClasses.input}
                        value={step.durationSeconds}
                        onChange={(event) =>
                          updateStep(blockIndex, stepIndex, { durationSeconds: event.target.value })
                        }
                      />
                      <input
                        placeholder="Distância (m)"
                        type="number"
                        className={uiClasses.input}
                        value={step.distanceMeters}
                        onChange={(event) =>
                          updateStep(blockIndex, stepIndex, { distanceMeters: event.target.value })
                        }
                      />
                      <select
                        className={uiClasses.select}
                        value={step.targetType}
                        onChange={(event) =>
                          updateStep(blockIndex, stepIndex, {
                            targetType: event.target.value as StepFormState["targetType"],
                          })
                        }
                      >
                        <option value="">Alvo (opcional)</option>
                        {TARGET_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                      </select>
                      <input
                        placeholder="Alvo mín."
                        type="number"
                        className={uiClasses.input}
                        value={step.targetMin}
                        onChange={(event) => updateStep(blockIndex, stepIndex, { targetMin: event.target.value })}
                      />
                      <input
                        placeholder="Alvo máx."
                        type="number"
                        className={uiClasses.input}
                        value={step.targetMax}
                        onChange={(event) => updateStep(blockIndex, stepIndex, { targetMax: event.target.value })}
                      />
                      <input
                        placeholder="Recuperação (s)"
                        type="number"
                        className={uiClasses.input}
                        value={step.recoverySeconds}
                        onChange={(event) =>
                          updateStep(blockIndex, stepIndex, { recoverySeconds: event.target.value })
                        }
                      />
                      <input
                        placeholder="Recuperação (m)"
                        type="number"
                        className={uiClasses.input}
                        value={step.recoveryMeters}
                        onChange={(event) =>
                          updateStep(blockIndex, stepIndex, { recoveryMeters: event.target.value })
                        }
                      />
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  className={uiClasses.buttonSecondary}
                  onClick={() => addStep(blockIndex)}
                >
                  + Adicionar passo
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {block.exercises.map((exercise, exerciseIndex) => (
                  <div key={exercise.key} className="rounded-lg border border-slate-800 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-sm text-slate-400">Exercício {exerciseIndex + 1}</span>
                      <button
                        type="button"
                        className="text-xs text-red-400 hover:underline"
                        onClick={() => removeExercise(blockIndex, exerciseIndex)}
                      >
                        Remover
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <input
                        placeholder="Nome do exercício"
                        required
                        className={`${uiClasses.input} col-span-3`}
                        value={exercise.exerciseName}
                        onChange={(event) =>
                          updateExercise(blockIndex, exerciseIndex, { exerciseName: event.target.value })
                        }
                      />
                      <input
                        placeholder="Categoria"
                        className={uiClasses.input}
                        value={exercise.exerciseCategory}
                        onChange={(event) =>
                          updateExercise(blockIndex, exerciseIndex, { exerciseCategory: event.target.value })
                        }
                      />
                      <input
                        placeholder="Séries"
                        type="number"
                        className={uiClasses.input}
                        value={exercise.sets}
                        onChange={(event) => updateExercise(blockIndex, exerciseIndex, { sets: event.target.value })}
                      />
                      <input
                        placeholder="Repetições"
                        type="number"
                        className={uiClasses.input}
                        value={exercise.reps}
                        onChange={(event) => updateExercise(blockIndex, exerciseIndex, { reps: event.target.value })}
                      />
                      <input
                        placeholder="Duração (s)"
                        type="number"
                        className={uiClasses.input}
                        value={exercise.durationSeconds}
                        onChange={(event) =>
                          updateExercise(blockIndex, exerciseIndex, { durationSeconds: event.target.value })
                        }
                      />
                      <input
                        placeholder="Carga (kg)"
                        type="number"
                        className={uiClasses.input}
                        value={exercise.loadKg}
                        onChange={(event) =>
                          updateExercise(blockIndex, exerciseIndex, { loadKg: event.target.value })
                        }
                      />
                      <input
                        placeholder="RIR"
                        type="number"
                        className={uiClasses.input}
                        value={exercise.rir}
                        onChange={(event) => updateExercise(blockIndex, exerciseIndex, { rir: event.target.value })}
                      />
                      <input
                        placeholder="RPE alvo"
                        type="number"
                        className={uiClasses.input}
                        value={exercise.rpeTarget}
                        onChange={(event) =>
                          updateExercise(blockIndex, exerciseIndex, { rpeTarget: event.target.value })
                        }
                      />
                      <input
                        placeholder="Descanso (s)"
                        type="number"
                        className={uiClasses.input}
                        value={exercise.restSeconds}
                        onChange={(event) =>
                          updateExercise(blockIndex, exerciseIndex, { restSeconds: event.target.value })
                        }
                      />
                      <input
                        placeholder="Notas"
                        className={`${uiClasses.input} col-span-3`}
                        value={exercise.notes}
                        onChange={(event) =>
                          updateExercise(blockIndex, exerciseIndex, { notes: event.target.value })
                        }
                      />
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  className={uiClasses.buttonSecondary}
                  onClick={() => addExercise(blockIndex)}
                >
                  + Adicionar exercício
                </button>
              </div>
            )}
          </div>
        ))}
        <button type="button" className={uiClasses.buttonSecondary} onClick={addBlock}>
          + Adicionar bloco
        </button>
      </div>

      <button type="submit" className={uiClasses.button} disabled={submitting}>
        {submitting ? "Salvando..." : submitLabel}
      </button>
    </form>
  );
}
