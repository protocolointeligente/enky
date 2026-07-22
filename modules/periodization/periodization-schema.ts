import { z } from "zod";

// Camada estratégica da periodização (produto v1 → Fase 04). O treinador desenha
// o macrociclo: identidade, modalidade, objetivo, janela, estrutura (meso/micro),
// controle de carga e parâmetros por modalidade. As semanas são derivadas da
// janela pelo serviço. Um plano pode ser salvo como RASCUNHO (`isDraft`) com
// menos campos preenchidos; um plano "completo" exige modalidade e objetivo.
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data deve ser YYYY-MM-DD.");

// Espelha o enum Prisma `Modality`.
export const MODALITIES = [
  "RUNNING",
  "STRENGTH",
  "FUNCTIONAL",
  "CYCLING",
  "SWIMMING",
  "TRIATHLON",
] as const;

// Listas fechadas para os dropdowns (reduzem digitação e erro — Interface Spec).
export const PERIODIZATION_LEVELS = ["INICIANTE", "INTERMEDIARIO", "AVANCADO", "ELITE"] as const;
export const LOAD_CONTROL_METHODS = ["RPE", "PACE", "POWER", "HR", "VELOCITY", "TONNAGE"] as const;
export const DIFFICULTY_DISTRIBUTIONS = ["LINEAR", "ONDULATORIA", "POLARIZADA", "EM_BLOCOS"] as const;

// Parâmetros por modalidade (multiesporte ≠ genérico — Constitution §13). Todos
// opcionais: a UI mostra os relevantes à modalidade escolhida. Guardado como JSON
// em `Periodization.parameters`, sempre validado aqui, nunca lido cru.
export const periodizationParametersSchema = z
  .object({
    // corrida / endurance
    vdot: z.number().positive().max(100).optional(),
    pace: z.string().trim().max(20).optional(), // "mm:ss/km"
    // ciclismo
    ftp: z.number().int().positive().max(2000).optional(), // watts
    tss: z.number().nonnegative().max(2000).optional(),
    // natação
    css: z.string().trim().max(20).optional(), // ritmo crítico
    pacePer100m: z.string().trim().max(20).optional(),
    // transversais endurance
    hrZone: z.string().trim().max(40).optional(),
    rpeTarget: z.number().min(0).max(10).optional(),
    distanceKm: z.number().nonnegative().max(100000).optional(),
    durationMin: z.number().nonnegative().max(100000).optional(),
    // musculação
    frequency: z.number().int().min(0).max(14).optional(),
    sets: z.number().int().min(0).max(100).optional(),
    reps: z.string().trim().max(40).optional(), // "8-12"
    rir: z.number().min(0).max(10).optional(),
    tonnage: z.number().nonnegative().max(1_000_000).optional(),
    muscleGroups: z.array(z.string().trim().max(40)).max(20).optional(),
    // funcional
    movementPattern: z.string().trim().max(80).optional(),
    density: z.string().trim().max(40).optional(),
    equipment: z.array(z.string().trim().max(40)).max(20).optional(),
  })
  .strict();

export type PeriodizationParameters = z.infer<typeof periodizationParametersSchema>;

const phaseInputSchema = z
  .object({
    name: z.string().trim().min(1, "Informe o nome da fase.").max(80),
    startDate: isoDate,
    endDate: isoDate,
    targetVolumeKm: z.number().nonnegative().max(10000).optional(),
    targetIntensity: z.string().trim().max(120).optional(),
  })
  .refine((p) => p.startDate <= p.endDate, {
    message: "Início da fase deve ser anterior ou igual ao fim.",
    path: ["startDate"],
  });

export const createPeriodizationInputSchema = z
  .object({
    title: z.string().trim().min(1, "Informe um título.").max(120),
    goal: z.string().trim().max(200).default(""),
    modality: z.enum(MODALITIES).optional(),
    targetEvent: z.string().trim().max(160).optional(),
    level: z.enum(PERIODIZATION_LEVELS).optional(),
    loadControlMethod: z.enum(LOAD_CONTROL_METHODS).optional(),
    mainUnit: z.string().trim().max(20).optional(),
    totalVolume: z.number().nonnegative().max(10_000_000).optional(),
    mesocycleCount: z.number().int().min(0).max(52).optional(),
    microcycleCount: z.number().int().min(0).max(208).optional(),
    recoveryStrategy: z.string().trim().max(120).optional(),
    difficultyDistribution: z.enum(DIFFICULTY_DISTRIBUTIONS).optional(),
    autoGenerate: z.boolean().default(false),
    isDraft: z.boolean().default(false),
    notes: z.string().trim().max(2000).optional(),
    parameters: periodizationParametersSchema.optional(),
    startDate: isoDate,
    endDate: isoDate,
    phases: z.array(phaseInputSchema).max(12).default([]),
  })
  .refine((d) => d.startDate <= d.endDate, {
    message: "Início do plano deve ser anterior ou igual ao fim.",
    path: ["startDate"],
  })
  .refine((d) => d.phases.every((p) => p.startDate >= d.startDate && p.endDate <= d.endDate), {
    message: "As fases devem ficar dentro da janela do plano.",
    path: ["phases"],
  })
  // Rascunho pode ficar incompleto; um plano "completo" exige objetivo e
  // modalidade — sem eles a geração de sessões não sabe o que sugerir.
  .refine((d) => d.isDraft || d.goal.trim().length > 0, {
    message: "Informe o objetivo (ou salve como rascunho).",
    path: ["goal"],
  })
  .refine((d) => d.isDraft || d.modality != null, {
    message: "Informe a modalidade (ou salve como rascunho).",
    path: ["modality"],
  });

export type CreatePeriodizationInput = z.infer<typeof createPeriodizationInputSchema>;
