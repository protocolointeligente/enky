import { z } from "zod";
import { MODALITIES } from "@/modules/periodization/periodization-schema";

// Contrato de dados das avaliações (fatia A). Cada tipo de avaliação tem um
// conjunto tipado de MEDIÇÕES, validado por Zod e guardado em Assessment.measurements
// (JSON, nunca lido cru) — mesmo padrão de Periodization.parameters. As FÓRMULAS
// de zona que consomem estes valores são a fatia C; aqui só garantimos entradas
// consistentes e com unidades declaradas.
//
// UNIDADES (contrato, para o motor de zonas não adivinhar):
//   - FC: batimentos por minuto (bpm).
//   - pace: SEGUNDOS por quilômetro (o front formata mm:ss; o banco guarda número).
//   - velocidade: km/h.
//   - potência: watts.
//   - pace de natação: SEGUNDOS por 100 m.
//   - carga/1RM: kg.
//   - durações/tempos de teste: segundos.

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data deve ser YYYY-MM-DD.");

export const ASSESSMENT_TYPES = [
  "HEART_RATE",
  "RUNNING",
  "CYCLING",
  "SWIMMING",
  "STRENGTH",
  "BODY_COMPOSITION",
] as const;
export type AssessmentType = (typeof ASSESSMENT_TYPES)[number];

export const ASSESSMENT_SOURCES = [
  "MEASURED",
  "ESTIMATED",
  "IMPORTED",
  "MANUAL",
  "DEVICE",
  "LAB",
  "FIELD_TEST",
] as const;

export const CONFIDENCE_LEVELS = ["LOW", "MODERATE", "HIGH", "NOT_ASSESSED"] as const;

const bpm = z.number().int().min(20).max(250);
const secondsPerKm = z.number().min(90).max(1200); // 1:30–20:00 /km
const secondsPer100m = z.number().min(30).max(400); // natação
const kmh = z.number().min(3).max(60);
const watts = z.number().int().min(30).max(2500);
const kg = z.number().min(0).max(1000);
const seconds = z.number().int().min(1).max(86_400);

// ── Medições por tipo (todas .strict(): chave desconhecida é erro) ──────────

export const heartRateMeasurements = z
  .object({
    restingHeartRate: bpm.optional(),
    maximumHeartRate: bpm.optional(),
    thresholdHeartRate: bpm.optional(),
    // Como a FC máx foi obtida — importa para não substituir medida por estimada.
    measurementMethod: z
      .enum(["MEDIDA", "ESTIMADA_POR_IDADE", "TESTE_DE_CAMPO", "TESTE_LABORATORIAL", "LIMIAR"])
      .optional(),
  })
  .strict()
  .refine((m) => m.maximumHeartRate != null || m.thresholdHeartRate != null, {
    message: "Informe ao menos FC máxima ou FC de limiar.",
  });

export const runningMeasurements = z
  .object({
    vdot: z.number().min(20).max(90).optional(),
    vam: kmh.optional(), // velocidade aeróbia máxima
    criticalSpeed: kmh.optional(),
    thresholdPace: secondsPerKm.optional(),
    pace3k: secondsPerKm.optional(),
    pace5k: secondsPerKm.optional(),
    pace10k: secondsPerKm.optional(),
    halfMarathonPace: secondsPerKm.optional(),
    marathonPace: secondsPerKm.optional(),
    testDistanceMeters: z.number().int().min(100).max(100_000).optional(),
    testDurationSeconds: seconds.optional(),
  })
  .strict()
  .refine(
    (m) =>
      m.vdot != null ||
      m.vam != null ||
      m.criticalSpeed != null ||
      m.thresholdPace != null ||
      m.pace5k != null,
    { message: "Informe ao menos um indicador (VDOT, VAM, velocidade crítica, pace de limiar ou 5k)." },
  );

export const cyclingMeasurements = z
  .object({
    ftp: watts.optional(),
    criticalPower: watts.optional(),
    maxPower: watts.optional(),
    thresholdHeartRate: bpm.optional(),
    testDurationSeconds: seconds.optional(),
  })
  .strict()
  .refine((m) => m.ftp != null || m.criticalPower != null, {
    message: "Informe FTP ou potência crítica.",
  });

export const swimmingMeasurements = z
  .object({
    css: secondsPer100m.optional(), // critical swim speed como ritmo /100m
    criticalSwimSpeed: secondsPer100m.optional(),
    pacePer100m: secondsPer100m.optional(),
    test400mSeconds: seconds.optional(),
    test200mSeconds: seconds.optional(),
  })
  .strict()
  .refine((m) => m.css != null || m.criticalSwimSpeed != null || m.pacePer100m != null, {
    message: "Informe CSS, velocidade crítica de natação ou ritmo /100 m.",
  });

export const strengthMeasurements = z
  .object({
    exerciseId: z.string().uuid().optional(),
    oneRepMax: kg.optional(),
    estimatedOneRepMax: kg.optional(),
    testLoadKg: kg.optional(),
    testRepetitions: z.number().int().min(1).max(30).optional(),
    // Fórmula usada para estimar 1RM (a matemática vive na fatia C).
    formulaCode: z.enum(["ONE_RM_DIRECT", "EPLEY", "BRZYCKI", "LANDER", "O_CONNER"]).optional(),
    formulaVersion: z.string().max(20).optional(),
  })
  .strict()
  .refine((m) => m.oneRepMax != null || (m.testLoadKg != null && m.testRepetitions != null), {
    message: "Informe 1RM direto, ou carga e repetições do teste.",
  });

// Composição corporal: preparada no modelo, NÃO integra o motor de zonas nesta
// etapa. Sem refine obrigatório — é um registro informativo.
export const bodyCompositionMeasurements = z
  .object({
    weightKg: kg.optional(),
    bodyFatPercentage: z.number().min(1).max(70).optional(),
    leanMassKg: kg.optional(),
    method: z.enum(["SKINFOLD", "BIA", "DEXA", "HYDROSTATIC", "OTHER"]).optional(),
  })
  .strict();

export const MEASUREMENTS_BY_TYPE = {
  HEART_RATE: heartRateMeasurements,
  RUNNING: runningMeasurements,
  CYCLING: cyclingMeasurements,
  SWIMMING: swimmingMeasurements,
  STRENGTH: strengthMeasurements,
  BODY_COMPOSITION: bodyCompositionMeasurements,
} as const;

// ── Cabeçalho da avaliação + medições validadas pelo tipo ───────────────────

export const createAssessmentInputSchema = z
  .object({
    assessmentType: z.enum(ASSESSMENT_TYPES),
    modality: z.enum(MODALITIES).optional(),
    protocolCode: z.string().trim().min(1, "Informe o protocolo.").max(60),
    protocolVersion: z.string().trim().max(20).default("1.0.0"),
    assessmentDate: isoDate,
    source: z.enum(ASSESSMENT_SOURCES).default("MANUAL"),
    confidence: z.enum(CONFIDENCE_LEVELS).default("NOT_ASSESSED"),
    validUntil: isoDate.optional(),
    notes: z.string().trim().max(2000).optional(),
    // Validado contra o schema do tipo no superRefine abaixo.
    measurements: z.record(z.string(), z.unknown()),
  })
  .refine((d) => d.validUntil == null || d.validUntil >= d.assessmentDate, {
    message: "Validade deve ser posterior à data da avaliação.",
    path: ["validUntil"],
  })
  .superRefine((d, ctx) => {
    const result = MEASUREMENTS_BY_TYPE[d.assessmentType].safeParse(d.measurements);
    if (!result.success) {
      for (const issue of result.error.issues) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: issue.message,
          path: ["measurements", ...issue.path],
        });
      }
    }
  });

export type CreateAssessmentInput = z.infer<typeof createAssessmentInputSchema>;
