import { z } from "zod";

// Questionário de prontidão (Fase II). Todos os campos são opcionais — o atleta
// pode responder parcialmente — mas ao menos um sinal precisa vir, senão não há
// check-in. Escalas 0–10 (ENKY_METRIC_REGISTRY: soreness/motivation/etc.).
const score = z.number().int().min(0).max(10);

export const submitReadinessInputSchema = z
  .object({
    sleepHours: z.number().min(0).max(24).optional(),
    sleepQuality: score.optional(),
    fatigue: score.optional(),
    soreness: score.optional(),
    stress: score.optional(),
    motivation: score.optional(),
    mood: score.optional(),
    disposition: score.optional(),
    // Dor localizada é texto livre (onde/como dói) — dado de saúde, redigido em
    // log. Qualitativo: não entra no escore, é sinalizado ao treinador.
    localizedPain: z.string().trim().max(500).optional(),
    notes: z.string().trim().max(2000).optional(),
  })
  .refine(
    (d) =>
      d.sleepHours != null ||
      d.sleepQuality != null ||
      d.fatigue != null ||
      d.soreness != null ||
      d.stress != null ||
      d.motivation != null ||
      d.mood != null ||
      d.disposition != null ||
      (d.localizedPain != null && d.localizedPain.length > 0),
    { message: "Preencha ao menos um item do questionário de prontidão." },
  );

export type SubmitReadinessInput = z.infer<typeof submitReadinessInputSchema>;
