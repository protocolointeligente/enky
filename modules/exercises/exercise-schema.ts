import { z } from "zod";

export const MODALITY = z.enum([
  "RUNNING",
  "STRENGTH",
  "FUNCTIONAL",
  "CYCLING",
  "SWIMMING",
  "TRIATHLON",
]);

// Free string, but a known ladder to keep filters/UI consistent (pt-BR).
export const EXERCISE_LEVELS = ["iniciante", "intermediário", "avançado"] as const;

// Collapses internal runs of whitespace so "Supino  reto" and "Supino reto"
// resolve to the same stored name — the DB's LOWER("name") unique index then
// also rejects case-only variants. Together this kills dedup-by-caixa/espaço.
const normalizedName = z
  .string()
  .trim()
  .min(1, "Nome é obrigatório.")
  .max(200)
  .transform((s) => s.replace(/\s+/g, " "));

// Fase 5: Exercise ganha modality/equipment/level/description (filtros e
// cadastro mais rico) e videoSource/videoLicense (rastreabilidade de vídeo).
// Todos opcionais — exercícios legados e globais podem não tê-los.
const exerciseFieldsSchema = z.object({
  name: normalizedName,
  category: z.string().trim().min(1, "Categoria é obrigatória.").max(100),
  targetMuscles: z.array(z.string().trim().min(1).max(100)).max(30).default([]),
  modality: MODALITY.optional(),
  equipment: z.string().trim().max(100).optional(),
  level: z.string().trim().max(50).optional(),
  description: z.string().trim().max(2000).optional(),
  videoUrl: z.string().trim().url("URL de vídeo inválida.").max(500).optional(),
  videoSource: z.string().trim().max(200).optional(),
  videoLicense: z.string().trim().max(500).optional(),
});

export const createExerciseInputSchema = exerciseFieldsSchema;
export type CreateExerciseInput = z.infer<typeof createExerciseInputSchema>;

export const updateExerciseInputSchema = exerciseFieldsSchema;
export type UpdateExerciseInput = z.infer<typeof updateExerciseInputSchema>;
