import { z } from "zod";
import { workoutBlockInputSchema } from "@/modules/workouts/prescription-schema";

// What gets stored, verbatim, in WorkoutTemplate.contentSnapshot (Json). It is
// an immutable copy taken at save time — never a live reference — so editing a
// workout later never mutates a template, and editing a template never mutates
// already-applied workouts. `blocks` reuses the single canonical prescription
// block shape so a template applies through the exact same persist path.
export const templateContentSchema = z.object({
  blocks: z.array(workoutBlockInputSchema).default([]),
  level: z.string().trim().max(50).optional(),
  objective: z.string().trim().max(500).optional(),
  estimatedDurationMinutes: z.number().int().positive().optional(),
  tags: z.array(z.string().trim().min(1).max(50)).max(20).default([]),
});
export type TemplateContent = z.infer<typeof templateContentSchema>;

const MODALITY = z.enum(["RUNNING", "STRENGTH", "FUNCTIONAL", "CYCLING", "SWIMMING", "TRIATHLON"]);

export const createWorkoutTemplateInputSchema = z.object({
  title: z.string().trim().min(1, "Título é obrigatório.").max(200),
  description: z.string().trim().max(2000).optional(),
  modality: MODALITY,
  content: templateContentSchema,
});
export type CreateWorkoutTemplateInput = z.infer<typeof createWorkoutTemplateInputSchema>;

export const updateWorkoutTemplateInputSchema = createWorkoutTemplateInputSchema;
export type UpdateWorkoutTemplateInput = z.infer<typeof updateWorkoutTemplateInputSchema>;

export const applyWorkoutTemplateInputSchema = z.object({
  athleteId: z.string().uuid("Atleta inválido."),
  plannedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida — use AAAA-MM-DD."),
});
export type ApplyWorkoutTemplateInput = z.infer<typeof applyWorkoutTemplateInputSchema>;

export const saveWorkoutAsTemplateInputSchema = z.object({
  title: z.string().trim().min(1, "Título é obrigatório.").max(200),
  description: z.string().trim().max(2000).optional(),
  tags: z.array(z.string().trim().min(1).max(50)).max(20).default([]),
});
export type SaveWorkoutAsTemplateInput = z.infer<typeof saveWorkoutAsTemplateInputSchema>;
