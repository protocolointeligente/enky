import { z } from "zod";

// Ação do treinador sobre um Insight persistido (02H → Fase 03): marcar como
// visto (VIEWED), aceitar/ignorar (ACCEPTED/IGNORED), encerrar (RESOLVED), anotar
// uma nota e/ou registrar o resultado observado (outcome). NEW e EXPIRED nunca
// são definíveis pela API — NEW é a exposição inicial, EXPIRED é da varredura.
// Ao menos um campo é obrigatório para a requisição fazer algo.
export const resolveInsightInputSchema = z
  .object({
    status: z.enum(["VIEWED", "ACCEPTED", "IGNORED", "RESOLVED"]).optional(),
    note: z.string().trim().min(1).max(500).optional(),
    outcome: z.string().trim().min(1).max(500).optional(),
  })
  .refine((data) => data.status != null || data.note != null || data.outcome != null, {
    message: "Informe ao menos um status, uma nota ou um resultado (outcome).",
    path: ["status"],
  });

export type ResolveInsightInput = z.infer<typeof resolveInsightInputSchema>;
