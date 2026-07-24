import { z } from "zod";
import { MODALITIES } from "@/modules/periodization/periodization-schema";

// Entrada do motor de sugestão (Fase 3). É o contexto de UMA semana — os mesmos
// campos que o gerador (planWeek) já consome. A rota é PREVIEW: calcula e
// explica, não grava. O nível aqui é o do MOTOR (3 faixas), não o PT.

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data deve ser YYYY-MM-DD.");

export const suggestionInputSchema = z
  .object({
    goal: z.string().trim().max(200).default(""),
    modality: z.enum(MODALITIES),
    level: z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED"]).optional(),
    availableWeekdays: z.array(z.number().int().min(1).max(7)).min(1).max(7),
    phaseName: z.string().trim().max(120).optional(),
    isRecoveryWeek: z.boolean().default(false),
    targetVolumeKm: z.number().nonnegative().max(10000).optional(),
    targetIntensity: z.string().trim().max(160).optional(),
    weekStartDate: isoDate,
    weekEndDate: isoDate,
    includeStrength: z.boolean().default(false),
  })
  .refine((d) => d.weekStartDate <= d.weekEndDate, {
    message: "Início da semana deve ser anterior ou igual ao fim.",
    path: ["weekStartDate"],
  });

export type SuggestionInput = z.infer<typeof suggestionInputSchema>;
