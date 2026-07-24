import { prisma } from "@/infrastructure/database/prisma";
import { alertWindows } from "./alert-windows";

// Automações simples (§23) como ALERTAS INTERNOS computados na leitura — não há
// tabela de alerta nem scheduler, então também não há notificação duplicada
// (§23). Cada regra é uma contagem sobre o estado atual; a UI mostra o que tem
// count > 0. Disparo externo irreversível está fora de escopo (§23).

export interface AlertsActor {
  userId: string;
  organizationId: string;
}

export const ALERTS_ROLES = ["MANAGER", "HEAD_COACH", "FINANCE", "SUPPORT", "VIEWER"] as const;

export interface Alert {
  key: string;
  label: string;
  count: number;
  severity: "info" | "warn" | "danger";
}

export async function computeAlerts(actor: AlertsActor): Promise<{ alerts: Alert[] }> {
  const w = alertWindows(new Date());
  const org = actor.organizationId;
  const ACTIVE_LEAD_STAGES: ("NEW" | "CONTACTED" | "QUALIFIED" | "TRIAL" | "PROPOSAL" | "NEGOTIATION")[] = [
    "NEW",
    "CONTACTED",
    "QUALIFIED",
    "TRIAL",
    "PROPOSAL",
    "NEGOTIATION",
  ];
  const OPEN_INVOICE: ("PENDING" | "PARTIALLY_PAID" | "OVERDUE")[] = ["PENDING", "PARTIALLY_PAID", "OVERDUE"];

  const [leadsStale, dueTomorrow, overdue, renewing] = await Promise.all([
    // Lead em etapa ativa sem movimentação há 24h (proxy: updatedAt < corte).
    prisma.lead.count({
      where: { organizationId: org, status: { in: ACTIVE_LEAD_STAGES }, updatedAt: { lt: w.cutoff24h } },
    }),
    // Fatura vence amanhã.
    prisma.coachInvoice.count({
      where: { organizationId: org, status: { in: OPEN_INVOICE }, dueDate: { gte: w.tomorrow, lt: w.dayAfter } },
    }),
    // Fatura vencida em aberto.
    prisma.coachInvoice.count({
      where: { organizationId: org, status: { in: OPEN_INVOICE }, dueDate: { lt: w.today } },
    }),
    // Contrato ativo terminando nos próximos 7 dias (renovação à vista).
    prisma.coachClientContract.count({
      where: { organizationId: org, status: "ACTIVE", endDate: { gte: w.today, lt: w.in8days } },
    }),
  ]);

  const alerts: Alert[] = [
    { key: "leads_stale", label: "Leads sem contato há 24h", count: leadsStale, severity: "warn" },
    { key: "invoices_due_tomorrow", label: "Faturas vencendo amanhã", count: dueTomorrow, severity: "info" },
    { key: "invoices_overdue", label: "Faturas vencidas em aberto", count: overdue, severity: "danger" },
    { key: "contracts_renewing", label: "Contratos renovando em 7 dias", count: renewing, severity: "info" },
  ];

  return { alerts: alerts.filter((a) => a.count > 0) };
}
