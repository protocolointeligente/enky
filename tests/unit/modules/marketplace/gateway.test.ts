import { describe, expect, it } from "vitest";
import {
  SandboxMarketplaceGateway,
  hashPayload,
  signWebhook,
  verifyWebhookSignature,
  type CreateMarketplaceCheckoutInput,
} from "@/modules/marketplace-checkout/gateway";

const SECRET = "whsec_test_1234567890";

function checkoutInput(over: Partial<CreateMarketplaceCheckoutInput> = {}): CreateMarketplaceCheckoutInput {
  return {
    orderId: "order-1",
    idempotencyKey: "idem-abc",
    amountCents: 4990,
    currency: "BRL",
    method: "PIX",
    buyerName: "Fulano",
    buyerEmail: "f@example.com",
    ...over,
  };
}

describe("verifyWebhookSignature", () => {
  it("aceita assinatura correta", () => {
    const body = '{"id":"e1"}';
    expect(verifyWebhookSignature(body, signWebhook(body, SECRET), SECRET)).toBe(true);
  });

  it("rejeita corpo adulterado", () => {
    const sig = signWebhook('{"id":"e1"}', SECRET);
    expect(verifyWebhookSignature('{"id":"e1","x":1}', sig, SECRET)).toBe(false);
  });

  it("rejeita segredo errado", () => {
    const body = '{"id":"e1"}';
    expect(verifyWebhookSignature(body, signWebhook(body, SECRET), "outro")).toBe(false);
  });

  it("rejeita assinatura vazia sem estourar", () => {
    expect(verifyWebhookSignature('{"id":"e1"}', "", SECRET)).toBe(false);
  });
});

describe("SandboxMarketplaceGateway", () => {
  it("exige segredo", () => {
    expect(() => new SandboxMarketplaceGateway("")).toThrow();
  });

  it("createCheckout é idempotente: mesma chave, mesma referência", async () => {
    const gw = new SandboxMarketplaceGateway(SECRET);
    const a = await gw.createCheckout(checkoutInput());
    const b = await gw.createCheckout(checkoutInput());
    expect(a.reference).toBe(b.reference);
    expect(a.status).toBe("PENDING");
    expect(a.pixCode).toBeDefined();
  });

  it("rejeita valor não-positivo", async () => {
    const gw = new SandboxMarketplaceGateway(SECRET);
    await expect(gw.createCheckout(checkoutInput({ amountCents: 0 }))).rejects.toThrow();
  });

  it("webhook simulado passa pela verificação e traz o hash do payload", async () => {
    const gw = new SandboxMarketplaceGateway(SECRET);
    const { reference } = await gw.createCheckout(checkoutInput());
    const wh = gw.simulateWebhook(reference, "PAID");
    const event = await gw.verifyWebhook(wh);
    expect(event.reference).toBe(reference);
    expect(event.status).toBe("PAID");
    expect(event.payloadHash).toBe(hashPayload(wh.rawBody));
    expect(await gw.getPaymentStatus(reference)).toBe("PAID");
  });

  it("webhook com assinatura adulterada é rejeitado", async () => {
    const gw = new SandboxMarketplaceGateway(SECRET);
    const wh = gw.simulateWebhook("sbx_x", "PAID");
    await expect(gw.verifyWebhook({ ...wh, signature: "deadbeef" })).rejects.toThrow();
  });

  it("refund marca REFUNDED", async () => {
    const gw = new SandboxMarketplaceGateway(SECRET);
    const r = await gw.refundPayment({ reference: "sbx_x" });
    expect(r.status).toBe("REFUNDED");
    expect(await gw.getPaymentStatus("sbx_x")).toBe("REFUNDED");
  });
});
