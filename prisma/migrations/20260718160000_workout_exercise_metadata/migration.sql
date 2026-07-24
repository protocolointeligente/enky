-- Fatia D2 — proveniência da carga por %1RM no exercício de força. Migração
-- ADITIVA: uma coluna JSON nullable, paridade com WorkoutStep.metadata.
ALTER TABLE "WorkoutExercise" ADD COLUMN "metadata" JSONB;
