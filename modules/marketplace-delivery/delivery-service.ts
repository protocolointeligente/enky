import type { Prisma } from "@prisma/client";
import { prisma } from "@/infrastructure/database/prisma";
import { NotFoundError } from "@/domain/errors";
import { buildSaleLedgerEntries } from "@/modules/marketplace/ledger";
import { initialEntitlementStatus } from "./delivery-payload";

// Confirma o pagamento de um pedido e executa a entrega (§22/§23). Tudo numa
// transação: marca PAID, concede um Entitlement por item (idempotente via
// orderItemId único) e lança a venda no ledger (fonte de verdade do saldo).
// Idempotente: se o pedido já está PAID, não faz nada — reprocessar webhook é
// seguro.
//
// ponytail: a ENTREGA aqui grava o entitlement (registro de acesso). A cópia
// efetiva do conteúdo (periodização/templates para a conta do comprador) é a
// próxima fatia — o plano de entrega já está no deliveryPayload do item.

function toCents(dec: Prisma.Decimal | number): number {
  return Math.round(Number(dec) * 100);
}
function centsToDecimal(cents: number): string {
  return (cents / 100).toFixed(2);
}

export async function confirmPaymentAndDeliver(orderId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const order = await tx.marketplaceOrder.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!order) throw new NotFoundError("Pedido não encontrado para entrega.");
    if (order.paymentStatus === "PAID") return; // idempotente

    const now = new Date();
    await tx.marketplaceOrder.update({
      where: { id: orderId },
      data: { paymentStatus: "PAID", status: "PAID", paidAt: now },
    });

    let anyManual = false;
    for (const item of order.items) {
      const status = initialEntitlementStatus(item.productType);
      if (status === "PENDING") anyManual = true;

      await tx.marketplaceEntitlement.upsert({
        where: { orderItemId: item.id },
        create: {
          buyerUserId: order.buyerUserId,
          buyerOrganizationId: order.buyerOrganizationId,
          orderId: order.id,
          orderItemId: item.id,
          productId: item.productId,
          productVersionId: item.productVersionId,
          entitlementType: item.productType,
          status,
          startsAt: status === "ACTIVE" ? now : null,
          deliveryPayload: (item.deliveryPayload ?? undefined) as Prisma.InputJsonValue | undefined,
        },
        update: {}, // já entregue: não mexe
      });

      // Ledger: crédito da venda + débito da comissão, PENDING até a janela.
      if (item.sellerProfileId) {
        const entries = buildSaleLedgerEntries({
          saleGrossCents: toCents(item.unitPrice) * item.quantity,
          platformFeeCents: toCents(item.platformFee),
        });
        for (const e of entries) {
          await tx.marketplaceLedgerEntry.create({
            data: {
              sellerProfileId: item.sellerProfileId,
              sellerOrganizationId: item.sellerOrganizationId,
              orderId: order.id,
              orderItemId: item.id,
              type: e.type,
              amount: centsToDecimal(e.amountCents),
              currency: order.currency,
              status: "PENDING",
              description: `${e.type} · pedido ${order.id}`,
            },
          });
        }
      }
    }

    await tx.marketplaceOrder.update({
      where: { id: orderId },
      data: {
        deliveryStatus: anyManual ? "PROCESSING" : "DELIVERED",
        status: anyManual ? "PROCESSING" : "COMPLETED",
      },
    });
  });
}
