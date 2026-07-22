import type { Prisma } from "@prisma/client";
import { ConflictError, NotFoundError } from "@/domain/errors";
import { recordAuditLog } from "@/domain/audit";
import { prisma } from "@/infrastructure/database/prisma";
import { computeLoadState } from "@/modules/intelligence/load-state";
import { classifyReadiness } from "@/modules/intelligence/readiness";
import type { GenerateReportInput } from "./report-schema";
import { buildReportDocument, type ReportDocument } from "./report-document";
import {
  MAX_REPORT_COMMENTS,
  REPORT_SNAPSHOT_VERSION,
  type ReportSnapshot,
} from "./report-snapshot";
import { requireTrainerAccessToAthlete } from "@/server/auth/guards";

// Relatório de período (Fase 8 — premium). Fotografa o que os motores JÁ
// calculam — aderência, volume, carga interna, estado de carga (CTL/ATL/TSB/
// ACWR) e prontidão — num Report DRAFT que o treinador revisa, publica e pode
// revogar. Linguagem de contexto, nunca diagnóstico (Constitution Princípio
// 16): o serviço só MEDE; a redação vive em report-document.ts e as
// interpretações são campos do treinador. Escopo org+treinador+atleta em toda
// leitura/escrita.

export interface ReportActor {
  userId: string;
  organizationId: string;
  trainerProfileId: string;
  ipAddress?: string;
  userAgent?: string;
}

const LOAD_WINDOW_DAYS = 90; // histórico para a CTL (42d) fazer sentido

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function dayCount(start: Date, end: Date): number {
  return Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;
}

// Série diária contínua (zero nos dias sem treino) — mesma base do motor de carga.
function dailySeries(loadByDay: Map<string, number>, since: Date, end: Date): number[] {
  const out: number[] = [];
  const cursor = new Date(since);
  cursor.setHours(0, 0, 0, 0);
  const stop = new Date(end);
  stop.setHours(0, 0, 0, 0);
  while (cursor <= stop) {
    out.push(loadByDay.get(isoDay(cursor)) ?? 0);
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

async function computeSnapshot(
  organizationId: string,
  athleteId: string,
  periodStart: Date,
  periodEnd: Date,
): Promise<ReportSnapshot> {
  const loadSince = new Date(periodEnd);
  loadSince.setDate(loadSince.getDate() - LOAD_WINDOW_DAYS);

  const workouts = await prisma.workout.findMany({
    where: { organizationId, athleteId, plannedDate: { gte: loadSince, lte: periodEnd } },
    orderBy: { plannedDate: "asc" },
    select: {
      title: true,
      status: true,
      modality: true,
      plannedDate: true,
      feedback: {
        select: {
          sessionRpeLoad: true,
          actualDurationMinutes: true,
          actualDistanceKm: true,
          notes: true,
          painLevel: true,
        },
      },
    },
  });

  const loadByDay = new Map<string, number>();
  const byModality = new Map<string, { sessions: number; minutes: number }>();
  const comments: ReportSnapshot["comments"] = [];

  let completed = 0;
  let partial = 0;
  let missed = 0;
  let pending = 0;
  let due = 0;

  let volumeSessions = 0;
  let volumeMinutes = 0;
  let volumeDistanceKm = 0;
  let loadTotal = 0;
  let sessionsWithLoad = 0;
  let sessionsWithoutLoad = 0;

  for (const w of workouts) {
    // A CARGA usa a janela longa (90d) — a EWMA da CTL precisa do histórico
    // anterior ao período para não começar do zero.
    if (w.feedback?.sessionRpeLoad != null) {
      const day = isoDay(w.plannedDate);
      loadByDay.set(day, (loadByDay.get(day) ?? 0) + Number(w.feedback.sessionRpeLoad));
    }

    const inPeriod = w.plannedDate >= periodStart && w.plannedDate <= periodEnd;
    if (!inPeriod) continue;

    // ADERÊNCIA só conta o que estava previsto DENTRO do período do relatório.
    if (w.status === "COMPLETED") {
      completed += 1;
      due += 1;
    } else if (w.status === "PARTIAL") {
      partial += 1;
      due += 1;
    } else if (w.status === "MISSED") {
      missed += 1;
      due += 1;
    } else if (w.status === "PUBLISHED" && w.plannedDate < periodEnd) {
      pending += 1;
      due += 1; // publicado e vencido sem retorno também estava previsto
    }

    // VOLUME e CARGA INTERNA contam apenas o que foi de fato realizado.
    const realized = w.status === "COMPLETED" || w.status === "PARTIAL";
    if (realized) {
      volumeSessions += 1;
      const minutes = w.feedback?.actualDurationMinutes ?? 0;
      volumeMinutes += minutes;
      volumeDistanceKm += w.feedback?.actualDistanceKm ? Number(w.feedback.actualDistanceKm) : 0;

      const modality = byModality.get(w.modality) ?? { sessions: 0, minutes: 0 };
      modality.sessions += 1;
      modality.minutes += minutes;
      byModality.set(w.modality, modality);

      if (w.feedback?.sessionRpeLoad != null) {
        loadTotal += Number(w.feedback.sessionRpeLoad);
        sessionsWithLoad += 1;
      } else {
        sessionsWithoutLoad += 1;
      }
    }

    const notes = w.feedback?.notes?.trim();
    if (notes) {
      comments.push({
        date: isoDay(w.plannedDate),
        workoutTitle: w.title,
        notes,
        painLevel: w.feedback?.painLevel ?? null,
      });
    }
  }

  const checkIns = await prisma.readinessCheckIn.findMany({
    where: { organizationId, athleteId, checkInDate: { gte: periodStart, lte: periodEnd } },
    orderBy: { checkInDate: "desc" },
    select: {
      sleepHours: true,
      sleepQuality: true,
      fatigue: true,
      soreness: true,
      stress: true,
      motivation: true,
    },
  });

  const readinessResults = checkIns.map((c) =>
    classifyReadiness({
      sleepHours: c.sleepHours != null ? Number(c.sleepHours) : null,
      sleepQuality: c.sleepQuality,
      fatigue: c.fatigue,
      soreness: c.soreness,
      stress: c.stress,
      motivation: c.motivation,
    }),
  );
  const scores = readinessResults.map((r) => r.score).filter((s): s is number => s != null);
  const latest = readinessResults[0];

  const periodDays = dayCount(periodStart, periodEnd);

  return {
    version: REPORT_SNAPSHOT_VERSION,
    period: { start: isoDay(periodStart), end: isoDay(periodEnd), days: periodDays },
    adherence: {
      due,
      completed,
      partial,
      missed,
      pending,
      pct: due > 0 ? Math.round(((completed + partial) / due) * 100) : null,
    },
    volume: {
      sessions: volumeSessions,
      minutes: volumeMinutes,
      distanceKm: Math.round(volumeDistanceKm * 10) / 10,
      byModality: [...byModality.entries()]
        .map(([modality, v]) => ({ modality, ...v }))
        .sort((a, b) => b.sessions - a.sessions || a.modality.localeCompare(b.modality)),
    },
    internalLoad: {
      total: Math.round(loadTotal),
      weeklyAverage:
        periodDays >= 7 && sessionsWithLoad > 0 ? Math.round(loadTotal / (periodDays / 7)) : null,
      sessionsWithLoad,
      sessionsWithoutLoad,
    },
    load: computeLoadState(dailySeries(loadByDay, loadSince, periodEnd)),
    readiness: {
      count: checkIns.length,
      latestClass: latest?.class ?? null,
      latestScore: latest?.score ?? null,
      averageScore:
        scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
    },
    // Relevância: dor relatada primeiro (é o que o treinador não pode perder de
    // vista), depois o mais recente. Sem resumir nem reescrever o que o atleta
    // disse — o corte é de quantidade, nunca de conteúdo.
    comments: comments
      .sort((a, b) => (b.painLevel ?? 0) - (a.painLevel ?? 0) || b.date.localeCompare(a.date))
      .slice(0, MAX_REPORT_COMMENTS),
  };
}

export async function generateAthleteReport(
  athleteId: string,
  input: GenerateReportInput,
  actor: ReportActor,
) {
  await requireTrainerAccessToAthlete(actor.organizationId, actor.trainerProfileId, athleteId);
  const periodStart = new Date(`${input.periodStart}T00:00:00.000Z`);
  const periodEnd = new Date(`${input.periodEnd}T00:00:00.000Z`);
  const snapshot = await computeSnapshot(actor.organizationId, athleteId, periodStart, periodEnd);

  return prisma.$transaction(async (tx) => {
    const report = await tx.report.create({
      data: {
        organizationId: actor.organizationId,
        athleteId,
        trainerId: actor.trainerProfileId,
        status: "DRAFT",
        periodStart,
        periodEnd,
        metricsSnapshot: snapshot as unknown as Prisma.InputJsonValue,
        // `insights`/`recommendations` nascem VAZIOS de propósito: o resumo
        // executivo é derivado do snapshot pelo report-document. Pré-preencher
        // esses campos assinaria uma interpretação como se fosse do treinador.
        insights: null,
        recommendations: null,
        limitations: null,
      },
    });

    await recordAuditLog(tx, {
      action: "GENERATE_REPORT",
      entityName: "Report",
      entityId: report.id,
      userId: actor.userId,
      organizationId: actor.organizationId,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    return report;
  });
}

// Publica (compartilha) o relatório com o atleta. Rascunho ou relatório cujo
// compartilhamento foi revogado podem ser (re)publicados.
export async function shareReport(reportId: string, actor: ReportActor, now: Date) {
  const current = await requireOwnedReport(reportId, actor);
  if (current.status !== "DRAFT" && current.status !== "REVOKED") {
    throw new ConflictError(
      "Somente relatórios em rascunho ou com compartilhamento revogado podem ser compartilhados.",
    );
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.report.update({
      where: { id: reportId },
      data: { status: "PUBLISHED", sharedAt: now, lockVersion: { increment: 1 } },
    });
    await recordAuditLog(tx, {
      action: "SHARE_REPORT",
      entityName: "Report",
      entityId: reportId,
      userId: actor.userId,
      organizationId: actor.organizationId,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });
    return updated;
  });
}

/**
 * Revoga o compartilhamento: o relatório some para o atleta imediatamente.
 * Mantemos a linha (auditoria e histórico do treinador) e zeramos `sharedAt` —
 * o registro de QUE foi compartilhado vive no AuditLog, não aqui.
 */
export async function revokeReport(reportId: string, actor: ReportActor) {
  const current = await requireOwnedReport(reportId, actor);
  if (current.status !== "PUBLISHED") {
    throw new ConflictError("Somente relatórios compartilhados podem ser revogados.");
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.report.update({
      where: { id: reportId },
      data: { status: "REVOKED", sharedAt: null, lockVersion: { increment: 1 } },
    });
    await recordAuditLog(tx, {
      action: "REVOKE_REPORT",
      entityName: "Report",
      entityId: reportId,
      userId: actor.userId,
      organizationId: actor.organizationId,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });
    return updated;
  });
}

// Escopo org+treinador — a porta única por onde toda escrita do treinador passa.
async function requireOwnedReport(reportId: string, actor: ReportActor) {
  const report = await prisma.report.findUnique({ where: { id: reportId } });
  if (
    !report ||
    report.organizationId !== actor.organizationId ||
    report.trainerId !== actor.trainerProfileId
  ) {
    throw new NotFoundError("Relatório não encontrado.");
  }
  return report;
}

export async function listTrainerReports(athleteId: string, actor: ReportActor) {
  return prisma.report.findMany({
    where: {
      organizationId: actor.organizationId,
      trainerId: actor.trainerProfileId,
      athleteId,
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getTrainerReport(reportId: string, actor: ReportActor) {
  return requireOwnedReport(reportId, actor);
}

// Atleta só enxerga relatórios COMPARTILHADOS (PUBLISHED) dele. Revogado e
// rascunho não existem para ele — nem na lista, nem no acesso direto por id.
export async function listAthleteReports(organizationId: string, athleteProfileId: string) {
  return prisma.report.findMany({
    where: { organizationId, athleteId: athleteProfileId, status: "PUBLISHED" },
    orderBy: { sharedAt: "desc" },
  });
}

export async function getAthleteReport(
  reportId: string,
  organizationId: string,
  athleteProfileId: string,
) {
  const report = await prisma.report.findUnique({ where: { id: reportId } });
  if (
    !report ||
    report.organizationId !== organizationId ||
    report.athleteId !== athleteProfileId ||
    report.status !== "PUBLISHED"
  ) {
    throw new NotFoundError("Relatório não encontrado.");
  }
  return report;
}

// --- Documento premium (tela e PDF) ---------------------------------------

interface ReportRow {
  id: string;
  status: string;
  athleteId: string;
  trainerId: string;
  periodStart: Date;
  periodEnd: Date;
  metricsSnapshot: unknown;
  insights: string | null;
  recommendations: string | null;
  limitations: string | null;
  createdAt: Date;
}

export interface ReportEntry<T extends ReportRow = ReportRow> {
  report: T;
  document: ReportDocument;
}

// O Report guarda só ids; os nomes vêm daqui. Resolvidos em duas consultas
// para o lote inteiro — uma lista de relatórios não vira N+1. Devolve os PARES
// já montados (e não dois arrays para casar por índice), para o tipo do
// documento nunca ficar opcional na resposta da API.
async function documentsFor<T extends ReportRow>(reports: T[]): Promise<ReportEntry<T>[]> {
  if (reports.length === 0) return [];

  const [athletes, trainers] = await Promise.all([
    prisma.athleteProfile.findMany({
      where: { id: { in: [...new Set(reports.map((r) => r.athleteId))] } },
      select: { id: true, user: { select: { name: true } } },
    }),
    prisma.trainerProfile.findMany({
      where: { id: { in: [...new Set(reports.map((r) => r.trainerId))] } },
      select: { id: true, user: { select: { name: true } } },
    }),
  ]);

  const athleteName = new Map(athletes.map((a) => [a.id, a.user?.name ?? null]));
  const trainerName = new Map(trainers.map((t) => [t.id, t.user?.name ?? null]));

  return reports.map((report) => ({
    report,
    document: buildReportDocument({
      report,
      athleteName: athleteName.get(report.athleteId) ?? null,
      trainerName: trainerName.get(report.trainerId) ?? null,
    }),
  }));
}

async function documentFor<T extends ReportRow>(report: T): Promise<ReportDocument> {
  const [entry] = await documentsFor([report]);
  if (!entry) throw new NotFoundError("Relatório não encontrado.");
  return entry.document;
}

export async function getTrainerReportDocument(reportId: string, actor: ReportActor) {
  return documentFor(await requireOwnedReport(reportId, actor));
}

export async function listTrainerReportDocuments(athleteId: string, actor: ReportActor) {
  return documentsFor(await listTrainerReports(athleteId, actor));
}

// Passa pelo MESMO guarda de leitura do atleta: revogado/rascunho não geram PDF.
export async function getAthleteReportDocument(
  reportId: string,
  organizationId: string,
  athleteProfileId: string,
) {
  return documentFor(await getAthleteReport(reportId, organizationId, athleteProfileId));
}

export async function listAthleteReportDocuments(organizationId: string, athleteProfileId: string) {
  return documentsFor(await listAthleteReports(organizationId, athleteProfileId));
}
