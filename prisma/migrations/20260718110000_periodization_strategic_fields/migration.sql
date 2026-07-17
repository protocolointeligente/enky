-- Fase 04 — camada estratégica rica da periodização. Migração ADITIVA: só
-- colunas nullable/com default; planos existentes seguem válidos.

ALTER TABLE "Periodization" ADD COLUMN "modality" "Modality";
ALTER TABLE "Periodization" ADD COLUMN "targetEvent" TEXT;
ALTER TABLE "Periodization" ADD COLUMN "level" TEXT;
ALTER TABLE "Periodization" ADD COLUMN "loadControlMethod" TEXT;
ALTER TABLE "Periodization" ADD COLUMN "mainUnit" TEXT;
ALTER TABLE "Periodization" ADD COLUMN "totalVolume" DECIMAL(12,2);
ALTER TABLE "Periodization" ADD COLUMN "mesocycleCount" INTEGER;
ALTER TABLE "Periodization" ADD COLUMN "microcycleCount" INTEGER;
ALTER TABLE "Periodization" ADD COLUMN "recoveryStrategy" TEXT;
ALTER TABLE "Periodization" ADD COLUMN "difficultyDistribution" TEXT;
ALTER TABLE "Periodization" ADD COLUMN "autoGenerate" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Periodization" ADD COLUMN "isDraft" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Periodization" ADD COLUMN "notes" TEXT;
ALTER TABLE "Periodization" ADD COLUMN "parameters" JSONB;
