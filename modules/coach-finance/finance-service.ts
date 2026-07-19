import { prisma } from "@/infrastructure/database/prisma";
import {
  churnRate,
  conversionRate,
  daysLate,
  monthlyValue,
  overdueBucket,
  OVERDUE_BUCKETS,
  simpleLtv,
  ticketMedio,
} from "./finance-math";

// Analítica financeira da assessoria (§15–17): inadimplência e indicadores.
// Só LEITURA/agregação — a matemática mora em finance-math (pura, testada). Tudo
// escopado por organizationId.

export interface FinanceActor {
  userId: string;
  organizationId: string;
}

// Matriz (docs/ENKY_CRM_PERMISSIONS.md): indicadores só MANAGER/FINANCE (OWNER
// passa sozinho); inadimplência também HEAD_COACH/SUPPORT/VIEWER leem.
export const INDICATORS_ROLES = ["MANAGER", "FINANCE"] as const;
export const DELINQUENCY_ROLES = ["MANAGER", "HEAD_COACH", "FINANCE", "SUPPORT", "VIEWER"] as const;

// Faturas ainda abertas (não pagas/canceladas) e já vencidas. Cap defensivo em
// 500 — ponytail: paginar quando uma assessoria real passar disso (§30).
export async function listDelinquency(actor: FinanceActor) {
  const now = new Date();
  const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  const invoices = await prisma.coachInvoice.findMany({
    where: {
      organizationId: actor.organizationId,
      status: { in: ["PENDING", "PARTIALLY_PAID", "OVERDUE"] },
      dueDate: { lt: todayUtc },
    },
    include: {
      client: { select: { id: true, name: true } },
      payer: { select: { id: true, name: true, email: true, phone: true } },
      contract: {
        select: {
          servicePlan: { select: { name: true } },
          athlete: { select: { user: { select: { name: true } } } },
        },
      },
      payments: { select: { amount: true } },
    },
    orderBy: { dueDate: "asc" },
    take: 500,
  });

  const items = invoices
    .map((inv) => {
      const paid = inv.payments.reduce((s, p) => s + Number(p.amount), 0);
      const remaining = Number(inv.finalAmount) - paid;
      const days = daysLate(inv.dueDate, now);
      return {
        id: inv.id,
        clientName: inv.client.name,
        athleteName: inv.contract.athlete?.user?.name ?? null,
        planName: inv.contract.servicePlan.name,
        payerName: inv.payer.name,
        payerEmail: inv.payer.email,
        payerPhone: inv.payer.phone,
        referencePeriod: inv.referencePeriod,
        dueDate: inv.dueDate,
        currency: inv.currency,
        remaining,
        daysLate: days,
        bucket: overdueBucket(days),
      };
    })
    .filter((x) => x.remaining > 0.005);

  const summary = OVERDUE_BUCKETS.map((bucket) => {
    const inBucket = items.filter((i) => i.bucket === bucket);
    return {
      bucket,
      count: inBucket.length,
      total: inBucket.reduce((s, i) => s + i.remaining, 0),
    };
  });
  const totalOverdue = items.reduce((s, i) => s + i.remaining, 0);

  return { items, summary, totalOverdue };
}

// Indicadores do período (default = mês corrente). Fórmulas em finance-math.
export async function computeIndicators(
  actor: FinanceActor,
  range?: { from?: Date; to?: Date },
) {
  const now = new Date();
  const from = range?.from ?? new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const to = range?.to ?? new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const orgId = actor.organizationId;

  const [
    clientesAtivos,
    novosClientes,
    trialsAtivos,
    contratosAtivos,
    cancelamentos,
    leadsNovos,
    leadsGanhos,
    leadsPerdidos,
    previstaAgg,
    pagamentos,
    activeRecurring,
  ] = await Promise.all([
    prisma.client.count({ where: { organizationId: orgId, status: "ACTIVE" } }),
    prisma.client.count({ where: { organizationId: orgId, createdAt: { gte: from, lt: to } } }),
    prisma.client.count({ where: { organizationId: orgId, status: "TRIAL" } }),
    prisma.coachClientContract.count({ where: { organizationId: orgId, status: "ACTIVE" } }),
    prisma.coachClientContract.count({
      where: { organizationId: orgId, status: "CANCELLED", cancelledAt: { gte: from, lt: to } },
    }),
    prisma.lead.count({ where: { organizationId: orgId, createdAt: { gte: from, lt: to } } }),
    prisma.lead.count({ where: { organizationId: orgId, status: "WON", convertedAt: { gte: from, lt: to } } }),
    prisma.lead.count({ where: { organizationId: orgId, status: "LOST", lostAt: { gte: from, lt: to } } }),
    prisma.coachInvoice.aggregate({
      where: { organizationId: orgId, status: { not: "CANCELLED" }, dueDate: { gte: from, lt: to } },
      _sum: { finalAmount: true },
    }),
    prisma.coachPayment.findMany({
      where: { organizationId: orgId, paidAt: { gte: from, lt: to } },
      select: { amount: true, invoice: { select: { payerClientId: true } } },
    }),
    prisma.coachClientContract.findMany({
      where: { organizationId: orgId, status: "ACTIVE", servicePlan: { billingType: "RECURRING" } },
      select: { finalPrice: true, servicePlan: { select: { billingInterval: true } } },
    }),
  ]);

  const receitaRecebida = pagamentos.reduce((s, p) => s + Number(p.amount), 0);
  const payingClients = new Set(pagamentos.map((p) => p.invoice.payerClientId)).size;
  const receitaPrevista = Number(previstaAgg._sum.finalAmount ?? 0);
  const mrr = activeRecurring.reduce(
    (s, c) => s + monthlyValue(Number(c.finalPrice), c.servicePlan.billingInterval),
    0,
  );
  const ticket = ticketMedio(receitaRecebida, payingClients);
  const activeAtStart = contratosAtivos + cancelamentos; // aproximação: ativos agora + cancelados no período
  const churn = churnRate(cancelamentos, activeAtStart);
  const conversao = conversionRate(leadsGanhos, leadsPerdidos);
  const ltv = simpleLtv(ticket, churn);

  const { totalOverdue } = await listDelinquency(actor);

  const hasData =
    clientesAtivos + contratosAtivos + leadsNovos + receitaRecebida + receitaPrevista > 0;

  return {
    period: { from, to },
    currency: "BRL",
    hasData,
    clientesAtivos,
    novosClientes,
    trialsAtivos,
    contratosAtivos,
    leadsNovos,
    leadsGanhos,
    cancelamentos,
    receitaPrevista,
    receitaRecebida,
    receitaVencida: totalOverdue,
    mrr,
    ticketMedio: ticket,
    churn,
    conversao,
    ltv,
  };
}
