import { z } from "zod";

// Perfil e preferências do atleta (§12). Preferências ficam num JSON validado
// (User.preferences). Dado de saúde (peso/altura/nascimento/gênero) vive em
// AthleteProfile e é editado à parte — nunca vai para logs.

export const UNIT_SYSTEMS = ["METRIC", "IMPERIAL"] as const;
export const DATE_FORMATS = ["DMY", "MDY", "YMD"] as const;
export const LANGUAGES = ["pt-BR", "en-US"] as const;

// Categorias de notificação (alinhadas às do Web Push §14).
export const NOTIFICATION_CATEGORIES = [
  "workoutPublished",
  "workoutChanged",
  "workoutReminder",
  "coachMessage",
  "readinessCheckin",
  "feedbackPending",
  "payment",
  "contract",
  "accountAlert",
] as const;

export const preferencesSchema = z
  .object({
    units: z.enum(UNIT_SYSTEMS).optional(),
    language: z.enum(LANGUAGES).optional(),
    dateFormat: z.enum(DATE_FORMATS).optional(),
    // IANA tz (ex.: America/Sao_Paulo). Validação leve — só formato plausível.
    timezone: z.string().min(3).max(64).regex(/^[A-Za-z_+\-/]+$/).optional(),
    sports: z.array(z.enum(["RUNNING", "STRENGTH", "FUNCTIONAL", "CYCLING", "SWIMMING", "TRIATHLON"])).max(6).optional(),
    trainingPrefs: z
      .object({
        preferredDays: z.array(z.number().int().min(0).max(6)).max(7).optional(),
        preferredTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
        sessionDurationMin: z.number().int().min(5).max(600).optional(),
      })
      .strict()
      .optional(),
    notifications: z.record(z.enum(NOTIFICATION_CATEGORIES), z.boolean()).optional(),
  })
  .strict();
export type Preferences = z.infer<typeof preferencesSchema>;

// Dados pessoais (parte do perfil que NÃO é saúde).
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data deve ser YYYY-MM-DD.");

export const updateProfileSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    // Dados corporais (saúde) — opcionais; `.nullable()` limpa.
    birthDate: isoDate.nullable().optional(),
    gender: z.string().trim().max(40).nullable().optional(),
    weightKg: z.number().positive().max(500).nullable().optional(),
    heightCm: z.number().positive().max(300).nullable().optional(),
    preferences: preferencesSchema.optional(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: "Nada para atualizar." });
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const accountDeletionSchema = z.object({
  // Confirmação explícita para operação destrutiva (§12).
  confirm: z.literal(true),
  reason: z.string().trim().max(500).optional(),
});
