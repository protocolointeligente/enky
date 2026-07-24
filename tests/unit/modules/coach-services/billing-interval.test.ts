import { describe, expect, it } from "vitest";
import { normalizeBillingInterval } from "@/modules/coach-services/plan-service";

// A regra do §9: intervalo só existe em RECURRING (e é obrigatório nele); nos
// demais tipos é sempre null. Se vazar um intervalo num plano ONE_TIME, o
// contrato/cobrança herdaria uma periodicidade que não deveria existir.
describe("normalizeBillingInterval", () => {
  it("RECURRING exige intervalo e o mantém", () => {
    expect(normalizeBillingInterval("RECURRING", "MONTHLY")).toBe("MONTHLY");
  });

  it("RECURRING sem intervalo é erro", () => {
    expect(() => normalizeBillingInterval("RECURRING", null)).toThrow();
    expect(() => normalizeBillingInterval("RECURRING", undefined)).toThrow();
  });

  it("tipos não-recorrentes zeram o intervalo (mesmo se enviado)", () => {
    expect(normalizeBillingInterval("ONE_TIME", "MONTHLY")).toBeNull();
    expect(normalizeBillingInterval("PACKAGE", "WEEKLY")).toBeNull();
    expect(normalizeBillingInterval("FREE", null)).toBeNull();
    expect(normalizeBillingInterval("CUSTOM", "ANNUAL")).toBeNull();
  });
});
