import { describe, expect, it } from "vitest";
import { AsaasMarketplaceGateway } from "@/modules/marketplace-checkout/asaas-marketplace-gateway";

// verifyWebhook é puro (parse + comparação de segredo + mapa de evento), sem
// rede — dá para testar a parte crítica de segurança do gateway Asaas.

const SECRET = "webhook-secret-123";
const gateway = new AsaasMarketplaceGateway("$aact_hmlg_fake_key", SECRET);

function body(event: string, paymentId = "pay_123") {
  return JSON.stringify({ id: "evt_1", event, payment: { id: paymentId, status: "CONFIRMED" } });
}

describe("AsaasMarketplaceGateway.verifyWebhook", () => {
  it("aceita o token correto e mapeia PAYMENT_CONFIRMED → PAID", async () => {
    const event = await gateway.verifyWebhook({
      rawBody: body("PAYMENT_CONFIRMED"),
      signature: SECRET,
    });
    expect(event.status).toBe("PAID");
    expect(event.reference).toBe("pay_123");
    expect(event.externalEventId).toBe("evt_1");
    expect(event.payloadHash).toHaveLength(64);
  });

  it("PAYMENT_RECEIVED também é PAID (idempotente com CONFIRMED)", async () => {
    const event = await gateway.verifyWebhook({ rawBody: body("PAYMENT_RECEIVED"), signature: SECRET });
    expect(event.status).toBe("PAID");
  });

  it("evento fora do mapa vira PENDING (o webhook-service ignora)", async () => {
    const event = await gateway.verifyWebhook({ rawBody: body("PAYMENT_CREATED"), signature: SECRET });
    expect(event.status).toBe("PENDING");
  });

  it("rejeita token errado", async () => {
    await expect(
      gateway.verifyWebhook({ rawBody: body("PAYMENT_CONFIRMED"), signature: "errado" }),
    ).rejects.toThrow();
  });

  it("rejeita payload sem id/event", async () => {
    await expect(
      gateway.verifyWebhook({ rawBody: JSON.stringify({ foo: "bar" }), signature: SECRET }),
    ).rejects.toThrow();
  });
});
