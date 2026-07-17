import type { Prisma, SubscriptionStatus } from "@prisma/client";
import { BusinessRuleError } from "@/domain/errors";
import { prisma } from "@/infrastructure/database/prisma";
import { logger } from "@/server/observability/logger";
import {
  FREE_LIMITS,
  FREE_PLAN_SLUG,
  parsePlanLimits,
  type PlanFeature,
  type PlanLimits,
} from "./plan-limits";

// O que uma organização PODE fazer agora. Fonte única — nenhuma rota, tela ou
// serviço decide limite por conta própria.
//
// Só ACTIVE e TRIALING dão direito ao plano pago. Todo o resto —
// PAST_DUE, UNPAID, INCOMPLETE, PAUSED, CANCELLED, EXPIRED — cai para o plano
// GRÁTIS, e essa é a decisão central da inadimplência nesta fase:
//
//   inadimplência DEGRADA, nunca apaga (modules/subscriptions/README.md).
//
// Na prática: o treinador que tinha 40 atletas e deixou de pagar continua
// vendo, treinando e exportando os 40 — nada é removido, nada fica órfão. Ele
// apenas não CRIA o 41º enquanto não regularizar. Um limite que apagasse
// atletas para "caber" no plano grátis destruiria dados de terceiros (os
// atletas) por uma disputa comercial com o treinador; isso nunca acontece.
//
// INCOMPLETE também cai aqui de propósito: é o estado de quem começou o
// checkout e ainda não pagou. Liberar recurso nesse ponto seria confiar na
// intenção de pagar, e não no pagamento confirmado.
const ENTITLED_STATUSES: readonly SubscriptionStatus[] = ["ACTIVE", "TRIALING"];

export interface Entitlements {
  planSlug: string;
  planName: string;
  limits: PlanLimits;
  // Status da assinatura, ou null se a organização nunca assinou.
  subscriptionStatus: SubscriptionStatus | null;
  // true quando um plano PAGO está valendo agora.
  isPaid: boolean;
  // true quando existe assinatura, mas o status não dá direito (inadimplente,
  // cancelada, checkout não concluído) — a UI usa isto para explicar POR QUE
  // o treinador está no limite grátis.
  isDegraded: boolean;
}

function freeEntitlements(
  status: SubscriptionStatus | null,
  planName = "Grátis",
  limits: PlanLimits = FREE_LIMITS,
): Entitlements {
  return {
    planSlug: FREE_PLAN_SLUG,
    planName,
    limits,
    subscriptionStatus: status,
    isPaid: false,
    isDegraded: status !== null,
  };
}

// As leituras aceitam um cliente Prisma explícito (transação ou cliente
// global). Útil para quem já está numa transação e quer consistência de
// leitura com ela — não é, por si, garantia de exclusão mútua; ver a nota
// sobre corrida em `assertCanAddAthlete`.
export type Db = Prisma.TransactionClient;

export async function resolveEntitlements(
  organizationId: string,
  db: Db = prisma,
): Promise<Entitlements> {
  const subscription = await db.subscription.findFirst({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
    include: { plan: true },
  });

  if (subscription && ENTITLED_STATUSES.includes(subscription.status)) {
    return {
      planSlug: subscription.plan.slug,
      planName: subscription.plan.name,
      limits: parsePlanLimits(subscription.plan.featuresLimits),
      subscriptionStatus: subscription.status,
      isPaid: Number(subscription.plan.price) > 0,
      isDegraded: false,
    };
  }

  // Sem direito a plano pago → grátis, lido do catálogo para que operação
  // possa ajustar o limite sem deploy. Se a linha sumiu ou foi desativada,
  // FREE_LIMITS em código segura o produto de pé.
  const freePlan = await db.subscriptionPlan.findUnique({ where: { slug: FREE_PLAN_SLUG } });
  if (!freePlan) {
    logger.error({ organizationId }, "plano grátis ausente do catálogo — usando limites em código");
    return freeEntitlements(subscription?.status ?? null);
  }

  return freeEntitlements(
    subscription?.status ?? null,
    freePlan.name,
    parsePlanLimits(freePlan.featuresLimits),
  );
}

// Atletas que contam para o limite: vínculos ATIVOS da organização. Um atleta
// desvinculado não ocupa vaga — e um convite pendente ocupa, porque
// `inviteAthlete` já cria o CoachAthleteRelationship (ativo) junto do convite.
// Contar só atletas ativados deixaria o treinador furar o limite convidando
// em massa.
export async function countActiveAthletes(organizationId: string, db: Db = prisma): Promise<number> {
  return db.coachAthleteRelationship.count({
    where: { organizationId, isActive: true },
  });
}

export interface AthleteLimitStatus {
  used: number;
  // null = ilimitado.
  max: number | null;
  canAddMore: boolean;
}

export async function getAthleteLimitStatus(
  organizationId: string,
  db: Db = prisma,
): Promise<AthleteLimitStatus> {
  const [entitlements, used] = await Promise.all([
    resolveEntitlements(organizationId, db),
    countActiveAthletes(organizationId, db),
  ]);
  const max = entitlements.limits.maxAthletes;
  return { used, max, canAddMore: max === null || used < max };
}

// Chamado DENTRO do caso de uso de convite (não só na rota) — o limite é um
// invariante de negócio, não um detalhe de HTTP. Mesmo raciocínio que levou
// `requireTrainerAccessToAthlete` para dentro de create-workout-draft.ts
// (docs/ARCHITECTURE.md, exceção da Fase 02C): um futuro ponto de entrada
// (importação em lote, API pública) não pode furar o limite por esquecer de
// checar na borda.
//
// LIMITE SUAVE, e isto é deliberado. Dois convites simultâneos na fronteira do
// limite podem passar os dois, e a organização fica com um atleta a mais do que
// o plano permite. Rodar esta checagem dentro da transação do convite NÃO
// resolve: no READ COMMITTED (padrão do PostgreSQL) duas transações
// concorrentes contam a mesma coisa e nenhuma bloqueia a outra. Fechar a janela
// de verdade exigiria SERIALIZABLE ou lock explícito na organização —
// custo real (latência + retry de serialização) no caminho quente do convite.
//
// Aceitável porque isto é um teto COMERCIAL, não uma fronteira de segurança:
// o pior caso é um atleta a mais numa corrida rara, que o próximo convite já
// barra, sem vazar dado de ninguém. Fronteiras de segurança (tenant, vínculo
// treinador-atleta) não são tratadas assim em lugar nenhum deste código.
// Se algum dia o teto precisar ser rígido, o lugar é aqui — e o teste da
// corrida precisa vir junto.
export async function assertCanAddAthlete(organizationId: string, db: Db = prisma): Promise<void> {
  const status = await getAthleteLimitStatus(organizationId, db);
  if (status.canAddMore) return;

  throw new BusinessRuleError(
    `Seu plano permite até ${status.max} atleta(s) e você já tem ${status.used}. ` +
      "Faça upgrade do plano para adicionar mais atletas.",
  );
}

export async function hasFeature(organizationId: string, feature: PlanFeature): Promise<boolean> {
  const entitlements = await resolveEntitlements(organizationId);
  return entitlements.limits.features.includes(feature);
}

export async function assertFeature(organizationId: string, feature: PlanFeature): Promise<void> {
  if (await hasFeature(organizationId, feature)) return;
  throw new BusinessRuleError("Este recurso não está disponível no seu plano atual.");
}
