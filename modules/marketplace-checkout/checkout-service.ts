import type { Prisma } from "@prisma/client";
import { prisma } from "@/infrastructure/database/prisma";
import { NotFoundError } from "@/domain/errors";
import { type CommissionRuleInput, computeOrderTotals } from "@/modules/marketplace/pricing";
import { type MarketplacePaymentMethod } from "./gateway";
import { getMarketplaceGateway } from "./gateway-factory";

// Orquestra a criação de um pedido de 1 produto e abre o checkout no gateway
// (§19). Idempotente por idempotencyKey: retentativa do comprador devolve o
// pedido existente, nunca cobra duas vezes. Preço travado no priceSnapshot da
// versão publicada — o `price` em edição do produto nunca entra no checkout.

// Comissão padrão da plataforma: ENKY fica com 10% da venda, vendedor com 90%
// (modelo de repasse do marketplace; a assinatura B2B da plataforma é 100% ENKY
// e não passa por aqui). Regra específica cadastrada em MarketplaceCommissionRule
// sobrepõe este default.
const DEFAULT_COMMISSION: CommissionRuleInput = { percentage: 10, fixedFeeCents: 0 };

function toCents(dec: Prisma.Decimal | number): number {
  return Math.round(Number(dec) * 100);
}
function centsToDecimal(cents: number): string {
  return (cents / 100).toFixed(2);
}

async function resolveCommission(productType: string): Promise<CommissionRuleInput> {
  const rule = await prisma.marketplaceCommissionRule.findFirst({
    where: {
      isActive: true,
      effectiveFrom: { lte: new Date() },
      OR: [{ productType: productType as never }, { productType: null }],
    },
    // regra específica de tipo ganha da genérica; entre iguais, a mais recente.
    orderBy: [{ productType: "desc" }, { effectiveFrom: "desc" }],
  });
  if (!rule) return DEFAULT_COMMISSION;
  return { percentage: Number(rule.percentage), fixedFeeCents: toCents(rule.fixedFee) };
}

export interface CreateOrderInput {
  buyerUserId: string;
  buyerName: string;
  buyerEmail: string;
  productSlug: string;
  idempotencyKey: string;
  method: MarketplacePaymentMethod;
}

export interface CreateOrderResult {
  orderId: string;
  reference: string;
  status: string;
  amountCents: number;
  paymentUrl?: string;
  pixCode?: string;
  alreadyExisted: boolean;
}

export async function createMarketplaceOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
  // Idempotência: mesma chave → mesmo pedido, sem recriar nem recobrar.
  const existing = await prisma.marketplaceOrder.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
  });
  if (existing) {
    return {
      orderId: existing.id,
      reference: existing.gatewayReference ?? "",
      status: existing.status,
      amountCents: toCents(existing.total),
      alreadyExisted: true,
    };
  }

  const product = await prisma.marketplaceProduct.findFirst({
    where: { slug: input.productSlug, status: "PUBLISHED", visibility: "PUBLIC", publishedVersionId: { not: null } },
    include: { publishedVersion: true, sellerProfile: { select: { id: true } } },
  });
  if (!product || !product.publishedVersion) {
    throw new NotFoundError("Produto não disponível para compra.");
  }

  const commission = await resolveCommission(product.productType);
  const unitPriceCents = toCents(product.publishedVersion.priceSnapshot);
  const currency = product.publishedVersion.currency;
  const totals = computeOrderTotals([{ unitPriceCents, quantity: 1, commission }]);

  const order = await prisma.marketplaceOrder.create({
    data: {
      buyerUserId: input.buyerUserId,
      currency,
      subtotal: centsToDecimal(totals.subtotalCents),
      discount: centsToDecimal(totals.discountCents),
      platformFee: centsToDecimal(totals.platformFeeCents),
      sellerAmount: centsToDecimal(totals.sellerAmountCents),
      total: centsToDecimal(totals.totalCents),
      status: "PENDING_PAYMENT",
      paymentStatus: "PENDING",
      deliveryStatus: "PENDING",
      gateway: "sandbox",
      idempotencyKey: input.idempotencyKey,
      items: {
        create: {
          productId: product.id,
          productVersionId: product.publishedVersion.id,
          sellerProfileId: product.sellerProfileId,
          sellerOrganizationId: product.sellerOrganizationId,
          sellerUserId: product.sellerUserId,
          title: product.title,
          productType: product.productType,
          quantity: 1,
          unitPrice: centsToDecimal(unitPriceCents),
          platformFee: centsToDecimal(totals.platformFeeCents),
          sellerAmount: centsToDecimal(totals.sellerAmountCents),
          commissionSnapshot: commission as unknown as Prisma.InputJsonValue,
          // Snapshot do conteúdo que a entrega vai conceder (§22).
          deliveryPayload: product.publishedVersion.contentSnapshot ?? undefined,
        },
      },
    },
  });

  const gateway = getMarketplaceGateway();
  const checkout = await gateway.createCheckout({
    orderId: order.id,
    idempotencyKey: input.idempotencyKey,
    amountCents: totals.totalCents,
    currency,
    method: input.method,
    buyerName: input.buyerName,
    buyerEmail: input.buyerEmail,
  });

  await prisma.marketplaceOrder.update({
    where: { id: order.id },
    data: { gatewayReference: checkout.reference },
  });

  return {
    orderId: order.id,
    reference: checkout.reference,
    status: order.status,
    amountCents: totals.totalCents,
    paymentUrl: checkout.paymentUrl,
    pixCode: checkout.pixCode,
    alreadyExisted: false,
  };
}
