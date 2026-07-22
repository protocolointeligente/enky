import { z } from "zod";

// Todos os 9 tipos do enum MarketplaceProductType.
const PRODUCT_TYPES = [
  "TRAINING_PLAN",
  "COACHING_SERVICE",
  "ASSESSMENT_SERVICE",
  "PERIODIZATION_TEMPLATE",
  "WORKOUT_TEMPLATE_PACK",
  "EXERCISE_LIBRARY_PACK",
  "EDUCATIONAL_CONTENT",
  "CONSULTATION",
  "EVENT_PROGRAM",
] as const;

export const ensureSellerProfileSchema = z.object({
  displayName: z.string().min(2).max(80),
  headline: z.string().max(160).optional(),
  bio: z.string().max(2000).optional(),
});

export const createProductSchema = z.object({
  title: z.string().min(3).max(120),
  productType: z.enum(PRODUCT_TYPES),
  // Preço em CENTAVOS inteiros na borda HTTP; convertido p/ Decimal na persistência.
  priceCents: z.number().int().positive(),
  shortDescription: z.string().max(280).optional(),
  fullDescription: z.string().max(5000).optional(),
  // Conteúdo entregável (templates do próprio treinador); opcional neste MVP.
  workoutTemplateIds: z.array(z.string().uuid()).optional(),
});

export type EnsureSellerProfileBody = z.infer<typeof ensureSellerProfileSchema>;
export type CreateProductBody = z.infer<typeof createProductSchema>;
