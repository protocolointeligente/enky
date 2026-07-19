-- Migração ADITIVA (Etapa 6, §10/§54): duas novas tabelas + dois enums.
-- Não altera tabelas existentes. Sem perda de dados. NÃO aplicada em produção
-- (operador aplica em staging/descartável). Treinos existentes seguem válidos:
-- o snapshot só é gerado quando uma execução inicia.

-- CreateEnum
CREATE TYPE "WorkoutExecutionStatus" AS ENUM ('STARTED', 'PAUSED', 'COMPLETED', 'PARTIALLY_COMPLETED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "WorkoutExecutionEventType" AS ENUM ('START', 'PAUSE', 'RESUME', 'STEP_COMPLETED', 'STEP_SKIPPED', 'BLOCK_COMPLETED', 'EXERCISE_COMPLETED', 'LAP', 'NOTE', 'ABANDON', 'COMPLETE', 'SYNC');

-- CreateTable
CREATE TABLE "WorkoutExecution" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "workoutId" TEXT NOT NULL,
    "status" "WorkoutExecutionStatus" NOT NULL DEFAULT 'STARTED',
    "startedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pausedAt" TIMESTAMPTZ,
    "resumedAt" TIMESTAMPTZ,
    "completedAt" TIMESTAMPTZ,
    "abandonedAt" TIMESTAMPTZ,
    "elapsedSeconds" INTEGER NOT NULL DEFAULT 0,
    "activeSeconds" INTEGER NOT NULL DEFAULT 0,
    "currentBlockIndex" INTEGER NOT NULL DEFAULT 0,
    "currentStepIndex" INTEGER NOT NULL DEFAULT 0,
    "deviceId" TEXT,
    "clientVersion" TEXT,
    "offlineCreatedAt" TIMESTAMPTZ,
    "syncedAt" TIMESTAMPTZ,
    "idempotencyKey" TEXT NOT NULL,
    "workoutVersion" INTEGER NOT NULL,
    "workoutSnapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "lockVersion" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "WorkoutExecution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkoutExecutionEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "executionId" TEXT NOT NULL,
    "type" "WorkoutExecutionEventType" NOT NULL,
    "sequence" INTEGER NOT NULL,
    "payload" JSONB,
    "occurredAt" TIMESTAMPTZ NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkoutExecutionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkoutExecution_idempotencyKey_key" ON "WorkoutExecution"("idempotencyKey");

-- CreateIndex
CREATE INDEX "WorkoutExecution_organizationId_athleteId_idx" ON "WorkoutExecution"("organizationId", "athleteId");

-- CreateIndex
CREATE INDEX "WorkoutExecution_workoutId_idx" ON "WorkoutExecution"("workoutId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkoutExecutionEvent_idempotencyKey_key" ON "WorkoutExecutionEvent"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "WorkoutExecutionEvent_executionId_sequence_key" ON "WorkoutExecutionEvent"("executionId", "sequence");

-- CreateIndex
CREATE INDEX "WorkoutExecutionEvent_executionId_idx" ON "WorkoutExecutionEvent"("executionId");

-- AddForeignKey
ALTER TABLE "WorkoutExecution" ADD CONSTRAINT "WorkoutExecution_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutExecution" ADD CONSTRAINT "WorkoutExecution_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "AthleteProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutExecution" ADD CONSTRAINT "WorkoutExecution_workoutId_fkey" FOREIGN KEY ("workoutId") REFERENCES "Workout"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutExecutionEvent" ADD CONSTRAINT "WorkoutExecutionEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutExecutionEvent" ADD CONSTRAINT "WorkoutExecutionEvent_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "WorkoutExecution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
