import { prisma } from "@/infrastructure/database/prisma";

// Admin básico (Fase 1): leitura transversal (cross-tenant) do que a plataforma
// já registra. Sem escopo de organização — o papel ADMIN/SUPERADMIN vê tudo.
// O guard de papel na rota é a fronteira de autorização; este módulo apenas lê.

export interface PlatformStats {
  trainers: number;
  athletes: number;
  organizations: number;
  workouts: number;
  reports: number;
  auditEvents: number;
}

export async function getPlatformStats(): Promise<PlatformStats> {
  const [trainers, athletes, organizations, workouts, reports, auditEvents] = await Promise.all([
    prisma.trainerProfile.count(),
    prisma.athleteProfile.count(),
    prisma.organization.count(),
    prisma.workout.count(),
    prisma.report.count(),
    prisma.auditLog.count(),
  ]);
  return { trainers, athletes, organizations, workouts, reports, auditEvents };
}

const MAX_AUDIT_ROWS = 200;

export interface ListAuditOptions {
  action?: string;
  limit?: number;
}

// Trilha append-only ordenada do mais recente. `actions` = valores distintos
// presentes, para popular o filtro da UI a partir de dados reais.
export async function listAuditLogs(opts: ListAuditOptions) {
  const take = Math.min(Math.max(opts.limit ?? 50, 1), MAX_AUDIT_ROWS);

  const [logs, distinct] = await Promise.all([
    prisma.auditLog.findMany({
      where: opts.action ? { action: opts.action } : undefined,
      orderBy: { createdAt: "desc" },
      take,
      include: {
        user: { select: { name: true, email: true } },
        organization: { select: { name: true } },
      },
    }),
    prisma.auditLog.findMany({
      distinct: ["action"],
      select: { action: true },
      orderBy: { action: "asc" },
    }),
  ]);

  return { logs, actions: distinct.map((d) => d.action) };
}
