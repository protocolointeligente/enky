import { z } from "zod";

// The Exercise model in this phase carries name/category/targetMuscles/videoUrl
// only. Richer fields (description, modality, equipment, level, instructions,
// imageUrl, createdBy) are a deferred additive migration — see the Fase 02D.2
// report — so they are intentionally absent from this contract.
const exerciseFieldsSchema = z.object({
  name: z.string().trim().min(1, "Nome é obrigatório.").max(200),
  category: z.string().trim().min(1, "Categoria é obrigatória.").max(100),
  targetMuscles: z.array(z.string().trim().min(1).max(100)).max(30).default([]),
  videoUrl: z.string().trim().url("URL de vídeo inválida.").max(500).optional(),
});

export const createExerciseInputSchema = exerciseFieldsSchema;
export type CreateExerciseInput = z.infer<typeof createExerciseInputSchema>;

export const updateExerciseInputSchema = exerciseFieldsSchema;
export type UpdateExerciseInput = z.infer<typeof updateExerciseInputSchema>;
