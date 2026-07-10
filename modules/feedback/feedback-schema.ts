import { z } from "zod";

// sessionRpeLoad has no field here on purpose — the backend computes it
// (session-rpe.ts) and Zod's default object parsing already strips any
// unknown key a client sends, so a client-supplied sessionRpeLoad is
// silently dropped before this schema's data ever reaches the service.
const feedbackFieldsSchema = z.object({
  completionStatus: z.enum(["COMPLETED", "PARTIAL", "MISSED"]),
  actualDurationMinutes: z.number().int().positive().optional(),
  actualDistanceKm: z.number().positive().optional(),
  sessionRpe: z.number().min(1).max(10).optional(),
  fatigueLevel: z.number().int().min(0).max(10).optional(),
  recoveryLevel: z.number().int().min(0).max(10).optional(),
  painLevel: z.number().int().min(0).max(10).optional(),
  painLaterality: z.string().trim().max(50).optional(),
  painRegion: z.string().trim().max(200).optional(),
  notes: z.string().trim().max(2000).optional(),
});

export const submitWorkoutFeedbackInputSchema = feedbackFieldsSchema;
export type SubmitWorkoutFeedbackInput = z.infer<typeof submitWorkoutFeedbackInputSchema>;

// Controlled update, allowed once (§11): the caller must echo back the
// feedback's current `updatedAt` — the closest equivalent to optimistic
// locking without adding a lockVersion column that doesn't exist yet on
// WorkoutFeedback (no schema change needed for this phase).
export const updateWorkoutFeedbackInputSchema = feedbackFieldsSchema.extend({
  knownUpdatedAt: z.string().datetime("knownUpdatedAt é obrigatório para atualizar o feedback."),
});
export type UpdateWorkoutFeedbackInput = z.infer<typeof updateWorkoutFeedbackInputSchema>;
