import { prisma } from "@/infrastructure/database/prisma";
import { confirmPaymentAndDeliver } from "@/modules/marketplace-delivery/delivery-service";
import { getMarketplaceGateway } from "./gateway-factory";

// Handler do webhook do gateway do marketplace (§21). Verifica a assinatura
// (lança em segredo inválido → 401 na rota), deduplica pelo par
// (gateway, externalEventId) e, num evento PAID, confirma+entrega o pedido.
// Sempre idempotente: reenvio do gateway não cobra nem entrega duas vezes.

const GATEWAY = "sandbox";

export type WebhookOutcome = "processed" | "duplicate" | "ignored";

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

export async function handleMarketplaceWebhook(
  rawBody: string,
  signature: string,
): Promise<{ outcome: WebhookOutcome }> {
  const gateway = getMarketplaceGateway();
  // Lança ExternalServiceError se a assinatura não confere — a rota traduz p/ 401.
  const event = await gateway.verifyWebhook({ rawBody, signature });

  const order = await prisma.marketplaceOrder.findFirst({
    where: { gatewayReference: event.reference },
    select: { id: true, paymentStatus: true },
  });

  // Registra o evento cru; o índice único (gateway, externalEventId) é a barreira
  // de idempotência. Colisão = já recebido → duplicate, nada a fazer.
  try {
    await prisma.marketplacePaymentEvent.create({
      data: {
        gateway: GATEWAY,
        externalEventId: event.externalEventId,
        eventType: event.eventType,
        payloadHash: event.payloadHash,
        orderId: order?.id,
        status: "RECEIVED",
      },
    });
  } catch (error) {
    if (isUniqueViolation(error)) return { outcome: "duplicate" };
    throw error;
  }

  async function markEvent(status: string, failureReason?: string): Promise<void> {
    await prisma.marketplacePaymentEvent.updateMany({
      where: { gateway: GATEWAY, externalEventId: event.externalEventId },
      data: { status, processedAt: new Date(), failureReason },
    });
  }

  // Sem pedido correspondente, ou evento que não é pagamento confirmado: ignora.
  if (!order || event.status !== "PAID") {
    await markEvent("IGNORED");
    return { outcome: "ignored" };
  }
  if (order.paymentStatus === "PAID") {
    await markEvent("PROCESSED");
    return { outcome: "duplicate" };
  }

  try {
    await confirmPaymentAndDeliver(order.id);
  } catch (error) {
    await markEvent("FAILED", error instanceof Error ? error.message : "erro desconhecido");
    throw error;
  }
  await markEvent("PROCESSED");
  return { outcome: "processed" };
}
