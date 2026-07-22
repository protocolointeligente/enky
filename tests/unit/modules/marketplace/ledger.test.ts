import { describe, expect, it } from "vitest";
import {
  buildSaleLedgerEntries,
  deriveSellerBalance,
  type LedgerEntryLike,
} from "@/modules/marketplace/ledger";

describe("deriveSellerBalance", () => {
  it("soma por status; HELD e REVERSED não contam", () => {
    const entries: LedgerEntryLike[] = [
      { type: "SALE", amountCents: 10000, status: "PENDING" },
      { type: "PLATFORM_FEE", amountCents: -2000, status: "PENDING" },
      { type: "SALE", amountCents: 5000, status: "AVAILABLE" },
      { type: "GATEWAY_FEE", amountCents: -200, status: "AVAILABLE" },
      { type: "PAYOUT", amountCents: 3000, status: "PAID" },
      { type: "CHARGEBACK", amountCents: -9999, status: "HELD" },
      { type: "REFUND", amountCents: -9999, status: "REVERSED" },
    ];
    expect(deriveSellerBalance(entries)).toEqual({
      pendingCents: 8000,
      availableCents: 4800,
      paidCents: 3000,
    });
  });

  it("ledger vazio => saldo zero", () => {
    expect(deriveSellerBalance([])).toEqual({
      pendingCents: 0,
      availableCents: 0,
      paidCents: 0,
    });
  });
});

describe("buildSaleLedgerEntries", () => {
  it("gera SALE + PLATFORM_FEE pendentes; líquido = gross − fee", () => {
    const entries = buildSaleLedgerEntries({ saleGrossCents: 10000, platformFeeCents: 2000 });
    expect(entries).toHaveLength(2);
    expect(deriveSellerBalance(entries).pendingCents).toBe(8000);
  });

  it("inclui GATEWAY_FEE quando informado", () => {
    const entries = buildSaleLedgerEntries({
      saleGrossCents: 10000,
      platformFeeCents: 2000,
      gatewayFeeCents: 300,
    });
    expect(entries).toHaveLength(3);
    expect(deriveSellerBalance(entries).pendingCents).toBe(7700);
  });

  it("omite GATEWAY_FEE quando zero", () => {
    const entries = buildSaleLedgerEntries({
      saleGrossCents: 10000,
      platformFeeCents: 2000,
      gatewayFeeCents: 0,
    });
    expect(entries).toHaveLength(2);
  });
});
