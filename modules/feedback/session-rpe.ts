import type { SessionRpeLoadStatus } from "@prisma/client";

// sessionRpeLoad = actualDurationMinutes × sessionRpe (Data Model Spec
// v1.2.1 §6). The backend is the sole authority — the client never
// computes or sends this value; see submitWorkoutFeedbackInputSchema,
// which has no field for it at all.

export type WorkoutCompletionStatus = "COMPLETED" | "PARTIAL" | "MISSED";

export interface SessionRpeInput {
  completionStatus: WorkoutCompletionStatus;
  actualDurationMinutes: number | null | undefined;
  sessionRpe: number | null | undefined;
}

export interface SessionRpeResult {
  loadStatus: SessionRpeLoadStatus;
  sessionRpeLoad: number | null;
}

export function calculateSessionRpeLoad(input: SessionRpeInput): SessionRpeResult {
  const hasDuration = input.actualDurationMinutes != null;
  const hasRpe = input.sessionRpe != null;

  // MISSED is logically incompatible with reporting how the session went —
  // if either value is present anyway, the payload is inconsistent, not
  // just incomplete.
  if (input.completionStatus === "MISSED") {
    if (hasDuration || hasRpe) {
      return { loadStatus: "INVALID", sessionRpeLoad: null };
    }
    return { loadStatus: "NOT_AVAILABLE", sessionRpeLoad: null };
  }

  if (hasDuration && hasRpe) {
    const load = Math.round(input.actualDurationMinutes! * input.sessionRpe! * 100) / 100;
    return { loadStatus: "COMPLETE", sessionRpeLoad: load };
  }

  if (hasDuration !== hasRpe) {
    return { loadStatus: "PARTIAL", sessionRpeLoad: null };
  }

  return { loadStatus: "NOT_AVAILABLE", sessionRpeLoad: null };
}
