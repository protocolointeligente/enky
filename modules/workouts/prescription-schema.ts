import { z } from "zod";
import { stepMetadataSchema } from "./zone-provenance";

// The single canonical prescription contract — reused by createWorkoutDraft,
// updateWorkoutDraft, and (eventually) calendar/template/periodization entry
// points. Never duplicate this shape in a route or a form. `sequence` is
// deliberately absent from every nested item: order is derived from array
// position when persisting, so the client never has to manage/collide on it.

export const workoutStepInputSchema = z.object({
  stepType: z.enum(["TIRO", "RODAGEM", "PAUSA_ATIVA", "PAUSA_PASSIVA", "PROGRESSIVO", "SUBIDA"]),
  repetitions: z.number().int().positive().optional(),
  durationSeconds: z.number().int().positive().optional(),
  distanceMeters: z.number().int().positive().optional(),
  targetType: z.enum(["PACE", "HEART_RATE_ZONE", "POWER", "CADENCE", "RPE"]).optional(),
  targetMin: z.number().nonnegative().optional(),
  targetMax: z.number().nonnegative().optional(),
  recoverySeconds: z.number().int().nonnegative().optional(),
  recoveryMeters: z.number().int().nonnegative().optional(),
  // Proveniência da zona calculada (fatia D) — congela a interpretação histórica.
  metadata: stepMetadataSchema.optional(),
});

export const workoutExerciseInputSchema = z.object({
  exerciseName: z.string().trim().min(1, "Nome do exercício é obrigatório.").max(200),
  exerciseCategory: z.string().trim().min(1).max(100).default("geral"),
  sets: z.number().int().positive("Séries deve ser maior que zero."),
  reps: z.number().int().nonnegative().optional(),
  durationSeconds: z.number().int().positive().optional(),
  loadKg: z.number().nonnegative().optional(),
  rir: z.number().int().nonnegative().optional(),
  rpeTarget: z.number().min(1).max(10).optional(),
  restSeconds: z.number().int().nonnegative().optional(),
  notes: z.string().trim().max(1000).optional(),
  // Proveniência da carga por %1RM (fatia D2).
  metadata: stepMetadataSchema.optional(),
});

export const workoutBlockInputSchema = z.object({
  name: z.string().trim().max(200).optional(),
  repetitions: z.number().int().positive().default(1),
  steps: z.array(workoutStepInputSchema).default([]),
  exercises: z.array(workoutExerciseInputSchema).default([]),
});

const workoutPrescriptionBaseSchema = z.object({
  athleteId: z.string().uuid("Atleta inválido."),
  title: z.string().trim().min(1, "Título é obrigatório.").max(200),
  description: z.string().trim().max(2000).optional(),
  modality: z.enum(["RUNNING", "STRENGTH", "FUNCTIONAL", "CYCLING", "SWIMMING", "TRIATHLON"]),
  plannedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida — use AAAA-MM-DD."),
  plannedStartAt: z.string().datetime().optional(),
  plannedEndAt: z.string().datetime().optional(),
  timezone: z.string().trim().min(1).default("America/Sao_Paulo"),
  blocks: z.array(workoutBlockInputSchema).default([]),
});

// Inlined on each concrete schema rather than factored into a shared
// generic helper: a generic `<Schema extends z.ZodType<...>>` wrapper
// collapses TS's inferred output back down to the narrow constraint type
// instead of the schema's real shape (a known ZodType/indexed-access
// inference limitation), so the two `.refine()` calls are duplicated
// on purpose here.
const endAfterStartRefinement = {
  message: "O horário de término deve ser depois do horário de início.",
  path: ["plannedEndAt"],
};

function isEndAfterStart(data: { plannedStartAt?: string; plannedEndAt?: string }): boolean {
  return (
    !data.plannedStartAt ||
    !data.plannedEndAt ||
    new Date(data.plannedEndAt).getTime() > new Date(data.plannedStartAt).getTime()
  );
}

export const createWorkoutDraftInputSchema = workoutPrescriptionBaseSchema.refine(
  isEndAfterStart,
  endAfterStartRefinement,
);
export type CreateWorkoutDraftInput = z.infer<typeof createWorkoutDraftInputSchema>;

export const updateWorkoutDraftInputSchema = workoutPrescriptionBaseSchema
  .extend({
    lockVersion: z.number().int().positive("lockVersion é obrigatório para edição."),
  })
  .refine(isEndAfterStart, endAfterStartRefinement);
export type UpdateWorkoutDraftInput = z.infer<typeof updateWorkoutDraftInputSchema>;

export type WorkoutBlockInput = z.infer<typeof workoutBlockInputSchema>;
