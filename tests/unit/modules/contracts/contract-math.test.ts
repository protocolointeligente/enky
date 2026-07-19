import { describe, expect, it } from "vitest";
import { computeFinalPrice, resolveCancellationFields } from "@/modules/contracts/contract-service";

// O valor final é dinheiro: precisa ser exato (centavos) e nunca negativo — um
// finalPrice errado vira mensalidade errada lá na frente.
describe("computeFinalPrice", () => {
  it("subtrai desconto do preço", () => {
    expect(computeFinalPrice(300, 50)).toBe(250);
  });

  it("é exato em casos que quebram no float ingênuo", () => {
    // 100 - 0.3 seria 99.69999999 em float direto; via centavos = 99.7
    expect(computeFinalPrice(100, 0.3)).toBe(99.7);
    expect(computeFinalPrice(0.3, 0.1)).toBe(0.2);
  });

  it("nunca fica negativo", () => {
    expect(computeFinalPrice(100, 150)).toBe(0);
  });

  it("sem desconto retorna o preço", () => {
    expect(computeFinalPrice(197, 0)).toBe(197);
  });
});

const now = new Date("2026-07-19T12:00:00Z");

describe("resolveCancellationFields", () => {
  it("marca cancelledAt + motivo ao cancelar", () => {
    expect(resolveCancellationFields("CANCELLED", "inadimplência", { cancelledAt: null }, now)).toEqual({
      cancelledAt: now,
      cancellationReason: "inadimplência",
    });
  });

  it("preserva o cancelledAt já existente", () => {
    const earlier = new Date("2026-01-01T00:00:00Z");
    expect(
      resolveCancellationFields("CANCELLED", "x", { cancelledAt: earlier }, now).cancelledAt,
    ).toBe(earlier);
  });

  it("qualquer status não-cancelado zera os campos de cancelamento", () => {
    expect(resolveCancellationFields("ACTIVE", "resto", { cancelledAt: now }, now)).toEqual({
      cancelledAt: null,
      cancellationReason: null,
    });
  });
});
