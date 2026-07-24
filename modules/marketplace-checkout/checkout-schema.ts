import { z } from "zod";

// idempotencyKey vem do cliente (uuid por tentativa) — é o que impede cobrança
// dupla numa retentativa. method default PIX (único caminho do MVP).
export const createOrderInputSchema = z.object({
  productSlug: z.string().min(1),
  idempotencyKey: z.string().uuid(),
  method: z.enum(["PIX", "CREDIT_CARD", "BANK_SLIP"]).default("PIX"),
  // CPF/CNPJ do comprador — só dígitos; exigido pelo gateway real (Asaas).
  buyerTaxId: z
    .string()
    .regex(/^\d{11}$|^\d{14}$/, "CPF (11) ou CNPJ (14) dígitos.")
    .optional(),
});

export type CreateOrderInputBody = z.infer<typeof createOrderInputSchema>;
