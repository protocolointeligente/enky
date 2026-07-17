import { z } from "zod";

// Contrato de entrada da geração assistida (Fase 6).
//
// Por que nível e disponibilidade vêm na REQUISIÇÃO e não do AthleteProfile:
// o perfil não guarda esses campos hoje, e eles são decisão de planejamento,
// não fato cadastral — mudam de ciclo para ciclo (o atleta muda de emprego e
// perde a terça; entra em outro nível depois de uma temporada). Enquanto não
// existir demanda para persistir, o treinador informa no momento de gerar.
// `level` é opcional de propósito: sem ele o motor gera com confiança
// rebaixada em vez de barrar o treinador.

export const generateWeekInputSchema = z.object({
  modality: z.enum(["RUNNING", "SWIMMING", "CYCLING", "TRIATHLON", "STRENGTH", "FUNCTIONAL"]),
  level: z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED"]).optional(),
  availableWeekdays: z
    .array(z.number().int().min(1, "Dia inválido.").max(7, "Dia inválido."))
    .min(1, "Informe ao menos um dia disponível na semana.")
    .max(7)
    .transform((days) => [...new Set(days)].sort((a, b) => a - b)),
  includeStrength: z.boolean().default(false),
  /**
   * Substitui rascunhos gerados anteriormente para esta semana. Treinos já
   * publicados ou editados pelo treinador nunca são tocados, com ou sem isto.
   */
  replaceExisting: z.boolean().default(false),
});

export type GenerateWeekInput = z.infer<typeof generateWeekInputSchema>;
