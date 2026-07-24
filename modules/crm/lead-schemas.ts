import { z } from "zod";
import {
  LeadInteractionChannel,
  LeadInteractionType,
  LeadSource,
  LeadStatus,
  Modality,
} from "@prisma/client";

// Zod é a fronteira de confiança das rotas de CRM (§28). `.nullish()` nos campos
// opcionais dá a semântica de PATCH que o Prisma espera: ausente (undefined) =
// não mexe; `null` explícito = limpa o campo.

export const createLeadSchema = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().email().max(320).nullish(),
  phone: z.string().trim().max(50).nullish(),
  source: z.nativeEnum(LeadSource).optional(),
  interestedModality: z.nativeEnum(Modality).nullish(),
  assignedToUserId: z.string().uuid().nullish(),
  estimatedValue: z.number().nonnegative().max(9_999_999_999.99).nullish(),
  notes: z.string().trim().max(2000).nullish(),
  nextActionAt: z.coerce.date().nullish(),
});
export type CreateLeadInput = z.infer<typeof createLeadSchema>;

export const updateLeadSchema = createLeadSchema.partial();
export type UpdateLeadInput = z.infer<typeof updateLeadSchema>;

// Status tem endpoint próprio: mudar etapa tem efeito colateral (timestamps) e
// deixa rastro STATUS_CHANGE — não é um PATCH de campo qualquer.
export const changeLeadStatusSchema = z.object({
  status: z.nativeEnum(LeadStatus),
  lostReason: z.string().trim().max(500).nullish(),
});
export type ChangeLeadStatusInput = z.infer<typeof changeLeadStatusSchema>;

export const createLeadInteractionSchema = z.object({
  type: z.nativeEnum(LeadInteractionType),
  channel: z.nativeEnum(LeadInteractionChannel).optional(),
  summary: z.string().trim().min(1).max(2000),
  occurredAt: z.coerce.date().optional(),
  nextActionAt: z.coerce.date().nullish(),
});
export type CreateLeadInteractionInput = z.infer<typeof createLeadInteractionSchema>;

export const listLeadsQuerySchema = z.object({
  status: z.nativeEnum(LeadStatus).optional(),
  source: z.nativeEnum(LeadSource).optional(),
  assignedToUserId: z.string().uuid().optional(),
  q: z.string().trim().max(200).optional(),
  cursor: z.string().uuid().optional(),
  take: z.coerce.number().int().min(1).max(100).optional(),
});
export type ListLeadsQuery = z.infer<typeof listLeadsQuerySchema>;
