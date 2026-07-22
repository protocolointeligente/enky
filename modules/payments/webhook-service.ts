import { createHash } from "node:crypto";
import { Prisma, type SubscriptionStatus } from "@prisma/client";
import type { AuditAction } from "@/domain/audit";
import { recordAuditLog } from "@/domain/audit";
import { prisma } from "@/infrastructure/database/prisma";
import { logger } from "@/server/observability/logger";
import { getPaymentProvider } from "./get-payment-provider";
import type { PaymentWebhookEvent } from "./payment-provider";

// O único lugar do sistema que altera `Subscription.status`.
//
// Três invariantes da Fase 10 vivem aqui:
//
//   1. ASSINATURA VERIFICADA — o corpo cru só é interpretado depois que o
//      adapter autenticou a requisição. Falha de verificação nunca chega neste
//      arquivo: `parseWebhook` lança e a rota responde 401 sem tocar o banco.
//
//   2. IDEMPOTÊNCIA — o INSERT em WebhookEvent é a PRIMEIRA escrita da
//      transação. A segunda entrega do mesmo evento colide no índice único
//      `uq_webhook_provider_event`, a transação inteira faz rollback e NADA é
//      reaplicado: nem assinatura duplicada, nem pagamento em dobro, nem
//      linha de auditoria repetida. É o banco que garante isso, não uma
//      checagem "SELECT antes do INSERT" — que teria janela de corrida entre
//      duas entregas simultâneas do gateway (que acontecem: retentativa
//      concorrente é comum).
//
//   3. SÓ EVENTO CONFIRMADO MUDA ESTADO — nenhum outro caminho de código
//      escreve `status`. O checkout deixa INCOMPLETE; o cancelamento escreve
//      só a intenção. Quem promove para ACTIVE/PAST_DUE/CANCELLED é este
//      arquivo, a partir de um evento autenticado do gateway.

export type WebhookOutcome = "processed" | "duplicate" | "ignored";

export interface HandleWebhookResult {
  outcome: WebhookOutcome;
  eventId?: string;
}

function hashPayload(rawBody: string): string {
  return createHash("sha256").update(rawBody).digest("hex");
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

// Transição de estado a partir de um evento já verificado.
// Devolve o patch e a ação de auditoria, ou null quando o evento não muda nada.
function planTransition(
  event: PaymentWebhookEvent,
  current: SubscriptionStatus,
): { data: Prisma.SubscriptionUpdateInput; action: AuditAction } | null {
  switch (event.type) {
    case "SUBSCRIPTION_ACTIVATED":
    case "SUBSCRIPTION_RENEWED": {
      // Uma assinatura já cancelada NÃO ressuscita por um evento de pagamento
      // atrasado que ficou na fila do gateway. Reativar exige novo checkout.
      if (current === "CANCELLED" || current === "EXPIRED") return null;

      const renewing = current === "ACTIVE";
      return {
        data: {
          status: "ACTIVE",
          currentPeriodStart: renewing ? undefined : new Date(),
          currentPeriodEnd: event.currentPeriodEnd ?? undefined,
        },
        // Distinguir ativação de renovação na trilha é o que permite ver
        // "primeiro pagamento" vs. "ciclo seguinte" sem cruzar tabelas.
        action: renewing ? "SUBSCRIPTION_RENEWED" : "SUBSCRIPTION_ACTIVATED",
      };
    }

    case "PAYMENT_FAILED": {
      if (current === "CANCELLED" || current === "EXPIRED") return null;
      // PAST_DUE, e nada mais. Não apaga assinatura, não remove atletas, não
      // toca em treino nenhum — a organização só volta aos limites do plano
      // grátis (modules/subscriptions/entitlements.ts) até regularizar.
      return { data: { status: "PAST_DUE" }, action: "SUBSCRIPTION_PAYMENT_FAILED" };
    }

    case "SUBSCRIPTION_CANCELLED": {
      if (current === "CANCELLED") return null;
      return {
        data: { status: "CANCELLED", cancelledAt: new Date() },
        action: "SUBSCRIPTION_CANCELLED",
      };
    }
  }
}

async function applyEvent(
  tx: Prisma.TransactionClient,
  event: PaymentWebhookEvent,
  providerName: string,
): Promise<WebhookOutcome> {
  const subscription = await tx.subscription.findUnique({
    where: { gatewaySubscriptionId: event.gatewaySubscriptionId },
    include: { plan: true },
  });

  if (!subscription) {
    // Não é erro: a mesma conta de gateway pode servir outro ambiente
    // (sandbox/preview) ou uma cobrança avulsa. Registrar como IGNORED e
    // responder 200 evita que o Asaas desative o webhook por erro repetido.
    logger.warn(
      { gatewaySubscriptionId: event.gatewaySubscriptionId, eventType: event.rawType },
      "webhook de assinatura desconhecida — ignorado",
    );
    return "ignored";
  }

  // Registro financeiro do que o GATEWAY diz ter cobrado. `amount` vem do
  // evento verificado, não do cliente. O preço do plano continua sendo a
  // autoridade comercial — a divergência abaixo é só alerta, porque o dinheiro
  // que de fato mudou de mãos é o do gateway e é ele que precisa ser fiel na
  // nossa contabilidade.
  if (event.gatewayPaymentId) {
    const amount = event.amount ?? Number(subscription.plan.price);
    if (event.amount !== undefined && event.amount !== Number(subscription.plan.price)) {
      logger.warn(
        {
          subscriptionId: subscription.id,
          eventAmount: event.amount,
          planPrice: Number(subscription.plan.price),
        },
        "valor do gateway diverge do preço do plano",
      );
    }

    const status = event.type === "PAYMENT_FAILED" ? "FAILED" : "PAID";
    // Chave estável por COBRANÇA, não por evento: PAYMENT_CONFIRMED e
    // PAYMENT_RECEIVED da mesma cobrança convergem para a mesma linha em vez
    // de contabilizarem o pagamento duas vezes.
    const idempotencyKey = `${providerName}:payment:${event.gatewayPaymentId}`;

    await tx.paymentTransaction.upsert({
      where: { idempotencyKey },
      create: {
        subscriptionId: subscription.id,
        gatewayRefId: event.gatewayPaymentId,
        amount: new Prisma.Decimal(amount),
        currency: event.currency ?? subscription.plan.currency,
        status,
        idempotencyKey,
        webhookEventId: event.eventId,
        webhookEventType: event.rawType,
        webhookReceivedAt: new Date(),
        webhookProcessedAt: new Date(),
      },
      update: {
        status,
        webhookEventId: event.eventId,
        webhookEventType: event.rawType,
        webhookProcessedAt: new Date(),
      },
    });
  }

  const transition = planTransition(event, subscription.status);
  if (!transition) {
    logger.info(
      { subscriptionId: subscription.id, from: subscription.status, eventType: event.rawType },
      "webhook sem transição aplicável",
    );
    return "processed";
  }

  await tx.subscription.update({ where: { id: subscription.id }, data: transition.data });

  await recordAuditLog(tx, {
    action: transition.action,
    entityName: "Subscription",
    entityId: subscription.id,
    organizationId: subscription.organizationId,
    // Sem `userId`: não há sessão numa requisição de webhook. Atribuir a ação
    // ao treinador falsificaria a trilha — quem agiu foi o gateway.
    actorType: "SYSTEM",
    reason: `evento=${event.rawType} gateway=${providerName}`,
    changedFields: Object.keys(transition.data),
  });

  return "processed";
}

export async function handlePaymentWebhook(
  rawBody: string,
  headers: Headers,
): Promise<HandleWebhookResult> {
  const provider = getPaymentProvider();

  // Lança WebhookVerificationError se o segredo não conferir. Nada foi
  // escrito no banco até aqui.
  const event = provider.parseWebhook(rawBody, headers);

  if (!event) {
    // Evento válido, autenticado, mas irrelevante (PAYMENT_CREATED etc.).
    // Não registramos: sem `eventId` normalizado não há chave de idempotência,
    // e o evento não tem efeito nenhum a proteger.
    return { outcome: "ignored" };
  }

  try {
    return await prisma.$transaction(
      async (tx) => {
        // PRIMEIRA escrita — a trava de idempotência.
        await tx.webhookEvent.create({
          data: {
            provider: provider.name,
            eventId: event.eventId,
            eventType: event.rawType,
            payloadHash: hashPayload(rawBody),
            status: "PROCESSED",
            processedAt: new Date(),
          },
        });

        const outcome = await applyEvent(tx, event, provider.name);

        if (outcome === "ignored") {
          await tx.webhookEvent.update({
            where: { provider_eventId: { provider: provider.name, eventId: event.eventId } },
            data: { status: "IGNORED" },
          });
        }

        return { outcome, eventId: event.eventId };
      },
      // O teto padrão de transação interativa do Prisma é 5s. São ~5
      // round-trips aqui (evento, assinatura+plano, transação de pagamento,
      // assinatura, auditoria) e, contra um Postgres gerenciado remoto sob
      // carga, 5s estoura de verdade — foi observado em teste (6,6s).
      //
      // A saída NÃO é quebrar a transação em partes: ela é indivisível de
      // propósito — é o rollback conjunto que garante que evento reentregue
      // não aplique efeito duas vezes. Encurtar a atomicidade para caber no
      // relógio trocaria uma falha visível (webhook 500, gateway reenvia) por
      // uma corrupção silenciosa (pagamento contado duas vezes).
      //
      // Então o teto sobe. `maxWait` cobre a espera por conexão no pool, que
      // é o que realmente estoura em pico de cobrança, quando o Asaas dispara
      // eventos em lote.
      { timeout: 20_000, maxWait: 10_000 },
    );
  } catch (error) {
    if (isUniqueViolation(error)) {
      // Reentrega do mesmo evento. A transação inteira fez rollback: nenhum
      // efeito foi aplicado duas vezes. 200 para o gateway parar de reenviar.
      logger.info(
        { eventId: event.eventId, eventType: event.rawType },
        "webhook duplicado — ignorado por idempotência",
      );
      return { outcome: "duplicate", eventId: event.eventId };
    }
    throw error;
  }
}
