import type { CoachInvoiceStatus } from "@prisma/client";

// Lógica determinística de mensalidades (§14). Tudo PURO e em componentes UTC /
// centavos — sem `new Date()` implícito, sem drift de fuso nem de float. É o que
// os testes exercem; o serviço só orquestra I/O em volta.

// Último dia do mês (dia 0 do mês seguinte). month0: 0–11.
export function lastDayOfMonth(year: number, month0: number): number {
  return new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
}

export interface BillingPeriod {
  referencePeriod: string; // "YYYY-MM"
  dueDate: Date; // meia-noite UTC do dia civil de vencimento
}

// Uma competência por mês-calendário no intervalo [from,to] ∩ [start, end].
// Vencimento = billingDay clampeado ao último dia do mês (billingDay 31 em
// fevereiro → 28/29). Datas civis lidas/escritas em UTC (convenção @db.Date).
export function computeBillingPeriods(params: {
  billingDay: number;
  start: Date;
  end: Date | null;
  from: Date;
  to: Date;
}): BillingPeriod[] {
  const ym = (d: Date) => d.getUTCFullYear() * 12 + d.getUTCMonth();
  const startYM = Math.max(ym(params.start), ym(params.from));
  let endYM = ym(params.to);
  if (params.end) endYM = Math.min(endYM, ym(params.end));

  const periods: BillingPeriod[] = [];
  for (let m = startYM; m <= endYM; m++) {
    const year = Math.floor(m / 12);
    const month0 = m % 12;
    const day = Math.min(params.billingDay, lastDayOfMonth(year, month0));
    periods.push({
      referencePeriod: `${year}-${String(month0 + 1).padStart(2, "0")}`,
      dueDate: new Date(Date.UTC(year, month0, day)),
    });
  }
  return periods;
}

// finalAmount = amount − discount + juros + multa (clamp ≥ 0), em centavos.
export function computeInvoiceFinalAmount(
  amount: number,
  discount: number,
  interest: number,
  penalty: number,
): number {
  const cents =
    Math.round(amount * 100) -
    Math.round(discount * 100) +
    Math.round(interest * 100) +
    Math.round(penalty * 100);
  return Math.max(0, cents) / 100;
}

// Status derivado do total pago vs. valor final (comparado em centavos), do
// vencimento e do cancelamento. Ponto único de reconciliação — roda após cada
// pagamento e após editar a fatura.
export function reconcileInvoiceStatus(params: {
  finalAmount: number;
  totalPaid: number;
  dueDate: Date;
  now: Date;
  cancelled: boolean;
}): { status: CoachInvoiceStatus; fullyPaid: boolean } {
  if (params.cancelled) return { status: "CANCELLED", fullyPaid: false };
  const finalCents = Math.round(params.finalAmount * 100);
  const paidCents = Math.round(params.totalPaid * 100);
  if (paidCents >= finalCents) return { status: "PAID", fullyPaid: true };
  if (paidCents > 0) return { status: "PARTIALLY_PAID", fullyPaid: false };
  if (params.now.getTime() > params.dueDate.getTime()) return { status: "OVERDUE", fullyPaid: false };
  return { status: "PENDING", fullyPaid: false };
}
