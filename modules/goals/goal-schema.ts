import { z } from "zod";

// Contrato das metas do atleta (§11). Métricas-alvo heterogêneas ficam num JSON
// `targets` validado (nunca lido cru), com unidades declaradas para o front e
// futuros consumidores não adivinharem.

export const GOAL_TYPES = [
  "RACE",
  "PERFORMANCE",
  "CONDITIONING",
  "HEALTH",
  "BODY_COMPOSITION",
  "ADHERENCE",
  "RETURN_TO_SPORT",
  "CUSTOM",
] as const;
export type GoalType = (typeof GOAL_TYPES)[number];

export const GOAL_PRIORITIES = ["LOW", "MEDIUM", "HIGH"] as const;
export const GOAL_STATUSES = ["ACTIVE", "ACHIEVED", "MISSED", "PAUSED", "ARCHIVED"] as const;
export const GOAL_MODALITIES = ["RUNNING", "STRENGTH", "FUNCTIONAL", "CYCLING", "SWIMMING", "TRIATHLON"] as const;

// UNIDADES: distanceKm=km, timeSeconds=s, paceSecondsPerKm=s/km, powerWatts=W,
// bodyFatPct=%, weightKg=kg. Todas opcionais (uma meta declara só o que faz sentido).
export const goalTargetsSchema = z
  .object({
    distanceKm: z.number().positive().max(1000).optional(),
    timeSeconds: z.number().int().positive().max(864_000).optional(),
    paceSecondsPerKm: z.number().positive().max(3600).optional(),
    powerWatts: z.number().int().positive().max(2500).optional(),
    bodyFatPct: z.number().min(1).max(70).optional(),
    weightKg: z.number().positive().max(500).optional(),
  })
  .strict();

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data deve ser YYYY-MM-DD.");

export const createGoalSchema = z.object({
  title: z.string().trim().min(2).max(120),
  type: z.enum(GOAL_TYPES),
  modality: z.enum(GOAL_MODALITIES).optional(),
  targetEvent: z.string().trim().max(160).optional(),
  targetDate: isoDate.optional(),
  weeklyFrequency: z.number().int().min(0).max(21).optional(),
  targets: goalTargetsSchema.optional(),
  priority: z.enum(GOAL_PRIORITIES).default("MEDIUM"),
  notes: z.string().trim().max(2000).optional(),
});
export type CreateGoalInput = z.infer<typeof createGoalSchema>;

// Update parcial + lockVersion (concorrência otimista). `.nullable()` permite
// limpar um campo; o refine garante que há pelo menos um campo além do lockVersion.
export const updateGoalSchema = z
  .object({
    title: z.string().trim().min(2).max(120).optional(),
    type: z.enum(GOAL_TYPES).optional(),
    modality: z.enum(GOAL_MODALITIES).nullable().optional(),
    targetEvent: z.string().trim().max(160).nullable().optional(),
    targetDate: isoDate.nullable().optional(),
    weeklyFrequency: z.number().int().min(0).max(21).nullable().optional(),
    targets: goalTargetsSchema.nullable().optional(),
    priority: z.enum(GOAL_PRIORITIES).optional(),
    status: z.enum(GOAL_STATUSES).optional(),
    progress: z.number().int().min(0).max(100).optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
    lockVersion: z.number().int().positive(),
  })
  .refine((o) => Object.keys(o).length > 1, { message: "Nada para atualizar." });
export type UpdateGoalInput = z.infer<typeof updateGoalSchema>;

export const goalCommentSchema = z.object({
  note: z.string().trim().min(1).max(2000),
});
export type GoalCommentInput = z.infer<typeof goalCommentSchema>;
