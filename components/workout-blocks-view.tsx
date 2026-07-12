import { stepTypeLabel } from "@/app/_lib/labels";
import { ExerciseDemo } from "@/components/exercise-demo";

// Read-only rendering of a workout's block/step/exercise tree. Shared by the
// trainer detail page and the pre-publish review so both stay identical.
export interface StepView {
  id?: string;
  sequence?: number;
  stepType: string;
  repetitions: number | null;
  durationSeconds: number | null;
  distanceMeters: number | null;
  targetType: string | null;
  targetMin: string | null;
  targetMax: string | null;
}

export interface ExerciseView {
  id?: string;
  sequence?: number;
  sets: number;
  reps: number | null;
  loadKg: string | null;
  rpeTarget: number | null;
  exercise: { name: string; category: string; videoUrl?: string | null };
}

export interface BlockView {
  id?: string;
  sequence: number;
  name: string | null;
  repetitions: number;
  steps: StepView[];
  exercises: ExerciseView[];
}

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

export function WorkoutBlocksView({ blocks }: { blocks: BlockView[] }) {
  return (
    <div className="flex flex-col gap-3">
      {blocks.map((block, index) => (
        <div key={block.id ?? index} className="rounded-xl border border-line bg-petrol/70 p-4">
          <div className="mb-2 flex items-center gap-2">
            <span className="tabular flex h-6 w-6 items-center justify-center rounded-md bg-surface text-xs font-bold text-muted">
              {block.sequence}
            </span>
            <h3 className="font-display text-sm font-semibold text-ink">
              {block.name || `Bloco ${block.sequence}`}
            </h3>
            <span className="text-xs text-muted">{block.repetitions}×</span>
          </div>
          {block.steps.length > 0 && (
            <ul className="flex flex-col gap-1 text-sm text-muted">
              {block.steps.map((step, i) => (
                <li key={step.id ?? i}>{stepLine(step)}</li>
              ))}
            </ul>
          )}
          {block.exercises.length > 0 && (
            <ul className="mt-1 flex flex-col gap-2 text-sm text-muted">
              {block.exercises.map((exercise, i) => (
                <li key={exercise.id ?? i} className="flex items-center gap-2">
                  {exercise.exercise.videoUrl && (
                    <ExerciseDemo
                      name={exercise.exercise.name}
                      url={exercise.exercise.videoUrl}
                      size="sm"
                    />
                  )}
                  <span>{exerciseLine(exercise)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}
