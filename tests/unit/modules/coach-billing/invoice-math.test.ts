import { describe, expect, it } from "vitest";
import {
  computeBillingPeriods,
  computeInvoiceFinalAmount,
  lastDayOfMonth,
  reconcileInvoiceStatus,
} from "@/modules/coach-billing/invoice-math";

const d = (iso: string) => new Date(iso);

describe("lastDayOfMonth", () => {
  it("cobre 28/29/30/31", () => {
    expect(lastDayOfMonth(2026, 1)).toBe(28); // fev 2026
    expect(lastDayOfMonth(2028, 1)).toBe(29); // fev bissexto
    expect(lastDayOfMonth(2026, 3)).toBe(30); // abril
    expect(lastDayOfMonth(2026, 0)).toBe(31); // janeiro
  });
});

describe("computeBillingPeriods", () => {
  it("uma competência por mês, vencendo no billingDay", () => {
    const p = computeBillingPeriods({
      billingDay: 10,
      start: d("2026-01-05"),
      end: null,
      from: d("2026-01-01"),
      to: d("2026-03-31"),
    });
    expect(p.map((x) => x.referencePeriod)).toEqual(["2026-01", "2026-02", "2026-03"]);
    expect(p[0]!.dueDate.toISOString().slice(0, 10)).toBe("2026-01-10");
  });

  it("clampa o dia de vencimento em meses curtos (31 → fim do mês)", () => {
    const p = computeBillingPeriods({
      billingDay: 31,
      start: d("2026-01-01"),
      end: null,
      from: d("2026-01-01"),
      to: d("2026-02-28"),
    });
    expect(p[0]!.dueDate.toISOString().slice(0, 10)).toBe("2026-01-31");
    expect(p[1]!.dueDate.toISOString().slice(0, 10)).toBe("2026-02-28");
  });

  it("respeita início e fim do contrato", () => {
    const p = computeBillingPeriods({
      billingDay: 5,
      start: d("2026-02-01"),
      end: d("2026-03-31"),
      from: d("2026-01-01"),
      to: d("2026-12-31"),
    });
    expect(p.map((x) => x.referencePeriod)).toEqual(["2026-02", "2026-03"]);
  });

  it("intervalo vazio quando o início é depois do fim da janela", () => {
    expect(
      computeBillingPeriods({ billingDay: 1, start: d("2027-01-01"), end: null, from: d("2026-01-01"), to: d("2026-12-31") }),
    ).toEqual([]);
  });
});

describe("computeInvoiceFinalAmount", () => {
  it("amount - desconto + juros + multa, exato", () => {
    expect(computeInvoiceFinalAmount(300, 50, 0, 0)).toBe(250);
    expect(computeInvoiceFinalAmount(300, 0, 10.5, 20)).toBe(330.5);
    expect(computeInvoiceFinalAmount(0.3, 0.1, 0, 0)).toBe(0.2);
  });
  it("nunca negativo", () => {
    expect(computeInvoiceFinalAmount(100, 300, 0, 0)).toBe(0);
  });
});

describe("reconcileInvoiceStatus", () => {
  const dueDate = d("2026-07-10");
  it("total pago cobre → PAID", () => {
    expect(reconcileInvoiceStatus({ finalAmount: 100, totalPaid: 100, dueDate, now: d("2026-07-05"), cancelled: false })).toEqual({
      status: "PAID",
      fullyPaid: true,
    });
  });
  it("pago parcial → PARTIALLY_PAID", () => {
    expect(reconcileInvoiceStatus({ finalAmount: 100, totalPaid: 40, dueDate, now: d("2026-07-05"), cancelled: false }).status).toBe(
      "PARTIALLY_PAID",
    );
  });
  it("nada pago e vencido → OVERDUE", () => {
    expect(reconcileInvoiceStatus({ finalAmount: 100, totalPaid: 0, dueDate, now: d("2026-07-20"), cancelled: false }).status).toBe(
      "OVERDUE",
    );
  });
  it("nada pago e a vencer → PENDING", () => {
    expect(reconcileInvoiceStatus({ finalAmount: 100, totalPaid: 0, dueDate, now: d("2026-07-05"), cancelled: false }).status).toBe(
      "PENDING",
    );
  });
  it("cancelada vence tudo", () => {
    expect(reconcileInvoiceStatus({ finalAmount: 100, totalPaid: 100, dueDate, now: d("2026-07-05"), cancelled: true }).status).toBe(
      "CANCELLED",
    );
  });
});
