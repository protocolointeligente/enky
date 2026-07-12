import { z } from "zod";

// Ação do treinador sobre um Insight persistido (02H): aceitar/ignorar
// (a "ação") e/ou registrar o "resultado" (outcome) depois. PENDING nunca é
// definível pela API — é o estado inicial de exposição. Ao menos um campo é
// obrigatório para a requisição fazer algo.
export const resolveInsightInputSchema = z
  .object({
    status: z.enum(["ACCEPTED", "IGNORED"]).optional(),
    outcome: z.string().trim().min(1).max(500).optional(),
  })
  .refine((data) => data.status != null || data.outcome != null, {
    message: "Informe ao menos status (ACCEPTED ou IGNORED) ou um resultado (outcome).",
    path: ["status"],
  });

export type ResolveInsightInput = z.infer<typeof resolveInsightInputSchema>;
