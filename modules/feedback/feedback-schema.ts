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

// Um treino marcado como MISSED (não realizado) é logicamente incompatível
// com reportar quanto tempo/esforço a sessão teve. No formulário interativo
// isso é um erro de entrada que deve ser recusado imediatamente (400), não
// persistido — por isso o refine aqui, aplicado a cada schema concreto após
// o `.extend()` (um `.refine()` retorna ZodEffects, que não tem `.extend()`,
// mesmo motivo do prescription-schema). O estado `INVALID` de
// calculateSessionRpeLoad continua existindo como defesa em profundidade
// para vias NÃO interativas (importação, integração, dados legados) que não
// passam por este schema.
const missedConsistencyRefinement = {
  message:
    "Um treino marcado como não realizado (MISSED) não pode reportar duração ou RPE de sessão.",
  path: ["completionStatus"],
};

function isMissedConsistent(data: {
  completionStatus: "COMPLETED" | "PARTIAL" | "MISSED";
  actualDurationMinutes?: number;
  sessionRpe?: number;
}): boolean {
  return (
    data.completionStatus !== "MISSED" ||
    (data.actualDurationMinutes == null && data.sessionRpe == null)
  );
}

export const submitWorkoutFeedbackInputSchema = feedbackFieldsSchema.refine(
  isMissedConsistent,
  missedConsistencyRefinement,
);
export type SubmitWorkoutFeedbackInput = z.infer<typeof submitWorkoutFeedbackInputSchema>;

// Controlled update, allowed once (§11): the caller must echo back the
// feedback's current `updatedAt` — the closest equivalent to optimistic
// locking without adding a lockVersion column that doesn't exist yet on
// WorkoutFeedback (no schema change needed for this phase).
export const updateWorkoutFeedbackInputSchema = feedbackFieldsSchema
  .extend({
    knownUpdatedAt: z.string().datetime("knownUpdatedAt é obrigatório para atualizar o feedback."),
  })
  .refine(isMissedConsistent, missedConsistencyRefinement);
export type UpdateWorkoutFeedbackInput = z.infer<typeof updateWorkoutFeedbackInputSchema>;
