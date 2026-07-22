import { BusinessRuleError, ValidationError } from "@/domain/errors";

// Aritmética monetária do marketplace em CENTAVOS inteiros (BRL). Inteiros não
// driftam como float — reais/Decimal(12,2) só na borda de persistência (×100).
// Funções puras: testáveis sem banco. Regras: §26 (comissão), §36 (cupom).

export interface CommissionRuleInput {
  /** 0..100 — ex.: 15 = 15%. */
  percentage: number;
  /** Taxa fixa por item, em centavos. */
  fixedFeeCents: number;
}

export interface CommissionResult {
  platformFeeCents: number;
  sellerAmountCents: number;
}

export interface OrderItemInput {
  unitPriceCents: number;
  quantity: number;
  commission: CommissionRuleInput;
}

export interface CouponInput {
  discountType: "PERCENTAGE" | "FIXED";
  /** PERCENTAGE: 0..100 ; FIXED: centavos. */
  discountValue: number;
  minimumAmountCents?: number | null;
  maximumDiscountCents?: number | null;
}

export interface OrderItemTotal {
  grossCents: number;
  platformFeeCents: number;
  sellerAmountCents: number;
}

export interface OrderTotals {
  items: OrderItemTotal[];
  subtotalCents: number;
  discountCents: number;
  platformFeeCents: number;
  /** Líquido do vendedor = subtotal − desconto − comissão. Taxa de gateway é
   * aplicada depois, na liquidação do ledger (não é conhecida no cálculo). */
  sellerAmountCents: number;
  /** O que o comprador paga = subtotal − desconto. */
  totalCents: number;
}

// Meio-para-cima: convenção comercial (0,5 centavo sobe). Só para valores ≥ 0.
export function roundHalfUp(value: number): number {
  return Math.floor(value + 0.5);
}

function assertNonNegativeInt(value: number, field: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new ValidationError(`${field} deve ser inteiro não-negativo (centavos).`);
  }
}

// Comissão sobre o valor bruto de um item (unitPrice × quantidade).
// platformFee = round(gross × pct/100) + fixedFee, limitado a [0, gross] para
// o vendedor nunca ficar negativo.
export function computeCommission(grossCents: number, rule: CommissionRuleInput): CommissionResult {
  assertNonNegativeInt(grossCents, "grossCents");
  assertNonNegativeInt(rule.fixedFeeCents, "fixedFeeCents");
  if (rule.percentage < 0 || rule.percentage > 100) {
    throw new ValidationError("Percentual de comissão deve estar entre 0 e 100.");
  }
  const pctFee = roundHalfUp((grossCents * rule.percentage) / 100);
  const platformFeeCents = Math.min(pctFee + rule.fixedFeeCents, grossCents);
  return { platformFeeCents, sellerAmountCents: grossCents - platformFeeCents };
}

// Desconto do cupom sobre o subtotal (§36): checa mínimo, respeita teto, nunca
// excede o subtotal. Erro de regra de negócio se o subtotal for menor que o
// mínimo exigido pelo cupom.
export function computeCouponDiscount(subtotalCents: number, coupon: CouponInput): number {
  assertNonNegativeInt(subtotalCents, "subtotalCents");
  if (coupon.discountValue < 0) {
    throw new ValidationError("Valor do desconto não pode ser negativo.");
  }
  if (coupon.discountType === "PERCENTAGE" && coupon.discountValue > 100) {
    throw new ValidationError("Desconto percentual não pode passar de 100%.");
  }
  if (coupon.minimumAmountCents != null && subtotalCents < coupon.minimumAmountCents) {
    throw new BusinessRuleError("Valor do pedido abaixo do mínimo do cupom.");
  }
  let discount =
    coupon.discountType === "PERCENTAGE"
      ? roundHalfUp((subtotalCents * coupon.discountValue) / 100)
      : coupon.discountValue;
  if (coupon.maximumDiscountCents != null) {
    discount = Math.min(discount, coupon.maximumDiscountCents);
  }
  return Math.min(discount, subtotalCents); // nunca desconto maior que o total
}

// Totais do pedido. Comissão por item sobre o bruto; o desconto do cupom é do
// comprador (sai do total pago) e reduz o líquido do vendedor (§26:
// líquido = bruto − desconto − comissão − taxa de gateway; gateway aplicado
// na liquidação). O desconto é de nível de pedido — não é rateado por item,
// então os itens somam (subtotal − comissão) e o pedido subtrai o desconto.
export function computeOrderTotals(items: OrderItemInput[], coupon?: CouponInput): OrderTotals {
  if (items.length === 0) {
    throw new ValidationError("Pedido precisa de ao menos um item.");
  }
  const itemTotals: OrderItemTotal[] = items.map((item) => {
    if (!Number.isInteger(item.quantity) || item.quantity < 1) {
      throw new ValidationError("Quantidade do item deve ser inteiro ≥ 1.");
    }
    assertNonNegativeInt(item.unitPriceCents, "unitPriceCents");
    const grossCents = item.unitPriceCents * item.quantity;
    const { platformFeeCents, sellerAmountCents } = computeCommission(grossCents, item.commission);
    return { grossCents, platformFeeCents, sellerAmountCents };
  });

  const subtotalCents = itemTotals.reduce((sum, i) => sum + i.grossCents, 0);
  const platformFeeCents = itemTotals.reduce((sum, i) => sum + i.platformFeeCents, 0);
  const discountCents = coupon ? computeCouponDiscount(subtotalCents, coupon) : 0;
  const totalCents = subtotalCents - discountCents;
  const sellerAmountCents = Math.max(0, subtotalCents - platformFeeCents - discountCents);

  return { items: itemTotals, subtotalCents, discountCents, platformFeeCents, sellerAmountCents, totalCents };
}
