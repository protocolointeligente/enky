import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { ExternalServiceError, ValidationError } from "@/domain/errors";

// Abstração de gateway de pagamento do marketplace (§19). Regras do marketplace
// NUNCA acoplam ao Asaas: o orquestrador de checkout fala só com esta interface;
// Asaas (ou sandbox) é uma implementação. A verificação de assinatura de webhook
// (§21/§40) é a parte crítica de segurança e vive como função pura reutilizável.

export type MarketplacePaymentMethod = "PIX" | "CREDIT_CARD" | "BANK_SLIP";

export type MarketplacePaymentStatus =
  | "PENDING"
  | "PAID"
  | "FAILED"
  | "REFUNDED"
  | "CANCELLED"
  | "DISPUTED"
  | "EXPIRED";

export interface CreateMarketplaceCheckoutInput {
  orderId: string;
  idempotencyKey: string;
  amountCents: number;
  currency: string;
  method: MarketplacePaymentMethod;
  buyerName: string;
  buyerEmail: string;
  returnUrl?: string;
}

export interface CheckoutResult {
  reference: string;
  status: MarketplacePaymentStatus;
  method: MarketplacePaymentMethod;
  paymentUrl?: string;
  pixCode?: string;
  boletoUrl?: string;
  expiresAt?: string;
}

export interface RefundInput {
  reference: string;
  amountCents?: number;
  reason?: string;
}

export interface RefundResult {
  refundReference: string;
  status: MarketplacePaymentStatus;
}

export interface WebhookInput {
  rawBody: string;
  signature: string;
}

export interface VerifiedWebhookEvent {
  externalEventId: string;
  eventType: string;
  reference: string;
  status: MarketplacePaymentStatus;
  payloadHash: string;
}

export interface MarketplacePaymentGateway {
  createCheckout(input: CreateMarketplaceCheckoutInput): Promise<CheckoutResult>;
  getPaymentStatus(reference: string): Promise<MarketplacePaymentStatus>;
  cancelPayment(reference: string): Promise<void>;
  refundPayment(input: RefundInput): Promise<RefundResult>;
  verifyWebhook(input: WebhookInput): Promise<VerifiedWebhookEvent>;
}

// --- Primitivas de webhook (puras, reutilizáveis por qualquer gateway) -------

export function hashPayload(rawBody: string): string {
  return createHash("sha256").update(rawBody, "utf8").digest("hex");
}

export function signWebhook(rawBody: string, secret: string): string {
  return createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
}

// Comparação em tempo constante — comparar assinatura com === vaza timing (§40).
export function verifyWebhookSignature(rawBody: string, signature: string, secret: string): boolean {
  const expected = Buffer.from(signWebhook(rawBody, secret), "utf8");
  const received = Buffer.from(signature ?? "", "utf8");
  if (expected.length !== received.length) return false;
  return timingSafeEqual(expected, received);
}

// --- Gateway sandbox: determinístico, em memória, sem rede -------------------
// Para testes e Preview. NÃO usar em produção. Referência derivada da
// idempotencyKey → createCheckout é idempotente.

interface SandboxEvent {
  id: string;
  type: string;
  reference: string;
  status: MarketplacePaymentStatus;
}

export class SandboxMarketplaceGateway implements MarketplacePaymentGateway {
  private readonly statuses = new Map<string, MarketplacePaymentStatus>();
  private eventSeq = 0;

  constructor(private readonly webhookSecret: string) {
    if (!webhookSecret) {
      throw new ValidationError("Sandbox gateway requer um segredo de webhook.");
    }
  }

  async createCheckout(input: CreateMarketplaceCheckoutInput): Promise<CheckoutResult> {
    if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) {
      throw new ValidationError("amountCents deve ser inteiro positivo (centavos).");
    }
    const reference = `sbx_${input.idempotencyKey}`;
    if (!this.statuses.has(reference)) this.statuses.set(reference, "PENDING");
    const status = this.statuses.get(reference) ?? "PENDING";
    const result: CheckoutResult = { reference, status, method: input.method };
    if (input.method === "PIX") result.pixCode = `00020126SANDBOX-${reference}`;
    else if (input.method === "BANK_SLIP") result.boletoUrl = `https://sandbox.local/boleto/${reference}`;
    else result.paymentUrl = `https://sandbox.local/card/${reference}`;
    return result;
  }

  async getPaymentStatus(reference: string): Promise<MarketplacePaymentStatus> {
    return this.statuses.get(reference) ?? "PENDING";
  }

  async cancelPayment(reference: string): Promise<void> {
    this.statuses.set(reference, "CANCELLED");
  }

  async refundPayment(input: RefundInput): Promise<RefundResult> {
    this.statuses.set(input.reference, "REFUNDED");
    return { refundReference: `rfnd_${input.reference}`, status: "REFUNDED" };
  }

  async verifyWebhook(input: WebhookInput): Promise<VerifiedWebhookEvent> {
    if (!verifyWebhookSignature(input.rawBody, input.signature, this.webhookSecret)) {
      throw new ExternalServiceError("Assinatura de webhook inválida.");
    }
    let parsed: Partial<SandboxEvent>;
    try {
      parsed = JSON.parse(input.rawBody) as Partial<SandboxEvent>;
    } catch {
      throw new ValidationError("Payload de webhook não é JSON válido.");
    }
    if (!parsed.id || !parsed.reference || !parsed.status) {
      throw new ValidationError("Payload de webhook incompleto.");
    }
    return {
      externalEventId: parsed.id,
      eventType: parsed.type ?? "unknown",
      reference: parsed.reference,
      status: parsed.status,
      payloadHash: hashPayload(input.rawBody),
    };
  }

  // Só para testes/Preview: marca o pagamento e devolve o par (corpo, assinatura)
  // que o webhook real receberia — permite exercitar verifyWebhook ponta a ponta.
  simulateWebhook(reference: string, status: MarketplacePaymentStatus = "PAID"): WebhookInput {
    this.statuses.set(reference, status);
    const event: SandboxEvent = {
      id: `evt_${reference}_${++this.eventSeq}`,
      type: `payment.${status.toLowerCase()}`,
      reference,
      status,
    };
    const rawBody = JSON.stringify(event);
    return { rawBody, signature: signWebhook(rawBody, this.webhookSecret) };
  }
}
