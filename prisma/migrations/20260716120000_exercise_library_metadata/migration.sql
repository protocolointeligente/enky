-- Fase 5 — Biblioteca de Exercícios: metadados para filtros e rastreabilidade
-- de vídeo. Todas as colunas são NULLABLE — aditivas sobre exercícios
-- existentes (org e globais) sem backfill. A unicidade case-insensitive por
-- org já existe (uq_organization_exercise_name / uq_global_exercise_name em
-- LOWER("name")) desde 20260710104346_add_native_postgres_constraints.

ALTER TABLE "Exercise" ADD COLUMN "modality" "Modality";
ALTER TABLE "Exercise" ADD COLUMN "equipment" TEXT;
ALTER TABLE "Exercise" ADD COLUMN "level" TEXT;
ALTER TABLE "Exercise" ADD COLUMN "description" TEXT;
ALTER TABLE "Exercise" ADD COLUMN "videoSource" TEXT;
ALTER TABLE "Exercise" ADD COLUMN "videoLicense" TEXT;
