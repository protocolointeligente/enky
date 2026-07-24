import { z } from "zod";
import { CoachInvoiceStatus, CoachPaymentMethod } from "@prisma/client";

export const generateInvoicesSchema = z.object({
  contractId: z.string().uuid(),
  fromDate: z.coerce.date(),
  toDate: z.coerce.date(),
});
export type GenerateInvoicesInput = z.infer<typeof generateInvoicesSchema>;

export const registerPaymentSchema = z.object({
  amount: z.number().positive().max(9_999_999_999.99),
  method: z.nativeEnum(CoachPaymentMethod),
  paidAt: z.coerce.date().optional(),
  externalReference: z.string().trim().max(200).nullish(),
  notes: z.string().trim().max(1000).nullish(),
});
export type RegisterPaymentInput = z.infer<typeof registerPaymentSchema>;

// Editar a fatura: reagendar vencimento, aplicar desconto/juros/multa, observação.
export const updateInvoiceSchema = z.object({
  dueDate: z.coerce.date().optional(),
  discount: z.number().nonnegative().max(9_999_999_999.99).optional(),
  interest: z.number().nonnegative().max(9_999_999_999.99).optional(),
  penalty: z.number().nonnegative().max(9_999_999_999.99).optional(),
  notes: z.string().trim().max(1000).nullish(),
});
export type UpdateInvoiceInput = z.infer<typeof updateInvoiceSchema>;

export const listInvoicesQuerySchema = z.object({
  status: z.nativeEnum(CoachInvoiceStatus).optional(),
  contractId: z.string().uuid().optional(),
  payerClientId: z.string().uuid().optional(),
  q: z.string().trim().max(200).optional(),
  cursor: z.string().uuid().optional(),
  take: z.coerce.number().int().min(1).max(100).optional(),
});
export type ListInvoicesQuery = z.infer<typeof listInvoicesQuerySchema>;
