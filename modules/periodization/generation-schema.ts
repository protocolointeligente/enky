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
//
// `mode` espelha o enum GenerationMode do banco:
//   ASSISTED  — o treinador informa os parâmetros (padrão).
//   AUTOMATIC — o motor deduz do histórico o que não foi informado.
// Nenhum dos dois publica: `generationMode` diz quem escolheu os parâmetros,
// não quem decide o que o atleta enxerga. Sempre DRAFT.

export const generateInputSchema = z
  .object({
    mode: z.enum(["ASSISTED", "AUTOMATIC"]).default("ASSISTED"),
    modality: z
      .enum(["RUNNING", "SWIMMING", "CYCLING", "TRIATHLON", "STRENGTH", "FUNCTIONAL"])
      .optional(),
    level: z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED"]).optional(),
    availableWeekdays: z
      .array(z.number().int().min(1, "Dia inválido.").max(7, "Dia inválido."))
      .min(1, "Informe ao menos um dia disponível na semana.")
      .max(7)
      .transform((days) => [...new Set(days)].sort((a, b) => a - b))
      .optional(),
    includeStrength: z.boolean().default(false),
    /**
     * Substitui rascunhos gerados anteriormente. Treinos já publicados ou
     * editados pelo treinador nunca são tocados, com ou sem isto.
     */
    replaceExisting: z.boolean().default(false),
  })
  // No modo ASSISTED os parâmetros são do treinador — exigi-los aqui evita
  // que uma requisição incompleta caia no motor e vire prescrição genérica
  // sem ninguém perceber. No AUTOMATIC eles são opcionais porque a dedução
  // os preenche (e rebaixa a confiança ao fazê-lo).
  .refine((input) => input.mode === "AUTOMATIC" || input.modality !== undefined, {
    message: "Informe a modalidade (ou use o modo automático).",
    path: ["modality"],
  })
  .refine((input) => input.mode === "AUTOMATIC" || input.availableWeekdays !== undefined, {
    message: "Informe os dias disponíveis (ou use o modo automático).",
    path: ["availableWeekdays"],
  });

export type GenerateInput = z.infer<typeof generateInputSchema>;
