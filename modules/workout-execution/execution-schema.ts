import { z } from "zod";

// Chave de idempotência gerada no cliente (uuid): o mesmo "start"/evento vindo
// duas vezes da fila offline não duplica no servidor (§17/§52).
const idempotencyKey = z.string().trim().min(8).max(100);

export const startExecutionInputSchema = z.object({
  idempotencyKey,
  deviceId: z.string().trim().max(100).optional(),
  clientVersion: z.string().trim().max(50).optional(),
  // epoch ms de quando a execução foi criada no cliente (pode ter sido offline).
  offlineCreatedAt: z.number().int().positive().optional(),
});
export type StartExecutionInput = z.infer<typeof startExecutionInputSchema>;

export const EXECUTION_EVENT_TYPES = [
  "START",
  "PAUSE",
  "RESUME",
  "STEP_COMPLETED",
  "STEP_SKIPPED",
  "BLOCK_COMPLETED",
  "EXERCISE_COMPLETED",
  "LAP",
  "NOTE",
  "ABANDON",
  "COMPLETE",
  "SYNC",
] as const;

const execEventInputSchema = z.object({
  type: z.enum(EXECUTION_EVENT_TYPES),
  sequence: z.number().int().min(0),
  occurredAt: z.number().int().positive(), // epoch ms (relógio do cliente)
  idempotencyKey,
  // Planejado-vs-realizado por etapa e posição atual viajam aqui (§15) — Json livre,
  // validado só o essencial para não travar a evolução do payload por modalidade.
  payload: z
    .object({
      blockIndex: z.number().int().min(0).optional(),
      stepIndex: z.number().int().min(0).optional(),
    })
    .passthrough()
    .optional(),
  partial: z.boolean().optional(), // só relevante em COMPLETE
});
export type ExecEventInput = z.infer<typeof execEventInputSchema>;

export const appendEventsInputSchema = z.object({
  // Lote: a fila offline entrega vários eventos de uma vez ao reconectar.
  events: z.array(execEventInputSchema).min(1).max(200),
});
export type AppendEventsInput = z.infer<typeof appendEventsInputSchema>;
