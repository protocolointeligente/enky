-- Native PostgreSQL constraints from Data Model Specification v1.2.1 §13.
-- Not expressible in schema.prisma (CHECK constraints spanning multiple
-- columns, partial/case-insensitive unique indexes) — added by hand,
-- reviewed against the canonical document field-by-field before applying.

-- Session-RPE and feedback physiological ranges.
ALTER TABLE "WorkoutFeedback" ADD CONSTRAINT "chk_feedback_ranges" CHECK (
  ("sessionRpe" IS NULL OR "sessionRpe" BETWEEN 1 AND 10) AND
  ("fatigueLevel" IS NULL OR "fatigueLevel" BETWEEN 0 AND 10) AND
  ("recoveryLevel" IS NULL OR "recoveryLevel" BETWEEN 0 AND 10) AND
  ("painLevel" IS NULL OR "painLevel" BETWEEN 0 AND 10) AND
  ("actualDurationMinutes" IS NULL OR "actualDurationMinutes" > 0)
);

-- sessionRpeLoad = actualDurationMinutes × sessionRpe: only COMPLETE may
-- have a non-null load; every other status must have it null (never zero).
ALTER TABLE "WorkoutFeedback" ADD CONSTRAINT "chk_workload_consistency" CHECK (
  ("loadStatus" = 'COMPLETE' AND "actualDurationMinutes" IS NOT NULL AND "sessionRpe" IS NOT NULL AND "sessionRpeLoad" IS NOT NULL) OR
  ("loadStatus" <> 'COMPLETE' AND "sessionRpeLoad" IS NULL)
);

-- Strength prescription ranges.
ALTER TABLE "WorkoutExercise" ADD CONSTRAINT "chk_strength_ranges" CHECK (
  "sets" > 0 AND
  ("reps" IS NULL OR "reps" >= 0) AND
  ("rpeTarget" IS NULL OR "rpeTarget" BETWEEN 1 AND 10) AND
  ("rir" IS NULL OR "rir" >= 0)
);

-- Chronological consistency.
ALTER TABLE "Workout" ADD CONSTRAINT "chk_workout_time" CHECK (
  "plannedStartAt" IS NULL OR "plannedEndAt" IS NULL OR "plannedEndAt" > "plannedStartAt"
);

ALTER TABLE "Periodization" ADD CONSTRAINT "chk_periodization_dates" CHECK ("endDate" >= "startDate");
ALTER TABLE "PeriodizationPhase" ADD CONSTRAINT "chk_phase_dates" CHECK ("endDate" >= "startDate");
ALTER TABLE "TrainingWeek" ADD CONSTRAINT "chk_week_dates" CHECK ("endDate" >= "startDate");
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "chk_event_time" CHECK ("endAt" > "startAt");

-- Case-insensitive uniqueness — additive to the case-sensitive
-- @@unique([name, organizationId]) already enforced by Prisma.
CREATE UNIQUE INDEX "uq_global_exercise_name" ON "Exercise" (LOWER("name")) WHERE "organizationId" IS NULL;
CREATE UNIQUE INDEX "uq_organization_exercise_name" ON "Exercise" ("organizationId", LOWER("name")) WHERE "organizationId" IS NOT NULL;

-- At most one non-terminal subscription per organization.
CREATE UNIQUE INDEX "uq_active_subscription_per_organization" ON "Subscription" ("organizationId") WHERE "status" IN ('TRIALING', 'ACTIVE', 'PAST_DUE', 'INCOMPLETE');

-- Case-insensitive email uniqueness — additive to the case-sensitive
-- @unique on User.email already enforced by Prisma.
CREATE UNIQUE INDEX "uq_user_email_lowercase" ON "User" (LOWER("email"));
