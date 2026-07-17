import { createHash } from "node:crypto";
import { equalsSecret } from "@/server/security/crypto";
import {
  WebhookVerificationError,
  type CheckoutSession,
  type CreateSubscriptionCheckoutRequest,
  type PaymentEventType,
  type PaymentProvider,
  type PaymentWebhookEvent,
} from "./payment-provider";

// Provedor de desenvolvimento/teste. Não fala com rede nenhuma: o "checkout"
// devolve uma URL local e os eventos são fabricados pelo próprio teste.
//
// Ele NÃO é um mock permissivo — implementa a mesma verificação de segredo do
// Asaas (header `asaas-access-token`, comparação timing-safe) e o mesmo
// formato de evento. Por isso os testes de idempotência, de assinatura
// inválida e de ativação exercitam o caminho real do serviço de webhook, e não
// uma versão simplificada que só existe no teste.
//
// A fábrica (get-payment-provider.ts) só o entrega em development/test.

export const FAKE_WEBHOOK_SECRET = "fake-webhook-secret-for-development-only";

export interface FakeEventOptions {
  eventId: string;
  type: PaymentEventType;
  gatewaySubscriptionId: string;
  gatewayPaymentId?: string;
  amount?: number;
  currentPeriodEnd?: Date;
}

const RAW_TYPE_BY_EVENT: Record<PaymentEventType, string> = {
  SUBSCRIPTION_ACTIVATED: "PAYMENT_CONFIRMED",
  SUBSCRIPTION_RENEWED: "PAYMENT_RECEIVED",
  PAYMENT_FAILED: "PAYMENT_OVERDUE",
  SUBSCRIPTION_CANCELLED: "SUBSCRIPTION_DELETED",
};

// Monta o corpo cru que o gateway enviaria — usado pelos testes e pelo fluxo
// manual de desenvolvimento para exercitar o webhook de verdade.
export function buildFakeWebhookBody(options: FakeEventOptions): string {
  return JSON.stringify({
    id: options.eventId,
    event: RAW_TYPE_BY_EVENT[options.type],
    payment: {
      id: options.gatewayPaymentId ?? `pay_${options.eventId}`,
      subscription: options.gatewaySubscriptionId,
      value: options.amount,
      dueDate: (options.currentPeriodEnd ?? new Date()).toISOString().slice(0, 10),
    },
  });
}

export class FakePaymentProvider implements PaymentProvider {
  readonly name = "fake";
  // Inspecionável pelos testes: cancelamento no gateway foi mesmo pedido?
  readonly cancelled: string[] = [];

  constructor(private readonly webhookSecret: string = FAKE_WEBHOOK_SECRET) {}

  async createSubscriptionCheckout(
    request: CreateSubscriptionCheckoutRequest,
  ): Promise<CheckoutSession> {
    // Determinístico a partir do id da assinatura: reexecutar o checkout da
    // mesma linha devolve o mesmo id de gateway, como um gateway idempotente
    // faria — sem isso o teste veria ids novos a cada chamada e esconderia
    // duplicação.
    const digest = createHash("sha256").update(request.subscriptionId).digest("hex").slice(0, 12);
    return {
      gatewaySubscriptionId: `sub_fake_${digest}`,
      gatewayCustomerId: request.customer.gatewayCustomerId ?? `cus_fake_${digest}`,
      redirectUrl: `/treinador/assinatura?checkout=fake&subscription=${request.subscriptionId}`,
    };
  }

  async cancelSubscription(gatewaySubscriptionId: string): Promise<void> {
    this.cancelled.push(gatewaySubscriptionId);
  }

  parseWebhook(rawBody: string, headers: Headers): PaymentWebhookEvent | null {
    // Mesma verificação do adapter real, pela mesma primitiva compartilhada
    // (server/security/crypto) — é o que garante que o teste de "segredo
    // inválido" exercite o comportamento de produção, e não uma cópia que pode
    // divergir em silêncio.
    if (!equalsSecret(headers.get("asaas-access-token"), this.webhookSecret)) {
      throw new WebhookVerificationError("Token de webhook do gateway inválido.");
    }

    let body: {
      id?: string;
      event?: string;
      payment?: { id?: string; subscription?: string; value?: number; dueDate?: string };
    };
    try {
      body = JSON.parse(rawBody);
    } catch {
      throw new WebhookVerificationError("Corpo do webhook não é JSON válido.");
    }

    if (!body.id || !body.event) {
      throw new WebhookVerificationError("Webhook sem `id` ou `event`.");
    }

    const type = (Object.keys(RAW_TYPE_BY_EVENT) as PaymentEventType[]).find(
      (key) => RAW_TYPE_BY_EVENT[key] === body.event,
    );
    if (!type) return null;

    const gatewaySubscriptionId = body.payment?.subscription;
    if (!gatewaySubscriptionId) return null;

    return {
      eventId: body.id,
      type,
      gatewaySubscriptionId,
      gatewayPaymentId: body.payment?.id,
      amount: body.payment?.value,
      currency: "BRL",
      currentPeriodEnd: body.payment?.dueDate
        ? new Date(`${body.payment.dueDate}T00:00:00.000Z`)
        : undefined,
      rawType: body.event,
    };
  }
}
