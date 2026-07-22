import { describe, expect, it } from "vitest";
import { AsaasPaymentProvider } from "@/modules/payments/asaas-payment-provider";
import { WebhookVerificationError } from "@/modules/payments/payment-provider";

const SECRET = "segredo-de-webhook-do-asaas-para-teste";
const provider = new AsaasPaymentProvider("$aact_hmlg_fake_key", SECRET);

function headers(token?: string, extra?: Record<string, string>): Headers {
  const h = new Headers(extra);
  if (token !== undefined) h.set("asaas-access-token", token);
  return h;
}

function body(event: string, overrides?: Record<string, unknown>): string {
  return JSON.stringify({
    id: "evt_001",
    event,
    payment: { id: "pay_001", subscription: "sub_001", value: 79.9, dueDate: "2026-08-16" },
    ...overrides,
  });
}

describe("AsaasPaymentProvider.parseWebhook — verificação (Fase 10)", () => {
  // A regra "webhook precisa validar assinatura". No Asaas isso é o segredo
  // compartilhado do header `asaas-access-token`. Sem ele, qualquer um que
  // descobrisse a URL poderia POSTar "pagamento confirmado" e liberar plano
  // pago de graça.
  it("aceita o evento quando o token confere", () => {
    const event = provider.parseWebhook(body("PAYMENT_CONFIRMED"), headers(SECRET));
    expect(event).toMatchObject({
      eventId: "evt_001",
      type: "SUBSCRIPTION_ACTIVATED",
      gatewaySubscriptionId: "sub_001",
      gatewayPaymentId: "pay_001",
      amount: 79.9,
      rawType: "PAYMENT_CONFIRMED",
    });
  });

  it.each([
    ["token ausente", undefined],
    ["token vazio", ""],
    ["token errado", "segredo-errado"],
    ["token com prefixo correto mas truncado", SECRET.slice(0, 10)],
    ["token com sufixo extra", `${SECRET}x`],
  ])("rejeita quando o token não confere (%s)", (_label, token) => {
    expect(() => provider.parseWebhook(body("PAYMENT_CONFIRMED"), headers(token))).toThrow(
      WebhookVerificationError,
    );
  });

  it("rejeita corpo que não é JSON", () => {
    expect(() => provider.parseWebhook("não é json", headers(SECRET))).toThrow(
      WebhookVerificationError,
    );
  });

  it("rejeita evento sem id (sem chave de idempotência não há proteção)", () => {
    const noId = JSON.stringify({ event: "PAYMENT_CONFIRMED", payment: { subscription: "sub_1" } });
    expect(() => provider.parseWebhook(noId, headers(SECRET))).toThrow(WebhookVerificationError);
  });

  it("verifica o token ANTES de interpretar o corpo", () => {
    // Corpo malformado + token errado → o erro tem de ser o do token. Se o
    // parser rodasse primeiro, estaríamos processando bytes de um remetente
    // não autenticado.
    expect(() => provider.parseWebhook("{{{", headers("errado"))).toThrow(
      /Token de webhook do gateway inválido/,
    );
  });
});

describe("AsaasPaymentProvider.parseWebhook — tradução de eventos", () => {
  it.each([
    ["PAYMENT_CONFIRMED", "SUBSCRIPTION_ACTIVATED"],
    ["PAYMENT_RECEIVED", "SUBSCRIPTION_ACTIVATED"],
    ["PAYMENT_OVERDUE", "PAYMENT_FAILED"],
    ["PAYMENT_REFUNDED", "PAYMENT_FAILED"],
    ["PAYMENT_CHARGEBACK_REQUESTED", "PAYMENT_FAILED"],
    ["SUBSCRIPTION_DELETED", "SUBSCRIPTION_CANCELLED"],
    ["SUBSCRIPTION_INACTIVATED", "SUBSCRIPTION_CANCELLED"],
  ])("traduz %s para %s", (raw, expected) => {
    expect(provider.parseWebhook(body(raw), headers(SECRET))?.type).toBe(expected);
  });

  // Ignorar não é falhar: o Asaas desativa webhooks que respondem erro, então
  // um evento que não nos interessa precisa sair silenciosamente.
  it.each([["PAYMENT_CREATED"], ["PAYMENT_UPDATED"], ["EVENTO_FUTURO_DESCONHECIDO"]])(
    "ignora evento irrelevante (%s) sem lançar",
    (raw) => {
      expect(provider.parseWebhook(body(raw), headers(SECRET))).toBeNull();
    },
  );

  it("ignora cobrança avulsa (sem assinatura vinculada)", () => {
    const avulsa = JSON.stringify({
      id: "evt_avulsa",
      event: "PAYMENT_CONFIRMED",
      payment: { id: "pay_x", value: 10 },
    });
    expect(provider.parseWebhook(avulsa, headers(SECRET))).toBeNull();
  });

  it("converte o vencimento em data de fim de ciclo", () => {
    const event = provider.parseWebhook(body("PAYMENT_CONFIRMED"), headers(SECRET));
    expect(event?.currentPeriodEnd?.toISOString()).toBe("2026-08-16T00:00:00.000Z");
  });
});
