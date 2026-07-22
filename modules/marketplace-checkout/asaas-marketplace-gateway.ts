import { ExternalServiceError, ValidationError } from "@/domain/errors";
import { logger } from "@/server/observability/logger";
import { equalsSecret } from "@/server/security/crypto";
import {
  type CheckoutResult,
  type CreateMarketplaceCheckoutInput,
  hashPayload,
  type MarketplacePaymentGateway,
  type MarketplacePaymentStatus,
  type RefundInput,
  type RefundResult,
  type VerifiedWebhookEvent,
  type WebhookInput,
} from "./gateway";

// Adapter Asaas para o MARKETPLACE (cobrança avulsa com split), distinto do
// adapter de assinaturas (`modules/payments/asaas-payment-provider.ts`). Mesmas
// particularidades do Asaas: header `access_token` na API; webhook autenticado
// por segredo compartilhado no header `asaas-access-token` (não HMAC), comparado
// em tempo constante. O split manda 90% (fixedValue) para a carteira do vendedor;
// os 10% restantes ficam na conta ENKY automaticamente.
const PRODUCTION_BASE_URL = "https://api.asaas.com/v3";
const SANDBOX_BASE_URL = "https://api-sandbox.asaas.com/v3";
const SANDBOX_KEY_PREFIX = "$aact_hmlg_";

// Eventos de cobrança avulsa → status do marketplace. CONFIRMED e RECEIVED são o
// mesmo efeito (pago); o webhook-service é idempotente. Demais eventos viram
// PENDING e o webhook-service os ignora.
const EVENT_STATUS: Record<string, MarketplacePaymentStatus> = {
  PAYMENT_CONFIRMED: "PAID",
  PAYMENT_RECEIVED: "PAID",
  PAYMENT_REFUNDED: "REFUNDED",
  PAYMENT_CHARGEBACK_REQUESTED: "DISPUTED",
  PAYMENT_OVERDUE: "EXPIRED",
  PAYMENT_DELETED: "CANCELLED",
};

interface AsaasCustomer {
  id: string;
}
interface AsaasPayment {
  id: string;
  status?: string;
  invoiceUrl?: string;
}
interface AsaasWebhookBody {
  id?: string;
  event?: string;
  payment?: { id?: string; status?: string; externalReference?: string };
}

function centsToReais(cents: number): number {
  return Math.round(cents) / 100;
}

export class AsaasMarketplaceGateway implements MarketplacePaymentGateway {
  private readonly baseUrl: string;

  constructor(
    private readonly apiKey: string,
    private readonly webhookSecret: string,
  ) {
    if (!apiKey) throw new ValidationError("AsaasMarketplaceGateway requer API key.");
    if (!webhookSecret) throw new ValidationError("AsaasMarketplaceGateway requer segredo de webhook.");
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
      const body = await response.text().catch(() => "");
      logger.error({ status: response.status, path, body: body.slice(0, 500) }, "asaas marketplace request failed");
      throw new ExternalServiceError(`Gateway de pagamento respondeu HTTP ${response.status}.`);
    }
    return (await response.json()) as T;
  }

  private async resolveCustomerId(input: CreateMarketplaceCheckoutInput): Promise<string> {
    if (!input.buyerTaxId) {
      throw new ValidationError("CPF/CNPJ do comprador é obrigatório para a cobrança.");
    }
    const created = await this.request<AsaasCustomer>("/customers", {
      method: "POST",
      body: JSON.stringify({ name: input.buyerName, email: input.buyerEmail, cpfCnpj: input.buyerTaxId }),
    });
    return created.id;
  }

  async createCheckout(input: CreateMarketplaceCheckoutInput): Promise<CheckoutResult> {
    const customer = await this.resolveCustomerId(input);

    // billingType UNDEFINED: o comprador escolhe PIX/boleto/cartão na página do
    // Asaas — mantém a ENKY fora do escopo de dados de cartão.
    const split = (input.split ?? []).map((s) => ({
      walletId: s.walletId,
      fixedValue: centsToReais(s.fixedValueCents),
    }));

    const payment = await this.request<AsaasPayment>("/payments", {
      method: "POST",
      body: JSON.stringify({
        customer,
        billingType: "UNDEFINED",
        value: centsToReais(input.amountCents),
        dueDate: new Date().toISOString().slice(0, 10),
        description: `ENKY Marketplace — pedido ${input.orderId}`,
        externalReference: input.orderId,
        ...(split.length > 0 ? { split } : {}),
      }),
    });

    return {
      reference: payment.id,
      status: this.mapPaymentStatus(payment.status),
      method: input.method,
      paymentUrl: payment.invoiceUrl,
    };
  }

  private mapPaymentStatus(status?: string): MarketplacePaymentStatus {
    if (status === "CONFIRMED" || status === "RECEIVED") return "PAID";
    if (status === "REFUNDED") return "REFUNDED";
    if (status === "OVERDUE") return "EXPIRED";
    return "PENDING";
  }

  async getPaymentStatus(reference: string): Promise<MarketplacePaymentStatus> {
    const payment = await this.request<AsaasPayment>(`/payments/${reference}`);
    return this.mapPaymentStatus(payment.status);
  }

  async cancelPayment(reference: string): Promise<void> {
    await this.request(`/payments/${reference}`, { method: "DELETE" });
  }

  async refundPayment(input: RefundInput): Promise<RefundResult> {
    const refunded = await this.request<AsaasPayment>(`/payments/${input.reference}/refund`, {
      method: "POST",
      body: JSON.stringify(input.amountCents ? { value: centsToReais(input.amountCents) } : {}),
    });
    return { refundReference: refunded.id, status: "REFUNDED" };
  }

  async verifyWebhook(input: WebhookInput): Promise<VerifiedWebhookEvent> {
    // input.signature carrega o header `asaas-access-token`. Comparação de
    // segredo em tempo constante — não é assinatura HMAC.
    if (!equalsSecret(input.signature ?? "", this.webhookSecret)) {
      throw new ExternalServiceError("Token de webhook do marketplace inválido.");
    }
    let body: AsaasWebhookBody;
    try {
      body = JSON.parse(input.rawBody) as AsaasWebhookBody;
    } catch {
      throw new ValidationError("Payload de webhook não é JSON válido.");
    }
    if (!body.id || !body.event) {
      throw new ValidationError("Webhook sem `id` ou `event`.");
    }
    return {
      externalEventId: body.id,
      eventType: body.event,
      // reference = id da cobrança (== gatewayReference gravado no pedido).
      reference: body.payment?.id ?? body.payment?.externalReference ?? "",
      status: EVENT_STATUS[body.event] ?? "PENDING",
      payloadHash: hashPayload(input.rawBody),
    };
  }
}
