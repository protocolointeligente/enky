"use client";

import { useEffect, useMemo, useState } from "react";
import { uiClasses } from "@/app/_lib/ui";
import type { EventPayload } from "@/app/atleta/_lib/execution-client";
import { ExerciseDemo } from "@/components/exercise-demo";
import { CheckIcon } from "@/components/ui/icons";
import { useCountdown, useExecutionTimer } from "@/components/use-execution-timer";
import type { BlockView, ExerciseView } from "@/components/workout-blocks-view";
import { formatDuration, type ExecEvent } from "@/modules/workout-execution/execution-state";

const DEFAULT_REST_SECONDS = 90;

interface SetRow {
  key: string;
  blockIndex: number;
  exerciseIndex: number;
  setIndex: number; // 0-based
  restSeconds: number;
}

interface ExerciseGroup {
  key: string;
  name: string;
  demo?: { name: string; url: string };
  planned: string; // resumo "3×10 · 40kg · RIR 2"
  restSeconds: number;
  sets: SetRow[];
  plannedReps: string;
  plannedLoadKg: string;
  plannedRir: string;
}

interface SetInput {
  done: boolean;
  reps: string;
  loadKg: string;
  rir: string;
}

function plannedSummary(ex: ExerciseView): string {
  const parts = [`${ex.sets}×${ex.reps ?? "—"}`];
  if (ex.loadKg) parts.push(`${ex.loadKg}kg`);
  if (ex.rir != null) parts.push(`RIR ${ex.rir}`);
  if (ex.restSeconds) parts.push(`desc. ${ex.restSeconds}s`);
  return parts.join(" · ");
}

function num(value: string): number | undefined {
  const n = Number(value);
  return value.trim() !== "" && Number.isFinite(n) ? n : undefined;
}

export function StrengthExecution({
  blocks,
  timerEvents,
  onSetComplete,
  onFinish,
  onAbandon,
}: {
  blocks: BlockView[];
  timerEvents?: ExecEvent[];
  onSetComplete?: (payload: EventPayload) => void;
  onFinish: (status: "COMPLETED" | "PARTIAL") => void;
  onAbandon: () => void;
}) {
  const groups = useMemo<ExerciseGroup[]>(() => {
    const out: ExerciseGroup[] = [];
    blocks.forEach((block, bi) => {
      block.exercises.forEach((ex, ei) => {
        const rest = ex.restSeconds || DEFAULT_REST_SECONDS;
        out.push({
          key: `${bi}-${ei}`,
          name: ex.exercise.name,
          demo: ex.exercise.videoUrl ? { name: ex.exercise.name, url: ex.exercise.videoUrl } : undefined,
          planned: plannedSummary(ex),
          restSeconds: rest,
          plannedReps: ex.reps != null ? String(ex.reps) : "",
          plannedLoadKg: ex.loadKg ?? "",
          plannedRir: ex.rir != null ? String(ex.rir) : "",
          sets: Array.from({ length: Math.max(1, ex.sets) }, (_, si) => ({
            key: `${bi}-${ei}-${si}`,
            blockIndex: bi,
            exerciseIndex: ei,
            setIndex: si,
            restSeconds: rest,
          })),
        });
      });
    });
    return out;
  }, [blocks]);

  const allSets = useMemo(() => groups.flatMap((g) => g.sets), [groups]);
  const total = allSets.length;

  const [inputs, setInputs] = useState<Record<string, SetInput>>({});
  const [restEndsAt, setRestEndsAt] = useState<number | null>(null);
  const [restPaused, setRestPaused] = useState<number | null>(null); // segundos restantes quando pausado

  const timer = useExecutionTimer(timerEvents ?? [], Boolean(timerEvents));
  const restRemaining = useCountdown(restEndsAt);

  const doneCount = Object.values(inputs).filter((i) => i.done).length;

  // Fim do descanso: avisa (vibração, se permitido) e limpa.
  useEffect(() => {
    if (restEndsAt !== null && restRemaining === 0) {
      if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(200);
      setRestEndsAt(null);
    }
  }, [restEndsAt, restRemaining]);

  function inputFor(group: ExerciseGroup, key: string): SetInput {
    return inputs[key] ?? { done: false, reps: group.plannedReps, loadKg: group.plannedLoadKg, rir: group.plannedRir };
  }

  function patchInput(group: ExerciseGroup, key: string, patch: Partial<SetInput>) {
    setInputs((prev) => ({ ...prev, [key]: { ...inputFor(group, key), ...patch } }));
  }

  function completeSet(group: ExerciseGroup, set: SetRow) {
    const current = inputFor(group, set.key);
    patchInput(group, set.key, { done: true });
    onSetComplete?.(
      dropUndefined({
        blockIndex: set.blockIndex,
        exerciseIndex: set.exerciseIndex,
        setIndex: set.setIndex,
        actualReps: num(current.reps),
        actualLoadKg: num(current.loadKg),
        actualRir: num(current.rir),
      }),
    );
    // Inicia o descanso, a menos que tenha sido a última série do treino.
    if (doneCount + 1 < total) {
      setRestPaused(null);
      setRestEndsAt(Date.now() + set.restSeconds * 1000);
    }
  }

  function addRest(seconds: number) {
    setRestEndsAt((prev) => (prev === null ? prev : prev + seconds * 1000));
  }
  function toggleRestPause() {
    if (restPaused === null) {
      setRestPaused(restRemaining);
      setRestEndsAt(null);
    } else {
      setRestEndsAt(Date.now() + restPaused * 1000);
      setRestPaused(null);
    }
  }
  function skipRest() {
    setRestEndsAt(null);
    setRestPaused(null);
  }

  const resting = restEndsAt !== null || restPaused !== null;
  const restShown = restPaused ?? restRemaining;

  return (
    <div className="flex flex-col gap-4 pb-40">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className={uiClasses.subheading}>Treino em andamento</h2>
          <div className="flex items-center gap-3">
            {timerEvents && (
              <span className="tabular text-sm font-semibold text-turq" aria-label="Tempo decorrido">
                {formatDuration(timer.elapsedSeconds)}
              </span>
            )}
            <span className="tabular text-sm text-muted">
              {doneCount}/{total}
            </span>
          </div>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-surface">
          <div
            className="h-full rounded-full bg-turq transition-all"
            style={{ width: `${total ? Math.round((doneCount / total) * 100) : 0}%` }}
          />
        </div>
      </div>

      {groups.map((group) => (
        <div key={group.key} className="rounded-xl border border-line bg-petrol/60 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate font-display text-sm font-semibold text-ink">{group.name}</h3>
              <p className="text-xs text-muted">{group.planned}</p>
            </div>
            {group.demo && <ExerciseDemo name={group.demo.name} url={group.demo.url} size="sm" />}
          </div>

          <ul className="flex flex-col gap-1.5">
            {group.sets.map((set) => {
              const value = inputFor(group, set.key);
              return (
                <li
                  key={set.key}
                  className={`flex items-center gap-2 rounded-lg border p-2 ${
                    value.done ? "border-turq/40 bg-turq/10" : "border-line bg-surface"
                  }`}
                >
                  <span className="tabular w-14 shrink-0 text-xs text-muted">
                    Série {set.setIndex + 1}
                  </span>
                  <NumberField
                    label="reps"
                    value={value.reps}
                    disabled={value.done}
                    onChange={(v) => patchInput(group, set.key, { reps: v })}
                  />
                  <NumberField
                    label="kg"
                    value={value.loadKg}
                    disabled={value.done}
                    onChange={(v) => patchInput(group, set.key, { loadKg: v })}
                  />
                  <NumberField
                    label="RIR"
                    value={value.rir}
                    disabled={value.done}
                    onChange={(v) => patchInput(group, set.key, { rir: v })}
                  />
                  <button
                    type="button"
                    aria-label={value.done ? `Série ${set.setIndex + 1} concluída` : `Concluir série ${set.setIndex + 1}`}
                    aria-pressed={value.done}
                    disabled={value.done}
                    onClick={() => completeSet(group, set)}
                    className={`ml-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-md border ${
                      value.done ? "border-turq bg-turq text-onbrand" : "border-line-strong text-ink hover:bg-surface-2"
                    }`}
                  >
                    <CheckIcon width={18} height={18} />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}

      {/* Painel de descanso — sobrepõe as ações, ao alcance do polegar */}
      {resting && (
        <div className="fixed inset-x-0 bottom-16 z-20 border-t border-line bg-petrol/95 p-3 backdrop-blur">
          <div className="mx-auto flex max-w-3xl items-center gap-3">
            <div className="flex flex-col">
              <span className="text-xs text-muted">Descanso</span>
              <span className="tabular text-2xl font-semibold text-turq" aria-live="polite">
                {formatDuration(restShown)}
              </span>
            </div>
            <div className="ml-auto flex gap-2">
              <button type="button" className={uiClasses.buttonSecondary} onClick={() => addRest(15)}>
                +15s
              </button>
              <button type="button" className={uiClasses.buttonSecondary} onClick={toggleRestPause}>
                {restPaused === null ? "Pausar" : "Retomar"}
              </button>
              <button type="button" className={uiClasses.buttonGhost} onClick={skipRest}>
                Pular
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-petrol/95 p-3 backdrop-blur">
        <div className="mx-auto flex max-w-3xl gap-2">
          <button type="button" className={`${uiClasses.buttonGhost} flex-1`} onClick={onAbandon}>
            Abandonar
          </button>
          <button
            type="button"
            className={`${uiClasses.button} flex-[2]`}
            onClick={() => onFinish(doneCount >= total && total > 0 ? "COMPLETED" : "PARTIAL")}
          >
            Concluir treino
          </button>
        </div>
      </div>
    </div>
  );
}

function NumberField({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex flex-col items-center">
      <input
        type="text"
        inputMode="decimal"
        aria-label={label}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="tabular w-12 rounded-md border border-line bg-surface px-1 py-1.5 text-center text-sm text-ink disabled:opacity-60"
      />
      <span className="text-[10px] text-faint">{label}</span>
    </label>
  );
}

function dropUndefined(payload: EventPayload): EventPayload {
  return Object.fromEntries(Object.entries(payload).filter(([, v]) => v !== undefined));
}
