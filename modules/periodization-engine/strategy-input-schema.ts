import { z } from "zod";
import { MODALITIES, PERIODIZATION_LEVELS } from "@/modules/periodization/periodization-schema";
import type { AthleteLevel, Modality } from "./periodization-engine-types";

// Entrada da API do motor estratégico (Fase 1). Reaproveita os enums já usados
// pela periodização manual (mesmos dropdowns na UI). A regra científica vive no
// motor puro; aqui só validamos o formato e mapeamos o nível PT → nível do motor.

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data deve ser YYYY-MM-DD.");

export const strategyInputSchema = z
  .object({
    title: z.string().trim().min(1, "Informe um título.").max(120),
    goal: z.string().trim().min(1, "Informe o objetivo.").max(200),
    modality: z.enum(MODALITIES),
    // Nível em português (mesmo enum da periodização manual). ELITE mapeia para
    // ADVANCED no motor, que trabalha com três faixas.
    level: z.enum(PERIODIZATION_LEVELS).optional(),
    startDate: isoDate,
    eventDate: isoDate,
    availableWeekdays: z.array(z.number().int().min(1).max(7)).max(7).default([]),
    baseWeeklyVolumeKm: z.number().positive().max(2000).optional(),
    includeStrength: z.boolean().default(false),
    targetEvent: z.string().trim().max(160).optional(),
    notes: z.string().trim().max(2000).optional(),
  })
  .refine((d) => d.eventDate > d.startDate, {
    message: "A data da prova deve ser posterior ao início.",
    path: ["eventDate"],
  });

export type StrategyInput = z.infer<typeof strategyInputSchema>;

// Mapa nível PT (UI/periodização manual) → nível do motor (3 faixas). Puro e
// testável — ELITE trata-se como ADVANCED (o teto do motor).
const LEVEL_MAP: Record<(typeof PERIODIZATION_LEVELS)[number], AthleteLevel> = {
  INICIANTE: "BEGINNER",
  INTERMEDIARIO: "INTERMEDIATE",
  AVANCADO: "ADVANCED",
  ELITE: "ADVANCED",
};

export function toEngineLevel(
  level: (typeof PERIODIZATION_LEVELS)[number] | undefined,
): AthleteLevel | undefined {
  return level ? LEVEL_MAP[level] : undefined;
}

// Modalidade da API já é a Modality do motor (mesmo enum) — helper explícito só
// para deixar a intenção clara no serviço.
export function toEngineModality(modality: (typeof MODALITIES)[number]): Modality {
  return modality;
}
