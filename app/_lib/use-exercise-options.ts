"use client";

import { useEffect, useState } from "react";
import type { ExerciseOption } from "@/components/blocks-editor";
import { apiFetch } from "./api-client";

// Loads the trainer's active exercises (own org + global) as picker options
// for the shared BlocksEditor. Failure is non-fatal — the editor still allows
// free-typing an exercise name, so an empty list just means no autocomplete.
export function useExerciseOptions(enabled: boolean): ExerciseOption[] {
  const [options, setOptions] = useState<ExerciseOption[]>([]);
  useEffect(() => {
    if (!enabled) return;
    apiFetch<{ exercises: { name: string; category: string }[] }>("/api/trainer/exercises")
      .then((r) => setOptions(r.exercises.map((e) => ({ name: e.name, category: e.category }))))
      .catch(() => undefined);
  }, [enabled]);
  return options;
}
