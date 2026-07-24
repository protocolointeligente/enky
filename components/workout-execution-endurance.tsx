"use client";

import { useMemo, useState } from "react";
import { stepTypeLabel } from "@/app/_lib/labels";
import { uiClasses } from "@/app/_lib/ui";
import { CheckIcon } from "@/components/ui/icons";
import { ExerciseDemo } from "@/components/exercise-demo";
import { useExecutionTimer } from "@/components/use-execution-timer";
import type { BlockView } from "@/components/workout-blocks-view";
import { formatTarget, formatVolume, type ExecModality } from "@/modules/workout-execution/format-target";
import { formatDuration, type ExecEvent } from "@/modules/workout-execution/execution-state";

// Execução específica de endurance (corrida/ciclismo/natação, §15). Renderiza
// cada passo com volume + alvo formatados PELA MODALIDADE (pace mm:ss /km ou
// /100m, watts, rpm, zona de FC), passos de intervalo agrupados por repetição do
// bloco. Reutiliza a mesma infra offline-first (onStepComplete → recordEvent) e o
// mesmo cronômetro/ações da execução genérica — só a apresentação muda.

interface Item {
  key: string;
  blockIndex: number;
  stepIndex: number;
  kind: "step" | "exercise";
  typeLabel: string;
  volume: string | null;
  target: string | null;
  reps: number | null;
  fallback?: string;
  demo?: { name: string; url: string };
}

interface Group {
  name: string;
  blockReps: number;
  items: Item[];
}

const MODALITY_HINT: Record<ExecModality, string> = {
  RUNNING: "Toque em cada trecho ao concluir. Mantenha o pace-alvo.",
  CYCLING: "Toque em cada bloco ao concluir. Segure a potência/cadência-alvo.",
  SWIMMING: "Toque em cada série ao concluir. Respeite o intervalo.",
};

export function EnduranceExecution({
  blocks,
  modality,
  onFinish,
  onAbandon,
  timerEvents,
  onStepComplete,
}: {
  blocks: BlockView[];
  modality: ExecModality;
  onFinish: (status: "COMPLETED" | "PARTIAL") => void;
  onAbandon: () => void;
  timerEvents?: ExecEvent[];
  onStepComplete?: (blockIndex: number, stepIndex: number) => void;
}) {
  const groups = useMemo<Group[]>(
    () =>
      blocks.map((block, bi) => {
        const stepItems: Item[] = block.steps.map((s, i) => ({
          key: `${bi}-s-${i}`,
          blockIndex: bi,
          stepIndex: i,
          kind: "step",
          typeLabel: stepTypeLabel(s.stepType),
          volume: formatVolume(s, modality),
          target: formatTarget(s, modality),
          reps: s.repetitions,
        }));
        const exItems: Item[] = block.exercises.map((ex, i) => ({
          key: `${bi}-e-${i}`,
          blockIndex: bi,
          stepIndex: block.steps.length + i,
          kind: "exercise",
          typeLabel: ex.exercise.name,
          volume: ex.reps != null ? `${ex.sets}×${ex.reps}` : `${ex.sets} séries`,
          target: ex.rpeTarget ? `RPE ${ex.rpeTarget}` : null,
          reps: null,
          demo: ex.exercise.videoUrl ? { name: ex.exercise.name, url: ex.exercise.videoUrl } : undefined,
        }));
        return {
          name: block.name || `Bloco ${block.sequence ?? bi + 1}`,
          blockReps: block.repetitions,
          items: [...stepItems, ...exItems],
        };
      }),
    [blocks, modality],
  );

  const total = groups.reduce((n, g) => n + g.items.length, 0);
  const [done, setDone] = useState<Set<string>>(new Set());
  const timer = useExecutionTimer(timerEvents ?? [], Boolean(timerEvents));

  function toggle(item: Item) {
    setDone((prev) => {
      const next = new Set(prev);
      if (next.has(item.key)) next.delete(item.key);
      else {
        next.add(item.key);
        onStepComplete?.(item.blockIndex, item.stepIndex); // append-only
      }
      return next;
    });
  }

  const pct = total ? Math.round((done.size / total) * 100) : 0;

  return (
    <div className="flex flex-col gap-4 pb-24">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className={uiClasses.subheading}>Treino em andamento</h2>
          <div className="flex items-center gap-3">
            {timerEvents && (
              <span className="tabular text-base font-semibold text-turq" aria-label="Tempo decorrido">
                {formatDuration(timer.elapsedSeconds)}
              </span>
            )}
            <span className="tabular text-sm text-muted">
              {done.size}/{total}
            </span>
          </div>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-surface">
          <div className="h-full rounded-full bg-turq transition-all" style={{ width: `${pct}%` }} />
        </div>
        <p className="text-xs text-muted">{MODALITY_HINT[modality]}</p>
      </div>

      {groups.map((group, gi) => (
        <div key={gi} className="rounded-xl border border-line bg-petrol/60 p-3">
          <div className="mb-2 flex items-center gap-2">
            <h3 className="font-display text-sm font-semibold text-ink">{group.name}</h3>
            {group.blockReps > 1 && (
              <span className="tabular rounded-md bg-surface px-2 py-0.5 text-xs font-bold text-turq">
                {group.blockReps}×
              </span>
            )}
          </div>
          <ul className="flex flex-col gap-2">
            {group.items.map((item) => {
              const checked = done.has(item.key);
              return (
                <li key={item.key} className="flex items-stretch gap-2">
                  <button
                    type="button"
                    aria-pressed={checked}
                    onClick={() => toggle(item)}
                    className={`flex min-h-14 flex-1 items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${
                      checked ? "border-turq/50 bg-turq/10" : "border-line-strong bg-surface hover:bg-surface-2"
                    }`}
                  >
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${
                        checked ? "border-turq bg-turq text-onbrand" : "border-line-strong"
                      }`}
                    >
                      {checked && <CheckIcon width={18} height={18} />}
                    </span>
                    <span className={`flex min-w-0 flex-1 flex-col ${checked ? "opacity-60" : ""}`}>
                      <span className="flex items-baseline gap-2">
                        <span className="text-sm font-semibold text-ink">
                          {item.reps && item.reps > 1 ? `${item.reps}× ` : ""}
                          {item.typeLabel}
                        </span>
                        {item.volume && <span className="tabular text-sm text-ink/90">{item.volume}</span>}
                      </span>
                      {item.target && (
                        <span className="tabular text-xs font-medium text-orange-hi">{item.target}</span>
                      )}
                    </span>
                  </button>
                  {item.demo && <ExerciseDemo name={item.demo.name} url={item.demo.url} size="sm" />}
                </li>
              );
            })}
          </ul>
        </div>
      ))}

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-petrol/95 p-3 backdrop-blur">
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
