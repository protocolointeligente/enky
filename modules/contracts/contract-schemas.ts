import { z } from "zod";
import { ContractAcceptanceMethod, ContractStatus } from "@prisma/client";

// Zod na fronteira (§28). Regras de valor (freeze de preço, desconto ≤ preço)
// moram no serviço, não aqui.

export const createContractSchema = z.object({
  clientId: z.string().uuid(),
  servicePlanId: z.string().uuid(),
  athleteId: z.string().uuid().nullish(),
  payerClientId: z.string().uuid().nullish(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().nullish(),
  billingStartDate: z.coerce.date().nullish(),
  billingDay: z.number().int().min(1).max(31).optional(),
  // Override do preço (valor avulso/personalizado). Ausente = snapshot do plano.
  price: z.number().nonnegative().max(9_999_999_999.99).nullish(),
  discount: z.number().nonnegative().max(9_999_999_999.99).optional(),
  currency: z.string().trim().length(3).toUpperCase().optional(),
  autoRenew: z.boolean().optional(),
  gracePeriodDays: z.number().int().min(0).max(365).optional(),
  cancellationNoticeDays: z.number().int().min(0).max(365).optional(),
});
export type CreateContractInput = z.infer<typeof createContractSchema>;

// Sem clientId/servicePlanId: trocar as partes é um novo contrato, não um edit.
export const updateContractSchema = z.object({
  athleteId: z.string().uuid().nullish(),
  // Pagador é obrigatório: pode trocar, não pode ficar vazio (diferente de
  // athleteId, que é opcional e pode ser limpo).
  payerClientId: z.string().uuid().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().nullish(),
  billingStartDate: z.coerce.date().nullish(),
  billingDay: z.number().int().min(1).max(31).optional(),
  price: z.number().nonnegative().max(9_999_999_999.99).optional(),
  discount: z.number().nonnegative().max(9_999_999_999.99).optional(),
  currency: z.string().trim().length(3).toUpperCase().optional(),
  autoRenew: z.boolean().optional(),
  gracePeriodDays: z.number().int().min(0).max(365).optional(),
  cancellationNoticeDays: z.number().int().min(0).max(365).optional(),
});
export type UpdateContractInput = z.infer<typeof updateContractSchema>;

export const changeContractStatusSchema = z.object({
  status: z.nativeEnum(ContractStatus),
  cancellationReason: z.string().trim().max(500).nullish(),
});
export type ChangeContractStatusInput = z.infer<typeof changeContractStatusSchema>;

export const acceptContractSchema = z.object({
  method: z.nativeEnum(ContractAcceptanceMethod).optional(),
  acceptedBy: z.string().trim().min(1).max(200),
});
export type AcceptContractInput = z.infer<typeof acceptContractSchema>;

export const listContractsQuerySchema = z.object({
  status: z.nativeEnum(ContractStatus).optional(),
  clientId: z.string().uuid().optional(),
  q: z.string().trim().max(200).optional(),
  cursor: z.string().uuid().optional(),
  take: z.coerce.number().int().min(1).max(100).optional(),
});
export type ListContractsQuery = z.infer<typeof listContractsQuerySchema>;
