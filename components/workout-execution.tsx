"use client";

import { useMemo, useState } from "react";
import { stepTypeLabel } from "@/app/_lib/labels";
import { uiClasses } from "@/app/_lib/ui";
import { CheckIcon } from "@/components/ui/icons";
import type { BlockView, ExerciseView, StepView } from "@/components/workout-blocks-view";

// Ephemeral "execution mode": the athlete ticks off steps/exercises as they go,
// purely client-side (nothing is persisted step-by-step — that would need a
// schema change deferred to after Preview/Prod isolation). The real outcome is
// captured by the existing feedback flow when they finish or abandon.
function stepLine(step: StepView): string {
  const parts = [stepTypeLabel(step.stepType)];
  if (step.repetitions) parts.push(`× ${step.repetitions}`);
  if (step.durationSeconds) parts.push(`${step.durationSeconds}s`);
  if (step.distanceMeters) parts.push(`${step.distanceMeters}m`);
  if (step.targetType)
    parts.push(`${step.targetType} ${step.targetMin ?? ""}-${step.targetMax ?? ""}`);
  return parts.join(" · ");
}

function exerciseLine(exercise: ExerciseView): string {
  const parts = [`${exercise.exercise.name} · ${exercise.sets}×${exercise.reps ?? "—"}`];
  if (exercise.loadKg) parts.push(`${exercise.loadKg}kg`);
  if (exercise.rpeTarget) parts.push(`RPE ${exercise.rpeTarget}`);
  return parts.join(" · ");
}

interface Group {
  name: string;
  items: { key: string; label: string }[];
}

export function WorkoutExecution({
  blocks,
  onFinish,
  onAbandon,
}: {
  blocks: BlockView[];
  onFinish: (status: "COMPLETED" | "PARTIAL") => void;
  onAbandon: () => void;
}) {
  const groups = useMemo<Group[]>(
    () =>
      blocks.map((block, bi) => ({
        name: block.name || `Bloco ${block.sequence ?? bi + 1}`,
        items: [
          ...block.steps.map((step, i) => ({ key: `${bi}-s-${i}`, label: stepLine(step) })),
          ...block.exercises.map((ex, i) => ({ key: `${bi}-e-${i}`, label: exerciseLine(ex) })),
        ],
      })),
    [blocks],
  );
  const total = groups.reduce((n, g) => n + g.items.length, 0);
  const [done, setDone] = useState<Set<string>>(new Set());

  function toggle(key: string) {
    setDone((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const pct = total ? Math.round((done.size / total) * 100) : 0;

  return (
    <div className="flex flex-col gap-4 pb-24">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className={uiClasses.subheading}>Treino em andamento</h2>
          <span className="tabular text-sm text-muted">
            {done.size}/{total}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-surface">
          <div
            className="h-full rounded-full bg-turq transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {groups.map((group, gi) => (
        <div key={gi} className="rounded-xl border border-line bg-petrol/60 p-3">
          <h3 className="mb-2 font-display text-sm font-semibold text-ink">{group.name}</h3>
          <ul className="flex flex-col gap-1.5">
            {group.items.map((item) => {
              const checked = done.has(item.key);
              return (
                <li key={item.key}>
                  <button
                    type="button"
                    aria-pressed={checked}
                    onClick={() => toggle(item.key)}
                    className={`flex w-full items-center gap-3 rounded-lg border px-3 py-3 text-left transition-colors ${
                      checked
                        ? "border-turq/40 bg-turq/10 text-muted line-through"
                        : "border-line bg-surface text-ink hover:bg-surface-2"
                    }`}
                  >
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border ${
                        checked ? "border-turq bg-turq text-deep" : "border-line-strong"
                      }`}
                    >
                      {checked && <CheckIcon width={16} height={16} />}
                    </span>
                    <span className="text-sm">{item.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}

      {/* Ações fixas ao alcance do polegar */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-petrol/95 p-3 backdrop-blur sm:bottom-0">
        <div className="mx-auto flex max-w-3xl gap-2">
          <button type="button" className={`${uiClasses.buttonGhost} flex-1`} onClick={onAbandon}>
            Abandonar
          </button>
          <button
            type="button"
            className={`${uiClasses.button} flex-[2]`}
            onClick={() => onFinish(done.size >= total && total > 0 ? "COMPLETED" : "PARTIAL")}
          >
            Concluir treino
          </button>
        </div>
      </div>
    </div>
  );
}
