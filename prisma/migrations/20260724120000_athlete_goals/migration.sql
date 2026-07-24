-- Objetivos e metas do atleta (App do atleta §11).
-- Migração ADITIVA: novos enums + duas tabelas novas (AthleteGoal, AthleteGoalEvent).
-- Não altera nem apaga nada existente. Sem backfill necessário (tabelas novas).

CREATE TYPE "GoalType" AS ENUM ('RACE', 'PERFORMANCE', 'CONDITIONING', 'HEALTH', 'BODY_COMPOSITION', 'ADHERENCE', 'RETURN_TO_SPORT', 'CUSTOM');
CREATE TYPE "GoalPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');
CREATE TYPE "GoalStatus" AS ENUM ('ACTIVE', 'ACHIEVED', 'MISSED', 'PAUSED', 'ARCHIVED');
CREATE TYPE "GoalEventKind" AS ENUM ('CREATED', 'UPDATED', 'COMMENT', 'ARCHIVED');

CREATE TABLE "AthleteGoal" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "GoalType" NOT NULL,
    "modality" "Modality",
    "targetEvent" TEXT,
    "targetDate" DATE,
    "weeklyFrequency" INTEGER,
    "targets" JSONB,
    "priority" "GoalPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "GoalStatus" NOT NULL DEFAULT 'ACTIVE',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "lockVersion" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "AthleteGoal_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AthleteGoalEvent" (
    "id" TEXT NOT NULL,
    "goalId" TEXT NOT NULL,
    "authorUserId" TEXT,
    "authorRole" "Role" NOT NULL,
    "kind" "GoalEventKind" NOT NULL,
    "note" TEXT,
    "changedFields" TEXT[],
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AthleteGoalEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_goal_athlete_status" ON "AthleteGoal"("organizationId", "athleteId", "status");
CREATE INDEX "idx_goal_athlete_target_date" ON "AthleteGoal"("organizationId", "athleteId", "targetDate");
CREATE INDEX "AthleteGoalEvent_goalId_createdAt_idx" ON "AthleteGoalEvent"("goalId", "createdAt");

ALTER TABLE "AthleteGoal" ADD CONSTRAINT "AthleteGoal_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AthleteGoal" ADD CONSTRAINT "AthleteGoal_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "AthleteProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AthleteGoalEvent" ADD CONSTRAINT "AthleteGoalEvent_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "AthleteGoal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AthleteGoalEvent" ADD CONSTRAINT "AthleteGoalEvent_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
