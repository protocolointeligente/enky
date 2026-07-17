import { z } from "zod";
import { recordAuditLog } from "@/domain/audit";
import { BusinessRuleError, ConflictError, NotFoundError } from "@/domain/errors";
import { prisma } from "@/infrastructure/database/prisma";
import { getPaymentProvider } from "@/modules/payments/get-payment-provider";
import { getAthleteLimitStatus, resolveEntitlements, type Entitlements } from "./entitlements";
import { FREE_PLAN_SLUG, parsePlanLimits, type PlanLimits } from "./plan-limits";

export interface BillingActor {
  userId: string;
  organizationId: string;
  ipAddress?: string;
  userAgent?: string;
}

// O corpo do checkout tem `planSlug` e NADA de dinheiro.
//
// Esta é a regra "nunca confiar em preço vindo do cliente" expressa no ponto
// onde ela pode ser violada. Não existe campo de preço, moeda, desconto ou
// ciclo aqui: se existisse, alguém acabaria lendo. O servidor resolve o slug
// no catálogo e usa o preço da linha do banco. Um cliente malicioso só
// consegue escolher QUAL plano quer pagar — nunca QUANTO.
export const startCheckoutInputSchema = z.object({
  planSlug: z.string().trim().min(1).max(50),
  // CPF/CNPJ exigido pelo Asaas para criar o cliente. Trafega só até o
  // gateway e NUNCA é persistido pela ENKY — guardamos apenas o
  // `gatewayCustomerId` devolvido. Aceita com ou sem máscara; normalizado
  // para dígitos.
  taxId: z
    .string()
    .trim()
    .transform((value) => value.replace(/\D/g, ""))
    .refine((digits) => digits.length === 11 || digits.length === 14, {
      message: "CPF ou CNPJ inválido.",
    }),
});

export type StartCheckoutInput = z.infer<typeof startCheckoutInputSchema>;

export interface PlanCatalogItem {
  slug: string;
  name: string;
  description: string | null;
  price: number;
  currency: string;
  billingCycle: string;
  limits: PlanLimits;
  isCurrent: boolean;
}

export async function listPlans(organizationId: string): Promise<PlanCatalogItem[]> {
  const [plans, entitlements] = await Promise.all([
    prisma.subscriptionPlan.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    }),
    resolveEntitlements(organizationId),
  ]);

  return plans.map((plan) => ({
    slug: plan.slug,
    name: plan.name,
    description: plan.description,
    price: Number(plan.price),
    currency: plan.currency,
    billingCycle: plan.billingCycle,
    limits: parsePlanLimits(plan.featuresLimits),
    isCurrent: plan.slug === entitlements.planSlug,
  }));
}

export interface CurrentSubscriptionView {
  entitlements: Entitlements;
  athleteLimit: Awaited<ReturnType<typeof getAthleteLimitStatus>>;
  subscription: {
    id: string;
    status: string;
    planName: string;
    price: number;
    currency: string;
    currentPeriodEnd: Date | null;
    cancelAtPeriodEnd: boolean;
    cancelledAt: Date | null;
  } | null;
  lastPayments: Array<{
    id: string;
    status: string;
    amount: number;
    currency: string;
    createdAt: Date;
  }>;
}

export async function getCurrentSubscription(
  organizationId: string,
): Promise<CurrentSubscriptionView> {
  const [entitlements, athleteLimit, subscription] = await Promise.all([
    resolveEntitlements(organizationId),
    getAthleteLimitStatus(organizationId),
    prisma.subscription.findFirst({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      include: { plan: true },
    }),
  ]);

  const lastPayments = subscription
    ? await prisma.paymentTransaction.findMany({
        where: { subscriptionId: subscription.id },
        orderBy: { createdAt: "desc" },
        take: 12,
        select: { id: true, status: true, amount: true, currency: true, createdAt: true },
      })
    : [];

  return {
    entitlements,
    athleteLimit,
    subscription: subscription
      ? {
          id: subscription.id,
          status: subscription.status,
          planName: subscription.plan.name,
          price: Number(subscription.plan.price),
          currency: subscription.plan.currency,
          currentPeriodEnd: subscription.currentPeriodEnd,
          cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
          cancelledAt: subscription.cancelledAt,
        }
      : null,
    lastPayments: lastPayments.map((p) => ({
      id: p.id,
      status: p.status,
      amount: Number(p.amount),
      currency: p.currency,
      createdAt: p.createdAt,
    })),
  };
}

export interface StartCheckoutResult {
  subscriptionId: string;
  redirectUrl: string;
}

// Estados que o índice parcial `uq_active_subscription_per_organization`
// considera não-terminais. Repetido aqui porque o INSERT precisa saber o que
// colidiria antes de tentar.
const NON_TERMINAL: readonly ("INCOMPLETE" | "TRIALING" | "ACTIVE" | "PAST_DUE")[] = [
  "INCOMPLETE",
  "TRIALING",
  "ACTIVE",
  "PAST_DUE",
];

export async function startSubscriptionCheckout(
  input: StartCheckoutInput,
  actor: BillingActor,
): Promise<StartCheckoutResult> {
  // 1. Preço e ciclo vêm DAQUI — do banco, pelo slug. Nunca do corpo.
  const plan = await prisma.subscriptionPlan.findUnique({ where: { slug: input.planSlug } });
  if (!plan || !plan.isActive) {
    throw new NotFoundError("Plano não encontrado.");
  }
  if (plan.slug === FREE_PLAN_SLUG || Number(plan.price) <= 0) {
    // O grátis é o estado padrão de quem não assina — não há o que cobrar.
    throw new BusinessRuleError("O plano grátis não exige checkout.");
  }

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: actor.userId },
    select: { name: true, email: true },
  });

  // 2. Uma assinatura viva por organização (índice parcial no banco).
  const existing = await prisma.subscription.findFirst({
    where: { organizationId: actor.organizationId, status: { in: [...NON_TERMINAL] } },
  });

  if (existing && existing.status !== "INCOMPLETE") {
    // Troca de plano com assinatura paga em curso envolve rateio/crédito
    // proporcional, que esta fase não modela. Recusar é a resposta honesta —
    // o contrário seria cobrar duas vezes ou dar um mês grátis por acidente.
    throw new ConflictError(
      "Já existe uma assinatura em vigor para esta organização. Cancele a atual antes de assinar outro plano.",
    );
  }

  // Checkout abandonado (INCOMPLETE) é reaproveitado: sem isso o índice
  // parcial rejeitaria a segunda tentativa e o treinador ficaria travado sem
  // nunca ter pago nada.
  const subscription = existing
    ? await prisma.subscription.update({
        where: { id: existing.id },
        data: { subscriptionPlanId: plan.id, status: "INCOMPLETE" },
      })
    : await prisma.subscription.create({
        data: {
          organizationId: actor.organizationId,
          subscriptionPlanId: plan.id,
          status: "INCOMPLETE",
        },
      });

  // 3. Gateway. Fora de transação de propósito: é I/O de rede, e segurar uma
  // transação aberta durante uma chamada externa prende conexão do pool pelo
  // tempo do gateway.
  const provider = getPaymentProvider();
  const session = await provider.createSubscriptionCheckout({
    subscriptionId: subscription.id,
    planName: plan.name,
    amount: Number(plan.price),
    currency: plan.currency,
    billingCycle: plan.billingCycle,
    customer: {
      gatewayCustomerId: subscription.gatewayCustomerId ?? undefined,
      name: user.name,
      email: user.email,
      taxId: input.taxId,
    },
  });

  // 4. Guarda os ids do gateway e AUDITA — mas o status continua INCOMPLETE.
  // Chegar até aqui significa "cobrança emitida", não "pago". Quem ativa é o
  // webhook, e só ele.
  await prisma.$transaction(async (tx) => {
    await tx.subscription.update({
      where: { id: subscription.id },
      data: {
        provider: provider.name,
        gatewayCustomerId: session.gatewayCustomerId,
        gatewaySubscriptionId: session.gatewaySubscriptionId,
      },
    });

    await recordAuditLog(tx, {
      action: "START_SUBSCRIPTION_CHECKOUT",
      entityName: "Subscription",
      entityId: subscription.id,
      userId: actor.userId,
      organizationId: actor.organizationId,
      reason: `plano=${plan.slug}`,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });
  });

  return { subscriptionId: subscription.id, redirectUrl: session.redirectUrl };
}

export interface CancelResult {
  subscriptionId: string;
  status: string;
  cancelAtPeriodEnd: boolean;
}

// Cancelamento pedido pelo treinador.
//
// Duas coisas acontecem, e a ordem importa:
//   1. pede o encerramento ao gateway;
//   2. marca a INTENÇÃO (`cancelAtPeriodEnd`) e audita.
//
// O que NÃO acontece: mudar `status` para CANCELLED. Status é consequência de
// evento confirmado (SUBSCRIPTION_DELETED/INACTIVATED), nunca de otimismo
// local — se o gateway recusar o cancelamento e nós já tivéssemos marcado
// CANCELLED, o treinador perderia o acesso continuando a ser cobrado.
// `cancelAtPeriodEnd` é intenção declarada, não estado de cobrança, e por isso
// pode ser gravado aqui: ele já deixa a UI honesta ("cancelamento agendado")
// enquanto o webhook não chega.
export async function requestSubscriptionCancellation(actor: BillingActor): Promise<CancelResult> {
  const subscription = await prisma.subscription.findFirst({
    where: { organizationId: actor.organizationId, status: { in: [...NON_TERMINAL] } },
  });

  if (!subscription) {
    throw new NotFoundError("Nenhuma assinatura ativa para cancelar.");
  }

  if (subscription.gatewaySubscriptionId) {
    const provider = getPaymentProvider();
    await provider.cancelSubscription(subscription.gatewaySubscriptionId);
  }

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.subscription.update({
      where: { id: subscription.id },
      data: { cancelAtPeriodEnd: true },
    });

    await recordAuditLog(tx, {
      action: "REQUEST_SUBSCRIPTION_CANCELLATION",
      entityName: "Subscription",
      entityId: subscription.id,
      userId: actor.userId,
      organizationId: actor.organizationId,
      changedFields: ["cancelAtPeriodEnd"],
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    return row;
  });

  return {
    subscriptionId: updated.id,
    status: updated.status,
    cancelAtPeriodEnd: updated.cancelAtPeriodEnd,
  };
}
