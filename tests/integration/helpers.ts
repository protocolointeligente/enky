import { randomUUID } from "node:crypto";
import { prisma } from "@/infrastructure/database/prisma";

export function uniqueEmail(prefix: string): string {
  return `${prefix}+${randomUUID()}@integration-test.enky.local`;
}

export function uniqueSlug(prefix: string): string {
  return `${prefix}-${randomUUID()}`;
}

// A partir da Fase 10 o plano grátis vale 1 atleta, e `inviteAthlete` aplica o
// limite. Todo cenário que precisa de MAIS de um atleta na mesma organização
// precisa, portanto, de um plano pago — o que também é a verdade do produto:
// um treinador com dois atletas está pagando.
//
// Usa o plano `assessoria` (ilimitado) para que o teste exercite o SEU assunto
// e não esbarre num teto de plano intermediário.
//
// A assinatura é criada direto no banco, e não pelo checkout: o assunto destes
// testes não é billing (esse é o de tests/integration/subscription-billing.test.ts)
// e passar por gateway aqui só acoplaria suítes sem relação.
export async function grantUnlimitedPlan(organizationId: string): Promise<void> {
  const plan = await prisma.subscriptionPlan.findUniqueOrThrow({ where: { slug: "assessoria" } });
  await prisma.subscription.create({
    data: { organizationId, subscriptionPlanId: plan.id, status: "ACTIVE" },
  });
}

// `Subscription.organization` é ON DELETE RESTRICT: uma assinatura pendurada
// impede o `organization.deleteMany` de qualquer teardown. Chame antes de
// apagar as organizações do cenário.
export async function cleanupSubscriptions(organizationIds: string[]): Promise<void> {
  if (organizationIds.length === 0) return;
  await prisma.paymentTransaction.deleteMany({
    where: { subscription: { organizationId: { in: organizationIds } } },
  });
  await prisma.subscription.deleteMany({ where: { organizationId: { in: organizationIds } } });
}
