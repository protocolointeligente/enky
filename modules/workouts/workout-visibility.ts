import type { WorkoutStatus } from "@prisma/client";

// Statuses an athlete is ever allowed to see. DRAFT and IN_PROGRESS are
// excluded: a DRAFT is still being authored by the trainer, and IN_PROGRESS
// only exists transiently between starting a session and submitting feedback.
// Single source of truth — the athlete calendar, list and detail queries all
// filter through this so visibility can never drift between them.
export const ATHLETE_VISIBLE_STATUSES: readonly WorkoutStatus[] = [
  "PUBLISHED",
  "COMPLETED",
  "PARTIAL",
  "MISSED",
  "ARCHIVED",
  "CANCELLED",
] as const;

export function isAthleteVisibleStatus(status: WorkoutStatus): boolean {
  return ATHLETE_VISIBLE_STATUSES.includes(status);
}
