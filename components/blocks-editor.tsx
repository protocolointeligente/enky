"use client";

import { stepTypeLabel } from "@/app/_lib/labels";
import { uiClasses } from "@/app/_lib/ui";

// The single canonical block/step/exercise editor. Reused by the workout
// prescription form AND the workout-template form so the two never drift.
// Steps (running/cycling/swimming/triathlon) vs. exercises (strength/functional)
// are chosen by modality, exactly as the prescription schema expects. Intensity
// is modality-aware: pace/FC for running, power for cycling, load/RIR/RPE for
// strength — all mapped onto the existing IntensityTargetType enum (no schema
// change; VDOT resolves to pace, VO2 would need a new field / migration).

export const MODALITIES = [
  "RUNNING",
  "STRENGTH",
  "FUNCTIONAL",
  "CYCLING",
  "SWIMMING",
  "TRIATHLON",
] as const;
export type Modality = (typeof MODALITIES)[number];

const STEP_TYPES = [
  "TIRO",
  "RODAGEM",
  "PAUSA_ATIVA",
  "PAUSA_PASSIVA",
  "PROGRESSIVO",
  "SUBIDA",
] as const;
type TargetType = "PACE" | "HEART_RATE_ZONE" | "POWER" | "CADENCE" | "RPE";
const STEP_MODALITIES = new Set<Modality>(["RUNNING", "CYCLING", "SWIMMING", "TRIATHLON"]);

// Which intensity targets make sense per endurance modality, and the human
// label + unit shown for the min/max range.
const INTENSITY_BY_MODALITY: Record<Modality, TargetType[]> = {
  RUNNING: ["PACE", "HEART_RATE_ZONE", "RPE"],
  SWIMMING: ["PACE", "HEART_RATE_ZONE", "RPE"],
  CYCLING: ["POWER", "HEART_RATE_ZONE", "CADENCE", "RPE"],
  TRIATHLON: ["PACE", "POWER", "HEART_RATE_ZONE", "CADENCE", "RPE"],
  STRENGTH: [],
  FUNCTIONAL: [],
};

const INTENSITY_LABEL: Record<TargetType, string> = {
  PACE: "Pace",
  HEART_RATE_ZONE: "FC / zona",
  POWER: "Potência",
  CADENCE: "Cadência",
  RPE: "RPE",
};

const INTENSITY_UNIT: Record<TargetType, string> = {
  PACE: "min/km",
  HEART_RATE_ZONE: "bpm",
  POWER: "W",
  CADENCE: "spm",
  RPE: "1-10",
};

export function modalityUsesSteps(modality: Modality): boolean {
  return STEP_MODALITIES.has(modality);
}

function defaultTargetForModality(modality: Modality): TargetType | "" {
  return INTENSITY_BY_MODALITY[modality][0] ?? "";
}

export interface StepFormState {
  key: string;
  stepType: (typeof STEP_TYPES)[number];
  repetitions: string;
  durationSeconds: string;
  distanceMeters: string;
  targetType: TargetType | "";
  targetMin: string;
  targetMax: string;
  recoverySeconds: string;
  recoveryMeters: string;
}

export interface ExerciseFormState {
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

export interface BlockFormState {
  key: string;
  name: string;
  repetitions: string;
  steps: StepFormState[];
  exercises: ExerciseFormState[];
}

export interface ExerciseOption {
  name: string;
  category: string;
}

export function newKey(): string {
  return Math.random().toString(36).slice(2);
}

export function emptyStep(): StepFormState {
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

export function emptyExercise(): ExerciseFormState {
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

export function emptyBlock(): BlockFormState {
  return { key: newKey(), name: "", repetitions: "1", steps: [], exercises: [] };
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

// Serializes the editor state into the canonical block payload the prescription
// and template schemas validate. Sequence is derived server-side from order.
export function buildBlocksPayload(blocks: BlockFormState[]) {
  return blocks.map((block) => ({
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
      exerciseCategory:
        exercise.exerciseCategory.trim() === "" ? "geral" : exercise.exerciseCategory,
      sets: toIntOrUndefined(exercise.sets) ?? 1,
      reps: toIntOrUndefined(exercise.reps),
      durationSeconds: toIntOrUndefined(exercise.durationSeconds),
      loadKg: toFloatOrUndefined(exercise.loadKg),
      rir: toIntOrUndefined(exercise.rir),
      rpeTarget: toFloatOrUndefined(exercise.rpeTarget),
      restSeconds: toIntOrUndefined(exercise.restSeconds),
      notes: exercise.notes.trim() === "" ? undefined : exercise.notes,
    })),
  }));
}

// Loose shape of a canonical block payload (as stored in a template's
// contentSnapshot) — used to rehydrate the editor state for editing.
export interface BlockInputLike {
  name?: string | null;
  repetitions?: number | null;
  steps?: Array<{
    stepType: string;
    repetitions?: number | null;
    durationSeconds?: number | null;
    distanceMeters?: number | null;
    targetType?: string | null;
    targetMin?: number | null;
    targetMax?: number | null;
    recoverySeconds?: number | null;
    recoveryMeters?: number | null;
  }>;
  exercises?: Array<{
    exerciseName: string;
    exerciseCategory?: string | null;
    sets?: number | null;
    reps?: number | null;
    durationSeconds?: number | null;
    loadKg?: number | null;
    rir?: number | null;
    rpeTarget?: number | null;
    restSeconds?: number | null;
    notes?: string | null;
  }>;
}

function toStr(value: number | null | undefined): string {
  return value == null ? "" : String(value);
}

export function blocksInputToState(blocks: BlockInputLike[]): BlockFormState[] {
  return blocks.map((block) => ({
    key: newKey(),
    name: block.name ?? "",
    repetitions: toStr(block.repetitions ?? 1),
    steps: (block.steps ?? []).map((step) => ({
      key: newKey(),
      stepType: step.stepType as StepFormState["stepType"],
      repetitions: toStr(step.repetitions),
      durationSeconds: toStr(step.durationSeconds),
      distanceMeters: toStr(step.distanceMeters),
      targetType: (step.targetType ?? "") as StepFormState["targetType"],
      targetMin: toStr(step.targetMin),
      targetMax: toStr(step.targetMax),
      recoverySeconds: toStr(step.recoverySeconds),
      recoveryMeters: toStr(step.recoveryMeters),
    })),
    exercises: (block.exercises ?? []).map((exercise) => ({
      key: newKey(),
      exerciseName: exercise.exerciseName,
      exerciseCategory: exercise.exerciseCategory ?? "geral",
      sets: toStr(exercise.sets ?? 1),
      reps: toStr(exercise.reps),
      durationSeconds: toStr(exercise.durationSeconds),
      loadKg: toStr(exercise.loadKg),
      rir: toStr(exercise.rir),
      rpeTarget: toStr(exercise.rpeTarget),
      restSeconds: toStr(exercise.restSeconds),
      notes: exercise.notes ?? "",
    })),
  }));
}

interface BlocksEditorProps {
  blocks: BlockFormState[];
  modality: Modality;
  onChange: (blocks: BlockFormState[]) => void;
  exerciseOptions?: ExerciseOption[];
}

const fieldLabel = "mb-1 block text-[11px] font-medium text-faint";
const removeBtn = "text-xs font-medium text-danger hover:underline";

export function BlocksEditor({
  blocks,
  modality,
  onChange,
  exerciseOptions = [],
}: BlocksEditorProps) {
  const usesSteps = modalityUsesSteps(modality);
  const intensityOptions = INTENSITY_BY_MODALITY[modality];
  const optionByName = new Map(exerciseOptions.map((o) => [o.name.toLowerCase(), o]));

  function updateBlock(index: number, patch: Partial<BlockFormState>) {
    onChange(blocks.map((block, i) => (i === index ? { ...block, ...patch } : block)));
  }
  function blockAt(index: number): BlockFormState {
    const block = blocks[index];
    if (!block) throw new Error(`Bloco ${index} não encontrado.`);
    return block;
  }
  function addStep(blockIndex: number) {
    // Seed the intensity target with the modality's primary metric so the
    // trainer starts from pace (running/swim) or power (cycling) etc.
    const step = { ...emptyStep(), targetType: defaultTargetForModality(modality) };
    updateBlock(blockIndex, { steps: [...blockAt(blockIndex).steps, step] });
  }
  function updateStep(blockIndex: number, stepIndex: number, patch: Partial<StepFormState>) {
    updateBlock(blockIndex, {
      steps: blockAt(blockIndex).steps.map((step, i) =>
        i === stepIndex ? { ...step, ...patch } : step,
      ),
    });
  }
  function removeStep(blockIndex: number, stepIndex: number) {
    updateBlock(blockIndex, { steps: blockAt(blockIndex).steps.filter((_, i) => i !== stepIndex) });
  }
  function addExercise(blockIndex: number) {
    updateBlock(blockIndex, { exercises: [...blockAt(blockIndex).exercises, emptyExercise()] });
  }
  function updateExercise(
    blockIndex: number,
    exerciseIndex: number,
    patch: Partial<ExerciseFormState>,
  ) {
    updateBlock(blockIndex, {
      exercises: blockAt(blockIndex).exercises.map((exercise, i) =>
        i === exerciseIndex ? { ...exercise, ...patch } : exercise,
      ),
    });
  }
  function removeExercise(blockIndex: number, exerciseIndex: number) {
    updateBlock(blockIndex, {
      exercises: blockAt(blockIndex).exercises.filter((_, i) => i !== exerciseIndex),
    });
  }
  // Picking a library exercise by name autofills its category; free-typing a
  // name the library doesn't know is still allowed (§6).
  function onExerciseNameChange(blockIndex: number, exerciseIndex: number, name: string) {
    const match = optionByName.get(name.trim().toLowerCase());
    updateExercise(
      blockIndex,
      exerciseIndex,
      match ? { exerciseName: name, exerciseCategory: match.category } : { exerciseName: name },
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {exerciseOptions.length > 0 && (
        <datalist id="exercise-library">
          {exerciseOptions.map((o) => (
            <option key={o.name} value={o.name} />
          ))}
        </datalist>
      )}

      {blocks.map((block, blockIndex) => (
        <div key={block.key} className="rounded-xl border border-line bg-petrol/60 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-display text-sm font-semibold text-ink">Bloco {blockIndex + 1}</h3>
            {blocks.length > 1 && (
              <button
                type="button"
                className={removeBtn}
                onClick={() => onChange(blocks.filter((_, i) => i !== blockIndex))}
              >
                Remover bloco
              </button>
            )}
          </div>

          <div className="mb-3 grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <label className={fieldLabel}>Nome do bloco (opcional)</label>
              <input
                className={uiClasses.input}
                value={block.name}
                onChange={(e) => updateBlock(blockIndex, { name: e.target.value })}
              />
            </div>
            <div>
              <label className={fieldLabel}>Repetir bloco</label>
              <input
                type="number"
                min={1}
                className={uiClasses.input}
                value={block.repetitions}
                onChange={(e) => updateBlock(blockIndex, { repetitions: e.target.value })}
              />
            </div>
          </div>

          {usesSteps ? (
            <div className="flex flex-col gap-3">
              {block.steps.map((step, stepIndex) => {
                const unit = step.targetType ? INTENSITY_UNIT[step.targetType] : "";
                return (
                  <div key={step.key} className="rounded-lg border border-line bg-deep/40 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs font-semibold text-muted">
                        Passo {stepIndex + 1}
                      </span>
                      <button
                        type="button"
                        className={removeBtn}
                        onClick={() => removeStep(blockIndex, stepIndex)}
                      >
                        Remover
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <div>
                        <label className={fieldLabel}>Tipo</label>
                        <select
                          className={uiClasses.select}
                          value={step.stepType}
                          onChange={(e) =>
                            updateStep(blockIndex, stepIndex, {
                              stepType: e.target.value as StepFormState["stepType"],
                            })
                          }
                        >
                          {STEP_TYPES.map((type) => (
                            <option key={type} value={type}>
                              {stepTypeLabel(type)}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className={fieldLabel}>Repetições</label>
                        <input
                          type="number"
                          className={uiClasses.input}
                          value={step.repetitions}
                          onChange={(e) =>
                            updateStep(blockIndex, stepIndex, { repetitions: e.target.value })
                          }
                        />
                      </div>
                      <div>
                        <label className={fieldLabel}>Duração</label>
                        <input
                          placeholder="Duração (s)"
                          type="number"
                          className={uiClasses.input}
                          value={step.durationSeconds}
                          onChange={(e) =>
                            updateStep(blockIndex, stepIndex, { durationSeconds: e.target.value })
                          }
                        />
                      </div>
                      <div>
                        <label className={fieldLabel}>Distância (m)</label>
                        <input
                          type="number"
                          className={uiClasses.input}
                          value={step.distanceMeters}
                          onChange={(e) =>
                            updateStep(blockIndex, stepIndex, { distanceMeters: e.target.value })
                          }
                        />
                      </div>
                    </div>

                    {/* Intensidade — alvos por modalidade */}
                    <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <div>
                        <label className={fieldLabel}>Intensidade</label>
                        <select
                          className={uiClasses.select}
                          value={step.targetType}
                          onChange={(e) =>
                            updateStep(blockIndex, stepIndex, {
                              targetType: e.target.value as StepFormState["targetType"],
                            })
                          }
                        >
                          <option value="">Sem alvo</option>
                          {intensityOptions.map((type) => (
                            <option key={type} value={type}>
                              {INTENSITY_LABEL[type]}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className={fieldLabel}>Alvo mín. {unit && `(${unit})`}</label>
                        <input
                          type="number"
                          className={uiClasses.input}
                          value={step.targetMin}
                          disabled={step.targetType === ""}
                          onChange={(e) =>
                            updateStep(blockIndex, stepIndex, { targetMin: e.target.value })
                          }
                        />
                      </div>
                      <div>
                        <label className={fieldLabel}>Alvo máx. {unit && `(${unit})`}</label>
                        <input
                          type="number"
                          className={uiClasses.input}
                          value={step.targetMax}
                          disabled={step.targetType === ""}
                          onChange={(e) =>
                            updateStep(blockIndex, stepIndex, { targetMax: e.target.value })
                          }
                        />
                      </div>
                      <div>
                        <label className={fieldLabel}>Recuperação (s)</label>
                        <input
                          type="number"
                          className={uiClasses.input}
                          value={step.recoverySeconds}
                          onChange={(e) =>
                            updateStep(blockIndex, stepIndex, { recoverySeconds: e.target.value })
                          }
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
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
                <div key={exercise.key} className="rounded-lg border border-line bg-deep/40 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted">
                      Exercício {exerciseIndex + 1}
                    </span>
                    <button
                      type="button"
                      className={removeBtn}
                      onClick={() => removeExercise(blockIndex, exerciseIndex)}
                    >
                      Remover
                    </button>
                  </div>
                  <div className="mb-2 grid grid-cols-3 gap-2">
                    <div className="col-span-2">
                      <label className={fieldLabel}>Exercício</label>
                      <input
                        placeholder="Busque na biblioteca ou digite"
                        list="exercise-library"
                        required
                        className={uiClasses.input}
                        value={exercise.exerciseName}
                        onChange={(e) =>
                          onExerciseNameChange(blockIndex, exerciseIndex, e.target.value)
                        }
                      />
                    </div>
                    <div>
                      <label className={fieldLabel}>Categoria</label>
                      <input
                        className={uiClasses.input}
                        value={exercise.exerciseCategory}
                        onChange={(e) =>
                          updateExercise(blockIndex, exerciseIndex, {
                            exerciseCategory: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                    <div>
                      <label className={fieldLabel}>Séries</label>
                      <input
                        type="number"
                        className={uiClasses.input}
                        value={exercise.sets}
                        onChange={(e) =>
                          updateExercise(blockIndex, exerciseIndex, { sets: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <label className={fieldLabel}>Reps</label>
                      <input
                        type="number"
                        className={uiClasses.input}
                        value={exercise.reps}
                        onChange={(e) =>
                          updateExercise(blockIndex, exerciseIndex, { reps: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <label className={fieldLabel}>Carga (kg)</label>
                      <input
                        type="number"
                        className={uiClasses.input}
                        value={exercise.loadKg}
                        onChange={(e) =>
                          updateExercise(blockIndex, exerciseIndex, { loadKg: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <label className={fieldLabel}>RIR</label>
                      <input
                        type="number"
                        className={uiClasses.input}
                        value={exercise.rir}
                        onChange={(e) =>
                          updateExercise(blockIndex, exerciseIndex, { rir: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <label className={fieldLabel}>RPE</label>
                      <input
                        type="number"
                        className={uiClasses.input}
                        value={exercise.rpeTarget}
                        onChange={(e) =>
                          updateExercise(blockIndex, exerciseIndex, { rpeTarget: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <label className={fieldLabel}>Descanso (s)</label>
                      <input
                        type="number"
                        className={uiClasses.input}
                        value={exercise.restSeconds}
                        onChange={(e) =>
                          updateExercise(blockIndex, exerciseIndex, { restSeconds: e.target.value })
                        }
                      />
                    </div>
                  </div>

                  <div className="mt-2">
                    <label className={fieldLabel}>Notas / instruções</label>
                    <input
                      className={uiClasses.input}
                      value={exercise.notes}
                      onChange={(e) =>
                        updateExercise(blockIndex, exerciseIndex, { notes: e.target.value })
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
      <button
        type="button"
        className={uiClasses.buttonSecondary}
        onClick={() => onChange([...blocks, emptyBlock()])}
      >
        + Adicionar bloco
      </button>
    </div>
  );
}
