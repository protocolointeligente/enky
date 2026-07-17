import { ExternalServiceError } from "@/domain/errors";
import { logger } from "@/server/observability/logger";
import { equalsSecret } from "@/server/security/crypto";
import {
  WebhookVerificationError,
  type CheckoutSession,
  type CreateSubscriptionCheckoutRequest,
  type PaymentEventType,
  type PaymentProvider,
  type PaymentWebhookEvent,
} from "./payment-provider";

// Adapter do Asaas (https://docs.asaas.com). Falado por REST com `fetch` —
// sem SDK: a superfície que usamos é de quatro endpoints, e um SDK a mais é
// uma dependência a mais para auditar numa área sensível.
//
// Duas particularidades do Asaas que o resto do código não precisa saber:
//
//  1. AUTENTICAÇÃO DA API: header `access_token` (não `Authorization: Bearer`).
//
//  2. AUTENTICAÇÃO DO WEBHOOK: o Asaas NÃO assina o corpo com HMAC, como faz
//     a Stripe. Ele devolve, em todo POST, um segredo compartilhado no header
//     `asaas-access-token` — o mesmo valor configurado no cadastro do webhook.
//     A verificação é, portanto, comparação de segredo, não de assinatura.
//     Consequências que o código abaixo assume explicitamente:
//       - a comparação é timing-safe (`timingSafeEqual`), como a de uma senha;
//       - o segredo NUNCA pode ser a API key da conta (o próprio Asaas proíbe);
//       - o endpoint só pode existir sob HTTPS — o segredo viaja em claro no
//         header, e sem TLS qualquer intermediário o captura e passa a forjar
//         confirmação de pagamento. Ver checagem em `assertSecureTransport`.
const PRODUCTION_BASE_URL = "https://api.asaas.com/v3";
const SANDBOX_BASE_URL = "https://api-sandbox.asaas.com/v3";

// Chave de sandbox do Asaas começa com `$aact_hmlg_`. Deixa o adapter escolher
// a base URL certa sozinho, em vez de exigir mais uma variável de ambiente que
// pode divergir da chave e mandar cobrança real para o ambiente de teste.
const SANDBOX_KEY_PREFIX = "$aact_hmlg_";

const CYCLE_BY_BILLING: Record<"MENSAL" | "ANUAL", string> = {
  MENSAL: "MONTHLY",
  ANUAL: "YEARLY",
};

// Tradução dos eventos do Asaas para o vocabulário da ENKY.
//
// PAYMENT_CONFIRMED  → pagamento reconhecido (recursos liberados).
// PAYMENT_RECEIVED   → dinheiro disponível na conta Asaas. Chega DEPOIS do
//                      CONFIRMED, para a mesma cobrança. Mapeia para o mesmo
//                      efeito de propósito: o serviço de webhook é idempotente
//                      por estado (ativar algo já ativo não faz nada), então a
//                      dupla entrega é inofensiva — e se o gateway pular o
//                      CONFIRMED, o RECEIVED ainda ativa.
// PAYMENT_OVERDUE / _REFUNDED / _CHARGEBACK → falha: degrada para o limite
//                      grátis, nunca apaga dados.
// SUBSCRIPTION_DELETED / _INACTIVATED → assinatura encerrada.
//
// Eventos fora deste mapa (PAYMENT_CREATED, PAYMENT_UPDATED, ...) retornam
// null: registrados como IGNORED e descartados. Nunca lançam — o Asaas
// desativa webhooks que respondem erro, e um evento que não nos interessa não
// é um erro.
const EVENT_MAP: Record<string, PaymentEventType> = {
  PAYMENT_CONFIRMED: "SUBSCRIPTION_ACTIVATED",
  PAYMENT_RECEIVED: "SUBSCRIPTION_ACTIVATED",
  PAYMENT_OVERDUE: "PAYMENT_FAILED",
  PAYMENT_REFUNDED: "PAYMENT_FAILED",
  PAYMENT_CHARGEBACK_REQUESTED: "PAYMENT_FAILED",
  PAYMENT_DELETED: "PAYMENT_FAILED",
  SUBSCRIPTION_DELETED: "SUBSCRIPTION_CANCELLED",
  SUBSCRIPTION_INACTIVATED: "SUBSCRIPTION_CANCELLED",
};

interface AsaasCustomerResponse {
  id: string;
}

interface AsaasSubscriptionResponse {
  id: string;
}

interface AsaasPayment {
  id: string;
  invoiceUrl?: string;
  value?: number;
  dueDate?: string;
  subscription?: string;
}

interface AsaasWebhookBody {
  id?: string;
  event?: string;
  payment?: {
    id?: string;
    subscription?: string;
    value?: number;
    dueDate?: string;
    externalReference?: string;
  };
  subscription?: {
    id?: string;
    value?: number;
    nextDueDate?: string;
    externalReference?: string;
  };
}

export class AsaasPaymentProvider implements PaymentProvider {
  readonly name = "asaas";
  private readonly baseUrl: string;

  constructor(
    private readonly apiKey: string,
    private readonly webhookSecret: string,
  ) {
    this.baseUrl = apiKey.startsWith(SANDBOX_KEY_PREFIX) ? SANDBOX_BASE_URL : PRODUCTION_BASE_URL;
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        headers: {
          access_token: this.apiKey,
          "Content-Type": "application/json",
          Accept: "application/json",
          ...init?.headers,
        },
        cache: "no-store",
      });
    } catch (cause) {
      throw new ExternalServiceError("Gateway de pagamento indisponível.", cause);
    }

    if (!response.ok) {
      // O corpo de erro do Asaas pode citar dados do cliente — fica no log do
      // servidor, nunca na resposta ao browser.
      const body = await response.text().catch(() => "");
      logger.error(
        { status: response.status, path, body: body.slice(0, 500) },
        "asaas request failed",
      );
      throw new ExternalServiceError(`Gateway de pagamento respondeu HTTP ${response.status}.`);
    }

    return (await response.json()) as T;
  }

  private async resolveCustomerId(
    customer: CreateSubscriptionCheckoutRequest["customer"],
  ): Promise<string> {
    if (customer.gatewayCustomerId) return customer.gatewayCustomerId;

    const created = await this.request<AsaasCustomerResponse>("/customers", {
      method: "POST",
      body: JSON.stringify({
        name: customer.name,
        email: customer.email,
        cpfCnpj: customer.taxId,
      }),
    });
    return created.id;
  }

  async createSubscriptionCheckout(
    request: CreateSubscriptionCheckoutRequest,
  ): Promise<CheckoutSession> {
    const gatewayCustomerId = await this.resolveCustomerId(request.customer);

    // `billingType: UNDEFINED` deixa o pagador escolher PIX/boleto/cartão na
    // página do Asaas. É o que mantém a ENKY fora do escopo de dados de cartão.
    // `externalReference` carrega o id da NOSSA Subscription: mesmo que o
    // gateway reordene ou reenvie eventos, sempre há caminho de volta à linha
    // certa sem depender só do `sub_...`.
    const subscription = await this.request<AsaasSubscriptionResponse>("/subscriptions", {
      method: "POST",
      body: JSON.stringify({
        customer: gatewayCustomerId,
        billingType: "UNDEFINED",
        value: request.amount,
        nextDueDate: new Date().toISOString().slice(0, 10),
        cycle: CYCLE_BY_BILLING[request.billingCycle],
        description: `ENKY — ${request.planName}`,
        externalReference: request.subscriptionId,
      }),
    });

    const payments = await this.request<{ data: AsaasPayment[] }>(
      `/subscriptions/${subscription.id}/payments`,
    );
    const invoiceUrl = payments.data?.find((p) => p.invoiceUrl)?.invoiceUrl;
    if (!invoiceUrl) {
      throw new ExternalServiceError(
        "Gateway não retornou URL de cobrança para a assinatura criada.",
      );
    }

    return { gatewaySubscriptionId: subscription.id, gatewayCustomerId, redirectUrl: invoiceUrl };
  }

  async cancelSubscription(gatewaySubscriptionId: string): Promise<void> {
    await this.request(`/subscriptions/${gatewaySubscriptionId}`, { method: "DELETE" });
  }

  // O segredo do webhook viaja em claro num header. Sem TLS ele é capturável
  // por qualquer intermediário, e quem o tiver consegue forjar "pagamento
  // confirmado". Em produção isso é recusa dura; em desenvolvimento, http
  // local é normal e permitido.
  private assertSecureTransport(headers: Headers): void {
    if (process.env.NODE_ENV !== "production") return;
    const proto = headers.get("x-forwarded-proto");
    if (proto && proto.split(",")[0]!.trim() !== "https") {
      throw new WebhookVerificationError("Webhook de pagamento exige HTTPS.");
    }
  }

  parseWebhook(rawBody: string, headers: Headers): PaymentWebhookEvent | null {
    this.assertSecureTransport(headers);

    const received = headers.get("asaas-access-token");
    if (!received || !equalsSecret(received, this.webhookSecret)) {
      throw new WebhookVerificationError("Token de webhook do gateway inválido.");
    }

    let body: AsaasWebhookBody;
    try {
      body = JSON.parse(rawBody) as AsaasWebhookBody;
    } catch {
      throw new WebhookVerificationError("Corpo do webhook não é JSON válido.");
    }

    const rawType = body.event;
    const eventId = body.id;
    if (!rawType || !eventId) {
      throw new WebhookVerificationError("Webhook sem `id` ou `event`.");
    }

    const type = EVENT_MAP[rawType];
    if (!type) return null;

    const gatewaySubscriptionId = body.payment?.subscription ?? body.subscription?.id;
    if (!gatewaySubscriptionId) {
      // Evento de cobrança avulsa (não vinculada a assinatura). Não é erro:
      // a Fase 10 só assina a plataforma; compras de marketplace virão depois.
      return null;
    }

    const dueDate = body.payment?.dueDate ?? body.subscription?.nextDueDate;

    return {
      eventId,
      type,
      gatewaySubscriptionId,
      gatewayPaymentId: body.payment?.id,
      amount: body.payment?.value ?? body.subscription?.value,
      currency: "BRL",
      currentPeriodEnd: dueDate ? new Date(`${dueDate}T00:00:00.000Z`) : undefined,
      rawType,
    };
  }
}
