import { z } from "zod";

// idempotencyKey vem do cliente (uuid por tentativa) — é o que impede cobrança
// dupla numa retentativa. method default PIX (único caminho do MVP).
export const createOrderInputSchema = z.object({
  productSlug: z.string().min(1),
  idempotencyKey: z.string().uuid(),
  method: z.enum(["PIX", "CREDIT_CARD", "BANK_SLIP"]).default("PIX"),
});

export type CreateOrderInputBody = z.infer<typeof createOrderInputSchema>;
