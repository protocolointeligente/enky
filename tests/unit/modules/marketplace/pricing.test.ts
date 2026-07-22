import { describe, expect, it } from "vitest";
import {
  computeCommission,
  computeCouponDiscount,
  computeOrderTotals,
  roundHalfUp,
} from "@/modules/marketplace/pricing";

describe("roundHalfUp", () => {
  it("arredonda meio-para-cima", () => {
    expect(roundHalfUp(10.4)).toBe(10);
    expect(roundHalfUp(10.5)).toBe(11);
    expect(roundHalfUp(10.6)).toBe(11);
    expect(roundHalfUp(0)).toBe(0);
  });
});

describe("computeCommission", () => {
  it("percentual + taxa fixa, com arredondamento", () => {
    // 15% de R$100,00 = R$15,00 (1500) + R$1,00 fixa = 1600
    const r = computeCommission(10000, { percentage: 15, fixedFeeCents: 100 });
    expect(r.platformFeeCents).toBe(1600);
    expect(r.sellerAmountCents).toBe(8400);
  });

  it("arredonda o percentual meio-para-cima (R$99,99 a 15%)", () => {
    // 9999 * 0.15 = 1499.85 → 1500
    const r = computeCommission(9999, { percentage: 15, fixedFeeCents: 0 });
    expect(r.platformFeeCents).toBe(1500);
    expect(r.sellerAmountCents).toBe(8499);
  });

  it("vendedor nunca fica negativo: comissão é limitada ao bruto", () => {
    const r = computeCommission(1000, { percentage: 100, fixedFeeCents: 5000 });
    expect(r.platformFeeCents).toBe(1000);
    expect(r.sellerAmountCents).toBe(0);
  });

  it("comissão zero devolve tudo ao vendedor", () => {
    const r = computeCommission(4990, { percentage: 0, fixedFeeCents: 0 });
    expect(r).toEqual({ platformFeeCents: 0, sellerAmountCents: 4990 });
  });

  it("rejeita percentual fora de 0..100", () => {
    expect(() => computeCommission(1000, { percentage: 101, fixedFeeCents: 0 })).toThrow();
    expect(() => computeCommission(1000, { percentage: -1, fixedFeeCents: 0 })).toThrow();
  });

  it("rejeita valores não-inteiros de centavos", () => {
    expect(() => computeCommission(10.5, { percentage: 10, fixedFeeCents: 0 })).toThrow();
  });
});

describe("computeCouponDiscount", () => {
  it("percentual", () => {
    expect(computeCouponDiscount(10000, { discountType: "PERCENTAGE", discountValue: 20 })).toBe(2000);
  });

  it("fixo", () => {
    expect(computeCouponDiscount(10000, { discountType: "FIXED", discountValue: 1500 })).toBe(1500);
  });

  it("respeita o teto de desconto", () => {
    const d = computeCouponDiscount(10000, {
      discountType: "PERCENTAGE",
      discountValue: 50,
      maximumDiscountCents: 3000,
    });
    expect(d).toBe(3000);
  });

  it("nunca desconta mais que o subtotal (§36)", () => {
    const d = computeCouponDiscount(1000, { discountType: "FIXED", discountValue: 5000 });
    expect(d).toBe(1000);
  });

  it("erro se abaixo do valor mínimo", () => {
    expect(() =>
      computeCouponDiscount(4000, {
        discountType: "FIXED",
        discountValue: 1000,
        minimumAmountCents: 5000,
      }),
    ).toThrow(/mínimo/);
  });

  it("rejeita percentual > 100", () => {
    expect(() =>
      computeCouponDiscount(1000, { discountType: "PERCENTAGE", discountValue: 150 }),
    ).toThrow();
  });
});

describe("computeOrderTotals", () => {
  it("soma itens, comissão e total sem cupom", () => {
    const t = computeOrderTotals([
      { unitPriceCents: 4990, quantity: 2, commission: { percentage: 10, fixedFeeCents: 0 } },
      { unitPriceCents: 9990, quantity: 1, commission: { percentage: 10, fixedFeeCents: 0 } },
    ]);
    // subtotal = 9980 + 9990 = 19970
    expect(t.subtotalCents).toBe(19970);
    // fee item1 = round(9980*.1)=998 ; item2 = 999 → 1997
    expect(t.platformFeeCents).toBe(1997);
    expect(t.discountCents).toBe(0);
    expect(t.totalCents).toBe(19970);
    expect(t.sellerAmountCents).toBe(19970 - 1997);
  });

  it("aplica cupom: total e líquido do vendedor caem pelo desconto (§26)", () => {
    const t = computeOrderTotals(
      [{ unitPriceCents: 10000, quantity: 1, commission: { percentage: 20, fixedFeeCents: 0 } }],
      { discountType: "PERCENTAGE", discountValue: 10 },
    );
    expect(t.subtotalCents).toBe(10000);
    expect(t.platformFeeCents).toBe(2000);
    expect(t.discountCents).toBe(1000);
    expect(t.totalCents).toBe(9000); // comprador paga
    expect(t.sellerAmountCents).toBe(7000); // 10000 − 2000 − 1000
  });

  it("líquido do vendedor não fica negativo", () => {
    const t = computeOrderTotals(
      [{ unitPriceCents: 1000, quantity: 1, commission: { percentage: 90, fixedFeeCents: 0 } }],
      { discountType: "FIXED", discountValue: 1000 },
    );
    expect(t.sellerAmountCents).toBe(0);
  });

  it("rejeita pedido vazio", () => {
    expect(() => computeOrderTotals([])).toThrow();
  });

  it("rejeita quantidade inválida", () => {
    expect(() =>
      computeOrderTotals([
        { unitPriceCents: 1000, quantity: 0, commission: { percentage: 0, fixedFeeCents: 0 } },
      ]),
    ).toThrow();
  });
});
