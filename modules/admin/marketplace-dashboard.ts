import { prisma } from "@/infrastructure/database/prisma";
import { averageTicket, monthlyFromCycle, takeRatePct } from "./marketplace-dashboard-math";

// Dashboard comercial do superadmin (§16.4). Só leitura/agregação (sem mutação).
// Definições:
//   - GMV: soma do total dos pedidos PAGOS no período (paidAt no intervalo).
//   - comissões: soma do platformFee desses pedidos (receita ENKY do marketplace).
//   - take-rate: comissões / GMV.
//   - ticket médio: GMV / nº de vendas pagas.
//   - reembolsos: pedidos com refundedAt no período (contagem + valor).
//   - MRR: assinaturas SaaS ATIVAS, preço normalizado ao mês (ANUAL/12).
//   - vendedores ativos: com ao menos 1 produto PUBLISHED.
//   - inadimplência: assinaturas PAST_DUE + UNPAID.
// `conversão` (funil visita→compra) fica de fora: não há analítico de tráfego —
// preencher com número inventado violaria a regra de não fabricar dado.

export interface CommercialDashboard {
  periodDays: number;
  gmv: number;
  commissions: number;
  takeRatePct: number;
  sales: number;
  averageTicket: number;
  refunds: number;
  refundedAmount: number;
  mrr: number;
  activeSellers: number;
  publishedProducts: number;
  pendingModeration: number;
  overdueSubscriptions: number;
}

function n(v: { toString(): string } | null | undefined): number {
  return v == null ? 0 : Number(v.toString());
}

export async function getCommercialDashboard(periodDays = 30): Promise<CommercialDashboard> {
  const since = new Date();
  since.setDate(since.getDate() - periodDays);

  const [paid, refunded, activeSubs, activeSellers, publishedProducts, pendingModeration, overdue] =
    await Promise.all([
      prisma.marketplaceOrder.aggregate({
        where: { paidAt: { gte: since } },
        _sum: { total: true, platformFee: true },
        _count: true,
      }),
      prisma.marketplaceOrder.aggregate({
        where: { refundedAt: { gte: since } },
        _sum: { total: true },
        _count: true,
      }),
      prisma.subscription.findMany({
        where: { status: "ACTIVE" },
        select: { plan: { select: { price: true, billingCycle: true } } },
      }),
      prisma.marketplaceSellerProfile.count({ where: { products: { some: { status: "PUBLISHED" } } } }),
      prisma.marketplaceProduct.count({ where: { status: "PUBLISHED" } }),
      prisma.marketplaceProduct.count({ where: { status: "PENDING_REVIEW" } }),
      prisma.subscription.count({ where: { status: { in: ["PAST_DUE", "UNPAID"] } } }),
    ]);

  const gmv = n(paid._sum.total);
  const commissions = n(paid._sum.platformFee);
  const sales = paid._count;
  const mrr = activeSubs.reduce(
    (sum, s) => sum + monthlyFromCycle(n(s.plan.price), s.plan.billingCycle),
    0,
  );

  return {
    periodDays,
    gmv,
    commissions,
    takeRatePct: takeRatePct(gmv, commissions),
    sales,
    averageTicket: averageTicket(gmv, sales),
    refunds: refunded._count,
    refundedAmount: n(refunded._sum.total),
    mrr: Math.round(mrr * 100) / 100,
    activeSellers,
    publishedProducts,
    pendingModeration,
    overdueSubscriptions: overdue,
  };
}
