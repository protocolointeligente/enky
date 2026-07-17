import { z } from "zod";

// Contrato do `Report.metricsSnapshot` — núcleo PURO (sem prisma, sem React),
// compartilhado pelo serviço (que grava) e pelo report-document (que lê para
// virar PDF/tela). Versionado: o relatório é uma FOTOGRAFIA do período, então
// mudar o formato não pode reinterpretar relatório antigo — snapshot de versão
// desconhecida é declarado insuficiente, nunca adivinhado (Princípio 16).

export const REPORT_SNAPSHOT_VERSION = "2.0.0";

// Limiares de suficiência. Abaixo deles o relatório DECLARA a insuficiência em
// vez de exibir um número que o dado não sustenta.
export const MIN_LOAD_DATA_DAYS = 10; // dias com carga registrada para CTL/ATL/ACWR
export const MIN_READINESS_CHECKINS = 3; // check-ins para falar de prontidão
export const MAX_REPORT_COMMENTS = 8; // comentários mais relevantes no documento

const loadStateSchema = z.object({
  ctl: z.number(),
  atl: z.number(),
  tsb: z.number(),
  acwr: z.number().nullable(),
  monotony: z.number().nullable(),
  strain: z.number().nullable(),
  rampPct: z.number().nullable(),
  dataDays: z.number(),
});

export const reportSnapshotSchema = z.object({
  version: z.literal(REPORT_SNAPSHOT_VERSION),
  period: z.object({ start: z.string(), end: z.string(), days: z.number() }),
  adherence: z.object({
    due: z.number(),
    completed: z.number(),
    partial: z.number(),
    missed: z.number(),
    pending: z.number(),
    pct: z.number().nullable(),
  }),
  volume: z.object({
    sessions: z.number(),
    minutes: z.number(),
    distanceKm: z.number(),
    byModality: z.array(
      z.object({ modality: z.string(), sessions: z.number(), minutes: z.number() }),
    ),
  }),
  internalLoad: z.object({
    total: z.number(),
    weeklyAverage: z.number().nullable(),
    sessionsWithLoad: z.number(),
    sessionsWithoutLoad: z.number(),
  }),
  load: loadStateSchema,
  readiness: z.object({
    count: z.number(),
    latestClass: z.enum(["boa", "atencao", "baixa", "insuficiente"]).nullable(),
    latestScore: z.number().nullable(),
    averageScore: z.number().nullable(),
  }),
  comments: z.array(
    z.object({
      date: z.string(),
      workoutTitle: z.string(),
      notes: z.string(),
      painLevel: z.number().nullable(),
    }),
  ),
});

export type ReportSnapshot = z.infer<typeof reportSnapshotSchema>;

/**
 * Lê um `metricsSnapshot` cru do banco. Devolve `null` quando o formato não é
 * o desta versão (relatório legado v1, por exemplo) — quem chama declara a
 * insuficiência em vez de interpretar campos que podem não significar o mesmo.
 */
export function parseReportSnapshot(raw: unknown): ReportSnapshot | null {
  const parsed = reportSnapshotSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

// Só falamos de CTL/ATL/TSB/ACWR com histórico que sustente a EWMA de 42d.
export function hasLoadSufficiency(snapshot: ReportSnapshot): boolean {
  return snapshot.load.dataDays >= MIN_LOAD_DATA_DAYS && snapshot.load.acwr != null;
}

export function hasReadinessSufficiency(snapshot: ReportSnapshot): boolean {
  return snapshot.readiness.count >= MIN_READINESS_CHECKINS;
}

export function hasAdherenceSufficiency(snapshot: ReportSnapshot): boolean {
  return snapshot.adherence.due > 0;
}
