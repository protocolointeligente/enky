import type { Prisma } from "@prisma/client";
import { ConflictError, NotFoundError } from "@/domain/errors";
import { recordAuditLog } from "@/domain/audit";
import { prisma } from "@/infrastructure/database/prisma";
import { computeLoadState, type LoadState } from "@/modules/intelligence/load-state";
import { classifyReadiness, type ReadinessClass } from "@/modules/intelligence/readiness";
import type { GenerateReportInput } from "./report-schema";

// Relatório simples de período (item 6). Fotografa o que os motores JÁ calculam
// — aderência, carga (CTL/ATL/ACWR) e prontidão — num Report persistido que o
// treinador revisa e compartilha. Linguagem de contexto, nunca diagnóstico
// (Constitution Princípio 16). Escopo org+treinador em toda leitura/escrita.

export interface ReportActor {
  userId: string;
  organizationId: string;
  trainerProfileId: string;
  ipAddress?: string;
  userAgent?: string;
}

const LOAD_WINDOW_DAYS = 90; // histórico para a CTL (42d) fazer sentido

export interface ReportSnapshot {
  period: { start: string; end: string };
  adherence: { due: number; completed: number; partial: number; missed: number; pct: number | null };
  load: LoadState;
  readiness: { count: number; latestClass: ReadinessClass | null };
}

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
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
    select: {
      status: true,
      plannedDate: true,
      feedback: { select: { sessionRpeLoad: true } },
    },
  });

  const loadByDay = new Map<string, number>();
  let completed = 0;
  let partial = 0;
  let missed = 0;
  let due = 0;

  for (const w of workouts) {
    if (w.feedback?.sessionRpeLoad != null) {
      const day = isoDay(w.plannedDate);
      loadByDay.set(day, (loadByDay.get(day) ?? 0) + Number(w.feedback.sessionRpeLoad));
    }
    // Aderência só conta o que estava previsto DENTRO do período do relatório.
    if (w.plannedDate >= periodStart && w.plannedDate <= periodEnd) {
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
        due += 1; // publicado e vencido sem retorno também estava previsto
      }
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
  const latest = checkIns[0];
  const latestClass = latest
    ? classifyReadiness({
        sleepHours: latest.sleepHours != null ? Number(latest.sleepHours) : null,
        sleepQuality: latest.sleepQuality,
        fatigue: latest.fatigue,
        soreness: latest.soreness,
        stress: latest.stress,
        motivation: latest.motivation,
      }).class
    : null;

  return {
    period: { start: isoDay(periodStart), end: isoDay(periodEnd) },
    adherence: {
      due,
      completed,
      partial,
      missed,
      pct: due > 0 ? Math.round(((completed + partial) / due) * 100) : null,
    },
    load: computeLoadState(dailySeries(loadByDay, loadSince, periodEnd)),
    readiness: { count: checkIns.length, latestClass },
  };
}

// Resumo factual (não-diagnóstico) a partir dos números — o treinador edita depois.
function summarize(s: ReportSnapshot): string {
  const parts: string[] = [];
  parts.push(
    s.adherence.pct != null
      ? `Aderência ${s.adherence.pct}% (${s.adherence.completed + s.adherence.partial}/${s.adherence.due} previstos).`
      : "Sem treinos previstos no período para medir aderência.",
  );
  if (s.load.dataDays >= 10 && s.load.acwr != null) {
    parts.push(`Carga: ACWR ${s.load.acwr.toFixed(2)}, CTL ${s.load.ctl.toFixed(0)}.`);
  } else {
    parts.push("Carga: histórico insuficiente para leitura estável (poucos dias com registro).");
  }
  if (s.readiness.latestClass) {
    parts.push(`Prontidão recente: ${s.readiness.latestClass} (${s.readiness.count} check-ins).`);
  }
  return parts.join(" ");
}

export async function generateAthleteReport(
  athleteId: string,
  input: GenerateReportInput,
  actor: ReportActor,
) {
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
        insights: summarize(snapshot),
        limitations:
          "Leitura de contexto do período, não diagnóstico. A qualidade depende da constância dos registros do atleta.",
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

// Publica (compartilha) o relatório com o atleta. Só rascunho pode ser compartilhado.
export async function shareReport(reportId: string, actor: ReportActor, now: Date) {
  const current = await prisma.report.findUnique({ where: { id: reportId } });
  if (
    !current ||
    current.organizationId !== actor.organizationId ||
    current.trainerId !== actor.trainerProfileId
  ) {
    throw new NotFoundError("Relatório não encontrado.");
  }
  if (current.status !== "DRAFT") {
    throw new ConflictError("Somente relatórios em rascunho podem ser compartilhados.");
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

// Atleta só enxerga relatórios COMPARTILHADOS (PUBLISHED) dele.
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
