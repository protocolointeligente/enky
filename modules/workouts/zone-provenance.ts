import { z } from "zod";

// Proveniência da intensidade calculada por zona, gravada em WorkoutStep.metadata
// (fatia D). Preserva a interpretação HISTÓRICA da prescrição: uma avaliação nova
// NÃO altera retroativamente um treino já prescrito — os valores calculados na
// data ficam congelados aqui. Base para auditoria e comparação planejado×realizado.
export const zoneProvenanceSchema = z
  .object({
    intensityMethod: z.string().trim().min(1).max(40), // ex.: HR_RESERVE, PACE_VDOT
    zoneCode: z.string().trim().min(1).max(40), // ex.: Z2, THRESHOLD
    calculatedLowerBound: z.number(),
    calculatedUpperBound: z.number(),
    unit: z.string().trim().min(1).max(10), // bpm, s/km, W, s/100m
    formulaCode: z.string().trim().min(1).max(40),
    formulaVersion: z.string().trim().min(1).max(20),
    assessmentId: z.string().uuid().nullable().optional(),
    assessmentDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable()
      .optional(),
    // Sobrescrita manual: o treinador ajustou o valor calculado. Exige motivo.
    wasManuallyOverridden: z.boolean().default(false),
    overrideReason: z.string().trim().max(500).nullable().optional(),
  })
  .strict()
  .refine((z) => !z.wasManuallyOverridden || (z.overrideReason ?? "").trim().length > 0, {
    message: "Sobrescrita manual exige justificativa.",
    path: ["overrideReason"],
  });

export type ZoneProvenance = z.infer<typeof zoneProvenanceSchema>;

// metadata do passo — hoje só carrega a proveniência de zona; strict para não
// virar um saco de gatos.
export const stepMetadataSchema = z.object({ zone: zoneProvenanceSchema.optional() }).strict();
export type StepMetadata = z.infer<typeof stepMetadataSchema>;
