import { z } from "zod";
import { CoachBillingInterval, CoachBillingType, Modality } from "@prisma/client";

// Zod na fronteira (§28). A regra "RECURRING exige intervalo / os demais não têm"
// NÃO mora aqui — mora em `normalizeBillingInterval` (plan-service), que é o
// único ponto que a impõe (create e update), evitando regra duplicada.

const base = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).nullish(),
  modality: z.nativeEnum(Modality).nullish(),
  billingType: z.nativeEnum(CoachBillingType).optional(),
  price: z.number().nonnegative().max(9_999_999_999.99).optional(),
  currency: z.string().trim().length(3).toUpperCase().optional(),
  billingInterval: z.nativeEnum(CoachBillingInterval).nullish(),
  durationMonths: z.number().int().min(1).max(600).nullish(),
  trialDays: z.number().int().min(0).max(365).optional(),
  maxSessionsPerWeek: z.number().int().min(1).max(21).nullish(),
  includedAssessments: z.number().int().min(0).max(1000).nullish(),
  includedReports: z.boolean().optional(),
  includedCommunication: z.boolean().optional(),
  includedFeatures: z.array(z.string().trim().min(1).max(100)).max(50).optional(),
  isPublic: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export const createPlanSchema = base;
export type CreatePlanInput = z.infer<typeof createPlanSchema>;

export const updatePlanSchema = base.partial();
export type UpdatePlanInput = z.infer<typeof updatePlanSchema>;

export const listPlansQuerySchema = z.object({
  activeOnly: z.coerce.boolean().optional(),
  q: z.string().trim().max(200).optional(),
});
export type ListPlansQuery = z.infer<typeof listPlansQuerySchema>;
