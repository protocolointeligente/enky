import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/infrastructure/database/prisma";
import { inviteAthlete } from "@/modules/athletes/invite-athlete";
import { registerTrainer } from "@/modules/identity/register-trainer";
import {
  buildFakeWebhookBody,
  FAKE_WEBHOOK_SECRET,
  type FakeEventOptions,
} from "@/modules/payments/fake-payment-provider";
import { getPaymentProvider } from "@/modules/payments/get-payment-provider";
import { handlePaymentWebhook } from "@/modules/payments/webhook-service";
import { getAthleteLimitStatus, resolveEntitlements } from "@/modules/subscriptions/entitlements";
import {
  getCurrentSubscription,
  requestSubscriptionCancellation,
  startSubscriptionCheckout,
} from "@/modules/subscriptions/subscription-service";
import { uniqueEmail } from "./helpers";

// Fase 10 — critérios de aceite, ponta a ponta contra o banco real:
//   usuário assina → webhook confirma → plano libera limite →
//   cancelamento muda status → eventos duplicados são idempotentes.
//
// O gateway é o FakePaymentProvider, que verifica o mesmo segredo e produz o
// mesmo formato de evento do Asaas — o que está sendo exercitado aqui é o
// serviço de webhook de verdade, não um atalho de teste.

const VALID_PASSWORD = "correcthorse1";

const createdUserIds: string[] = [];
const createdOrganizationIds: string[] = [];
const createdEventIds: string[] = [];

interface Trainer {
  userId: string;
  organizationId: string;
  trainerProfileId: string;
}

async function newTrainer(prefix: string): Promise<Trainer> {
  const trainer = await registerTrainer({
    name: `${prefix} Trainer`,
    email: uniqueEmail(prefix),
    password: VALID_PASSWORD,
  });
  createdUserIds.push(trainer.userId);
  createdOrganizationIds.push(trainer.organizationId);
  const profile = await prisma.trainerProfile.findUniqueOrThrow({
    where: { userId: trainer.userId },
  });
  return { ...trainer, trainerProfileId: profile.id };
}

// Entrega um evento como o gateway entregaria: corpo cru + header do segredo.
async function deliver(options: FakeEventOptions, secret: string = FAKE_WEBHOOK_SECRET) {
  createdEventIds.push(options.eventId);
  const headers = new Headers({ "asaas-access-token": secret });
  return handlePaymentWebhook(buildFakeWebhookBody(options), headers);
}

async function subscribe(trainer: Trainer, planSlug: string) {
  const result = await startSubscriptionCheckout(
    { planSlug, taxId: "12345678909" },
    { userId: trainer.userId, organizationId: trainer.organizationId },
  );
  const row = await prisma.subscription.findUniqueOrThrow({
    where: { id: result.subscriptionId },
  });
  return { result, gatewaySubscriptionId: row.gatewaySubscriptionId! };
}

beforeAll(async () => {
  // O provedor falso é o único aceitável aqui: um teste que falasse com o
  // Asaas de verdade criaria cobrança real. Falha explícita em vez de
  // suposição silenciosa.
  const provider = getPaymentProvider();
  if (provider.name !== "fake") {
    throw new Error(
      `Testes de billing exigem o FakePaymentProvider, mas o provedor ativo é "${provider.name}". ` +
        "Limpe PAYMENT_PROVIDER_SECRET_KEY/PAYMENT_PROVIDER_WEBHOOK_SECRET do .env de teste.",
    );
  }

  // Catálogo semeado pela migração 20260716140000.
  const plans = await prisma.subscriptionPlan.count({
    where: { slug: { in: ["free", "starter", "pro", "assessoria"] } },
  });
  if (plans < 4) {
    throw new Error("Catálogo de planos ausente — rode `prisma migrate deploy` antes dos testes.");
  }
});

afterAll(async () => {
  await prisma.webhookEvent.deleteMany({ where: { eventId: { in: createdEventIds } } });
  await prisma.paymentTransaction.deleteMany({
    where: { subscription: { organizationId: { in: createdOrganizationIds } } },
  });
  await prisma.subscription.deleteMany({
    where: { organizationId: { in: createdOrganizationIds } },
  });
  await prisma.auditLog.deleteMany({ where: { organizationId: { in: createdOrganizationIds } } });
  await prisma.athleteInvitation.deleteMany({
    where: { organizationId: { in: createdOrganizationIds } },
  });
  await prisma.coachAthleteRelationship.deleteMany({
    where: { organizationId: { in: createdOrganizationIds } },
  });
  await prisma.organizationMembership.deleteMany({
    where: { organizationId: { in: createdOrganizationIds } },
  });
  await prisma.trainerProfile.deleteMany({ where: { userId: { in: createdUserIds } } });
  await prisma.organization.deleteMany({ where: { id: { in: createdOrganizationIds } } });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
});

describe("Fase 10 — checkout (usuário assina)", () => {
  it("cria a assinatura INCOMPLETE e NÃO libera o plano só por ter ido ao checkout", async () => {
    const trainer = await newTrainer("billing-checkout");
    const { result, gatewaySubscriptionId } = await subscribe(trainer, "pro");

    expect(result.redirectUrl).toBeTruthy();
    expect(gatewaySubscriptionId).toMatch(/^sub_fake_/);

    const row = await prisma.subscription.findUniqueOrThrow({ where: { id: result.subscriptionId } });
    expect(row.status).toBe("INCOMPLETE");
    expect(row.provider).toBe("fake");

    // O ponto central: cobrança emitida ≠ pagamento confirmado. Antes do
    // webhook o treinador continua no grátis.
    const entitlements = await resolveEntitlements(trainer.organizationId);
    expect(entitlements.planSlug).toBe("free");
    expect(entitlements.isPaid).toBe(false);
  });

  it("usa o preço do CATÁLOGO, ignorando qualquer valor enviado pelo cliente", async () => {
    const trainer = await newTrainer("billing-price");
    // O schema já descarta campos de preço (teste unitário); aqui o que
    // importa é que o valor cobrado saiu do banco.
    const { result, gatewaySubscriptionId } = await subscribe(trainer, "pro");

    const plan = await prisma.subscriptionPlan.findUniqueOrThrow({ where: { slug: "pro" } });
    expect(Number(plan.price)).toBe(197);

    await deliver({
      eventId: `evt-price-${result.subscriptionId}`,
      type: "SUBSCRIPTION_ACTIVATED",
      gatewaySubscriptionId,
      amount: Number(plan.price),
    });

    const tx = await prisma.paymentTransaction.findFirstOrThrow({
      where: { subscriptionId: result.subscriptionId },
    });
    expect(Number(tx.amount)).toBe(197);
  });

  it("recusa checkout do plano grátis", async () => {
    const trainer = await newTrainer("billing-free");
    await expect(subscribe(trainer, "free")).rejects.toMatchObject({
      code: "BUSINESS_RULE_VIOLATION",
    });
  });

  it("recusa plano inexistente", async () => {
    const trainer = await newTrainer("billing-404");
    await expect(subscribe(trainer, "plano-que-nao-existe")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("reaproveita um checkout abandonado em vez de travar o treinador", async () => {
    const trainer = await newTrainer("billing-retry");
    const first = await subscribe(trainer, "starter");
    const second = await subscribe(trainer, "pro");

    // Mesma linha reutilizada — o índice parcial permite só uma assinatura
    // não-terminal por organização.
    expect(second.result.subscriptionId).toBe(first.result.subscriptionId);
    const count = await prisma.subscription.count({
      where: { organizationId: trainer.organizationId },
    });
    expect(count).toBe(1);
  });
});

describe("Fase 10 — webhook confirma", () => {
  it("ativa a assinatura e libera o plano", async () => {
    const trainer = await newTrainer("billing-activate");
    const { result, gatewaySubscriptionId } = await subscribe(trainer, "pro");

    const periodEnd = new Date("2026-08-16T00:00:00.000Z");
    const outcome = await deliver({
      eventId: `evt-activate-${result.subscriptionId}`,
      type: "SUBSCRIPTION_ACTIVATED",
      gatewaySubscriptionId,
      amount: 197,
      currentPeriodEnd: periodEnd,
    });
    expect(outcome.outcome).toBe("processed");

    const row = await prisma.subscription.findUniqueOrThrow({ where: { id: result.subscriptionId } });
    expect(row.status).toBe("ACTIVE");
    expect(row.currentPeriodEnd?.toISOString()).toBe(periodEnd.toISOString());

    const entitlements = await resolveEntitlements(trainer.organizationId);
    expect(entitlements.planSlug).toBe("pro");
    expect(entitlements.isPaid).toBe(true);
    expect(entitlements.limits.features).toContain("intelligence");

    // Auditado como SYSTEM — não havia usuário na requisição do gateway.
    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { organizationId: trainer.organizationId, action: "SUBSCRIPTION_ACTIVATED" },
    });
    expect(audit.actorType).toBe("SYSTEM");
    expect(audit.userId).toBeNull();
  });

  it("rejeita webhook com segredo inválido e não altera nada", async () => {
    const trainer = await newTrainer("billing-badsig");
    const { result, gatewaySubscriptionId } = await subscribe(trainer, "pro");

    await expect(
      deliver(
        {
          eventId: `evt-bad-${result.subscriptionId}`,
          type: "SUBSCRIPTION_ACTIVATED",
          gatewaySubscriptionId,
        },
        "segredo-errado",
      ),
    ).rejects.toThrow(/Token de webhook do gateway inválido/);

    const row = await prisma.subscription.findUniqueOrThrow({ where: { id: result.subscriptionId } });
    expect(row.status).toBe("INCOMPLETE");
    expect(await prisma.webhookEvent.count({ where: { eventId: `evt-bad-${result.subscriptionId}` } })).toBe(0);
  });

  it("ignora evento de assinatura desconhecida sem falhar", async () => {
    const outcome = await deliver({
      eventId: "evt-orfao-001",
      type: "SUBSCRIPTION_ACTIVATED",
      gatewaySubscriptionId: "sub_fake_inexistente",
    });
    expect(outcome.outcome).toBe("ignored");
    const row = await prisma.webhookEvent.findFirstOrThrow({ where: { eventId: "evt-orfao-001" } });
    expect(row.status).toBe("IGNORED");
  });
});

describe("Fase 10 — eventos duplicados são idempotentes", () => {
  it("a reentrega do MESMO evento não duplica assinatura nem pagamento", async () => {
    const trainer = await newTrainer("billing-idem");
    const { result, gatewaySubscriptionId } = await subscribe(trainer, "starter");

    const event: FakeEventOptions = {
      eventId: `evt-idem-${result.subscriptionId}`,
      type: "SUBSCRIPTION_ACTIVATED",
      gatewaySubscriptionId,
      gatewayPaymentId: `pay-idem-${result.subscriptionId}`,
      amount: 97,
    };

    const first = await deliver(event);
    const second = await deliver(event);
    const third = await deliver(event);

    expect(first.outcome).toBe("processed");
    expect(second.outcome).toBe("duplicate");
    expect(third.outcome).toBe("duplicate");

    // Uma assinatura, um pagamento, um registro de evento, uma linha de
    // auditoria — por mais que o gateway reenvie.
    expect(await prisma.subscription.count({ where: { organizationId: trainer.organizationId } })).toBe(1);
    expect(await prisma.paymentTransaction.count({ where: { subscriptionId: result.subscriptionId } })).toBe(1);
    expect(await prisma.webhookEvent.count({ where: { eventId: event.eventId } })).toBe(1);
    expect(
      await prisma.auditLog.count({
        where: { organizationId: trainer.organizationId, action: "SUBSCRIPTION_ACTIVATED" },
      }),
    ).toBe(1);
  });

  it("entregas simultâneas do mesmo evento aplicam o efeito uma única vez", async () => {
    const trainer = await newTrainer("billing-race");
    const { result, gatewaySubscriptionId } = await subscribe(trainer, "pro");

    const event: FakeEventOptions = {
      eventId: `evt-race-${result.subscriptionId}`,
      type: "SUBSCRIPTION_ACTIVATED",
      gatewaySubscriptionId,
      gatewayPaymentId: `pay-race-${result.subscriptionId}`,
      amount: 197,
    };

    // A corrida real: o gateway reentrega antes de a primeira terminar. É o
    // caso que um "SELECT antes do INSERT" deixaria passar — aqui quem decide
    // é o índice único, dentro da transação.
    const outcomes = await Promise.allSettled([deliver(event), deliver(event), deliver(event)]);
    const settled = outcomes.map((o) => (o.status === "fulfilled" ? o.value.outcome : "rejected"));

    expect(settled.filter((s) => s === "processed")).toHaveLength(1);
    expect(await prisma.paymentTransaction.count({ where: { subscriptionId: result.subscriptionId } })).toBe(1);
    expect(await prisma.webhookEvent.count({ where: { eventId: event.eventId } })).toBe(1);
  });

  it("PAYMENT_CONFIRMED e PAYMENT_RECEIVED da mesma cobrança geram UMA transação", async () => {
    const trainer = await newTrainer("billing-confirm-receive");
    const { result, gatewaySubscriptionId } = await subscribe(trainer, "starter");
    const gatewayPaymentId = `pay-dual-${result.subscriptionId}`;

    // Eventos DIFERENTES (ids distintos), mesma cobrança: a idempotência de
    // evento não protege aqui — quem protege é a chave por cobrança.
    await deliver({
      eventId: `evt-confirmed-${result.subscriptionId}`,
      type: "SUBSCRIPTION_ACTIVATED",
      gatewaySubscriptionId,
      gatewayPaymentId,
      amount: 97,
    });
    await deliver({
      eventId: `evt-received-${result.subscriptionId}`,
      type: "SUBSCRIPTION_RENEWED",
      gatewaySubscriptionId,
      gatewayPaymentId,
      amount: 97,
    });

    expect(await prisma.paymentTransaction.count({ where: { subscriptionId: result.subscriptionId } })).toBe(1);
  });
});

describe("Fase 10 — plano libera limite", () => {
  it("o plano grátis funciona, com limite de 1 atleta", async () => {
    const trainer = await newTrainer("billing-freelimit");

    const before = await getAthleteLimitStatus(trainer.organizationId);
    expect(before.max).toBe(1);
    expect(before.canAddMore).toBe(true);

    // O grátis FUNCIONA — o primeiro atleta entra normalmente.
    await inviteAthlete({ email: uniqueEmail("free-athlete-1") }, trainer);

    const after = await getAthleteLimitStatus(trainer.organizationId);
    expect(after).toMatchObject({ used: 1, max: 1, canAddMore: false });

    // O segundo é recusado — e a recusa não deixa lixo para trás.
    await expect(
      inviteAthlete({ email: uniqueEmail("free-athlete-2") }, trainer),
    ).rejects.toMatchObject({ code: "BUSINESS_RULE_VIOLATION" });

    expect(
      await prisma.coachAthleteRelationship.count({ where: { organizationId: trainer.organizationId } }),
    ).toBe(1);
    expect(
      await prisma.athleteInvitation.count({ where: { organizationId: trainer.organizationId } }),
    ).toBe(1);
  });

  it("assinar o Pro libera o limite imediatamente após a confirmação", async () => {
    const trainer = await newTrainer("billing-upgrade");
    await inviteAthlete({ email: uniqueEmail("up-athlete-1") }, trainer);

    // No grátis, o segundo atleta é barrado.
    await expect(inviteAthlete({ email: uniqueEmail("up-athlete-2") }, trainer)).rejects.toMatchObject({
      code: "BUSINESS_RULE_VIOLATION",
    });

    const { result, gatewaySubscriptionId } = await subscribe(trainer, "pro");
    await deliver({
      eventId: `evt-up-${result.subscriptionId}`,
      type: "SUBSCRIPTION_ACTIVATED",
      gatewaySubscriptionId,
      amount: 197,
    });

    // Confirmado o pagamento, o mesmo convite passa.
    const invitation = await inviteAthlete({ email: uniqueEmail("up-athlete-2b") }, trainer);
    expect(invitation.invitationId).toBeTruthy();

    const status = await getAthleteLimitStatus(trainer.organizationId);
    expect(status).toMatchObject({ used: 2, max: 50, canAddMore: true });
  });

  it("o plano Assessoria não tem teto de atletas", async () => {
    const trainer = await newTrainer("billing-unlimited");
    const { result, gatewaySubscriptionId } = await subscribe(trainer, "assessoria");
    await deliver({
      eventId: `evt-unlimited-${result.subscriptionId}`,
      type: "SUBSCRIPTION_ACTIVATED",
      gatewaySubscriptionId,
      amount: 397,
    });

    const status = await getAthleteLimitStatus(trainer.organizationId);
    expect(status.max).toBeNull();
    expect(status.canAddMore).toBe(true);
  });
});

describe("Fase 10 — falha de pagamento não apaga dados", () => {
  it("inadimplência degrada para o limite grátis e preserva TODOS os atletas", async () => {
    const trainer = await newTrainer("billing-pastdue");
    const { result, gatewaySubscriptionId } = await subscribe(trainer, "pro");
    await deliver({
      eventId: `evt-pd-active-${result.subscriptionId}`,
      type: "SUBSCRIPTION_ACTIVATED",
      gatewaySubscriptionId,
      amount: 197,
    });

    await inviteAthlete({ email: uniqueEmail("pd-athlete-1") }, trainer);
    await inviteAthlete({ email: uniqueEmail("pd-athlete-2") }, trainer);
    await inviteAthlete({ email: uniqueEmail("pd-athlete-3") }, trainer);

    await deliver({
      eventId: `evt-pd-fail-${result.subscriptionId}`,
      type: "PAYMENT_FAILED",
      gatewaySubscriptionId,
      gatewayPaymentId: `pay-pd-${result.subscriptionId}`,
      amount: 197,
    });

    const row = await prisma.subscription.findUniqueOrThrow({ where: { id: result.subscriptionId } });
    expect(row.status).toBe("PAST_DUE");

    // Degrada...
    const entitlements = await resolveEntitlements(trainer.organizationId);
    expect(entitlements.planSlug).toBe("free");
    expect(entitlements.isDegraded).toBe(true);

    // ...mas NÃO apaga: os 3 atletas continuam lá, mesmo acima do limite
    // grátis. Só não dá para adicionar o 4º.
    const status = await getAthleteLimitStatus(trainer.organizationId);
    expect(status).toMatchObject({ used: 3, max: 1, canAddMore: false });
    expect(
      await prisma.coachAthleteRelationship.count({
        where: { organizationId: trainer.organizationId, isActive: true },
      }),
    ).toBe(3);

    // O pagamento falho fica registrado como FAILED, não some.
    const tx = await prisma.paymentTransaction.findFirstOrThrow({
      where: { subscriptionId: result.subscriptionId, gatewayRefId: `pay-pd-${result.subscriptionId}` },
    });
    expect(tx.status).toBe("FAILED");

    // Regularizado, tudo volta na hora.
    await deliver({
      eventId: `evt-pd-recover-${result.subscriptionId}`,
      type: "SUBSCRIPTION_RENEWED",
      gatewaySubscriptionId,
      amount: 197,
    });
    const recovered = await resolveEntitlements(trainer.organizationId);
    expect(recovered.planSlug).toBe("pro");
    expect(recovered.isDegraded).toBe(false);
  });
});

describe("Fase 10 — cancelamento muda status", () => {
  it("cancela no gateway, marca a intenção e só o webhook muda o status", async () => {
    const trainer = await newTrainer("billing-cancel");
    const { result, gatewaySubscriptionId } = await subscribe(trainer, "pro");
    await deliver({
      eventId: `evt-cancel-active-${result.subscriptionId}`,
      type: "SUBSCRIPTION_ACTIVATED",
      gatewaySubscriptionId,
      amount: 197,
    });

    const cancelled = await requestSubscriptionCancellation({
      userId: trainer.userId,
      organizationId: trainer.organizationId,
    });

    // Intenção registrada; status AINDA ativo — nada de otimismo local.
    expect(cancelled.cancelAtPeriodEnd).toBe(true);
    expect(cancelled.status).toBe("ACTIVE");

    // O gateway confirma → aí sim o status muda.
    await deliver({
      eventId: `evt-cancel-done-${result.subscriptionId}`,
      type: "SUBSCRIPTION_CANCELLED",
      gatewaySubscriptionId,
    });

    const row = await prisma.subscription.findUniqueOrThrow({ where: { id: result.subscriptionId } });
    expect(row.status).toBe("CANCELLED");
    expect(row.cancelledAt).not.toBeNull();

    // Volta ao grátis, com os dados intactos.
    const entitlements = await resolveEntitlements(trainer.organizationId);
    expect(entitlements.planSlug).toBe("free");

    const view = await getCurrentSubscription(trainer.organizationId);
    expect(view.subscription?.status).toBe("CANCELLED");
  });

  it("uma assinatura cancelada não ressuscita por evento de pagamento atrasado", async () => {
    const trainer = await newTrainer("billing-zombie");
    const { result, gatewaySubscriptionId } = await subscribe(trainer, "pro");
    await deliver({
      eventId: `evt-z-active-${result.subscriptionId}`,
      type: "SUBSCRIPTION_ACTIVATED",
      gatewaySubscriptionId,
      amount: 197,
    });
    await deliver({
      eventId: `evt-z-cancel-${result.subscriptionId}`,
      type: "SUBSCRIPTION_CANCELLED",
      gatewaySubscriptionId,
    });

    // Evento de pagamento que estava na fila do gateway chega DEPOIS do
    // cancelamento. Não pode reativar um plano que o treinador cancelou.
    await deliver({
      eventId: `evt-z-late-${result.subscriptionId}`,
      type: "SUBSCRIPTION_ACTIVATED",
      gatewaySubscriptionId,
      amount: 197,
    });

    const row = await prisma.subscription.findUniqueOrThrow({ where: { id: result.subscriptionId } });
    expect(row.status).toBe("CANCELLED");
  });

  it("recusa cancelar quando não há assinatura", async () => {
    const trainer = await newTrainer("billing-nocancel");
    await expect(
      requestSubscriptionCancellation({
        userId: trainer.userId,
        organizationId: trainer.organizationId,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
