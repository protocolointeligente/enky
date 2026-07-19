// Saldo do vendedor é DERIVADO do ledger (§28) — nunca um número mutável solto.
// Ledger é append-only; amountCents é assinado (+crédito / −débito). Puro.

export type LedgerEntryType =
  | "SALE"
  | "PLATFORM_FEE"
  | "GATEWAY_FEE"
  | "REFUND"
  | "CHARGEBACK"
  | "PAYOUT"
  | "ADJUSTMENT";

export type LedgerEntryStatus = "PENDING" | "AVAILABLE" | "HELD" | "PAID" | "REVERSED";

export interface LedgerEntryLike {
  type: LedgerEntryType;
  /** Centavos assinados: crédito positivo, débito negativo. */
  amountCents: number;
  status: LedgerEntryStatus;
}

export interface SellerBalance {
  pendingCents: number;
  availableCents: number;
  paidCents: number;
}

// Soma por bucket de status. HELD e REVERSED não entram em nenhum saldo
// (retidos / estornados). PAID acumula o que já foi repassado.
export function deriveSellerBalance(entries: LedgerEntryLike[]): SellerBalance {
  const balance: SellerBalance = { pendingCents: 0, availableCents: 0, paidCents: 0 };
  for (const entry of entries) {
    if (entry.status === "PENDING") balance.pendingCents += entry.amountCents;
    else if (entry.status === "AVAILABLE") balance.availableCents += entry.amountCents;
    else if (entry.status === "PAID") balance.paidCents += entry.amountCents;
  }
  return balance;
}

export interface SaleLedgerInput {
  saleGrossCents: number;
  platformFeeCents: number;
  /** Taxa do gateway na liquidação; 0 se ainda desconhecida. */
  gatewayFeeCents?: number;
}

// Lançamentos de uma venda: crédito SALE + débitos PLATFORM_FEE / GATEWAY_FEE,
// todos PENDING até a janela de disponibilidade (§28/§43). O líquido pendente
// do vendedor é a soma destes = gross − platformFee − gatewayFee.
export function buildSaleLedgerEntries(input: SaleLedgerInput): LedgerEntryLike[] {
  const entries: LedgerEntryLike[] = [
    { type: "SALE", amountCents: input.saleGrossCents, status: "PENDING" },
    { type: "PLATFORM_FEE", amountCents: -input.platformFeeCents, status: "PENDING" },
  ];
  const gatewayFee = input.gatewayFeeCents ?? 0;
  if (gatewayFee > 0) {
    entries.push({ type: "GATEWAY_FEE", amountCents: -gatewayFee, status: "PENDING" });
  }
  return entries;
}
