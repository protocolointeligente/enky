import { describe, expect, it } from "vitest";
import {
  churnRate,
  conversionRate,
  daysLate,
  monthlyValue,
  overdueBucket,
  simpleLtv,
  ticketMedio,
} from "@/modules/coach-finance/finance-math";

const d = (iso: string) => new Date(iso);

describe("daysLate / overdueBucket", () => {
  it("conta dias civis de atraso", () => {
    expect(daysLate(d("2026-07-10"), d("2026-07-10T23:00:00Z"))).toBe(0);
    expect(daysLate(d("2026-07-10"), d("2026-07-12T05:00:00Z"))).toBe(2);
  });
  it("não fica negativo antes do vencimento", () => {
    expect(daysLate(d("2026-07-20"), d("2026-07-10"))).toBe(0);
  });
  it("classifica nas faixas do §15", () => {
    expect(overdueBucket(1)).toBe("1-7");
    expect(overdueBucket(7)).toBe("1-7");
    expect(overdueBucket(8)).toBe("8-15");
    expect(overdueBucket(30)).toBe("16-30");
    expect(overdueBucket(45)).toBe("31-60");
    expect(overdueBucket(61)).toBe("60+");
  });
});

describe("fórmulas do §17", () => {
  it("ticket médio protege divisão por zero", () => {
    expect(ticketMedio(1000, 4)).toBe(250);
    expect(ticketMedio(1000, 0)).toBe(0);
  });
  it("churn = cancelados / ativos no início", () => {
    expect(churnRate(2, 20)).toBe(0.1);
    expect(churnRate(1, 0)).toBe(0);
  });
  it("conversão = ganhos / encerrados", () => {
    expect(conversionRate(3, 1)).toBe(0.75);
    expect(conversionRate(0, 0)).toBe(0);
  });
  it("normaliza periodicidade para mensal", () => {
    expect(monthlyValue(300, "MONTHLY")).toBe(300);
    expect(monthlyValue(3600, "ANNUAL")).toBe(300);
    expect(monthlyValue(900, "QUARTERLY")).toBe(300);
  });
  it("LTV = ticket / churn, 0 sem churn", () => {
    expect(simpleLtv(250, 0.1)).toBe(2500);
    expect(simpleLtv(250, 0)).toBe(0);
  });
});
