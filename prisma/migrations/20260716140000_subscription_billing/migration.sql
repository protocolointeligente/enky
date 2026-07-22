-- Fase 10 — Marketplace, Planos e Pagamentos.
--
-- Três mudanças, todas aditivas (nenhuma coluna removida, nenhum dado
-- destruído — inadimplência e falha de pagamento nunca apagam dados):
--   1. SubscriptionPlan ganha identidade estável (`slug`) e os campos
--      comerciais que o checkout precisa ler do SERVIDOR (preço, moeda,
--      id de preço no gateway). O cliente nunca envia preço.
--   2. Subscription ganha o vínculo com o gateway (provider, customer).
--   3. WebhookEvent: livro-razão de idempotência de webhook.
--
-- O índice `uq_active_subscription_per_organization` (migração
-- 20260710104346) já garante no máximo uma assinatura não-terminal por
-- organização — nada a fazer aqui.

-- ---------------------------------------------------------------------------
-- 1. SubscriptionPlan — catálogo comercial
-- ---------------------------------------------------------------------------
ALTER TABLE "SubscriptionPlan"
  ADD COLUMN "slug"           TEXT,
  ADD COLUMN "description"    TEXT,
  ADD COLUMN "currency"       VARCHAR(3) NOT NULL DEFAULT 'BRL',
  ADD COLUMN "gatewayPriceId" TEXT,
  ADD COLUMN "sortOrder"      INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "updatedAt"      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Antes da Fase 10 o catálogo era semeado por NOME (prisma/seed-plans.mjs),
-- sem slug. Esse plano legado É o plano grátis — reconcilia com o slug
-- canônico ANTES do backfill genérico. Sem isto, o backfill derivaria 'gr_tis'
-- de 'Grátis' (o "á" não é alfanumérico), o catálogo do item 4 não o
-- reconheceria, e o INSERT colidiria em "name" (23505) — que é o que derrubou
-- esta migração em produção e no preview.
UPDATE "SubscriptionPlan" SET "slug" = 'free' WHERE "slug" IS NULL AND "name" = 'Grátis';

-- Backfill de linhas pré-existentes antes do NOT NULL: em bancos já criados
-- (dev/preview) pode haver plano sem slug. Deriva do nome; colisões de slug são
-- impossíveis porque "name" já é UNIQUE.
UPDATE "SubscriptionPlan"
   SET "slug" = LOWER(REGEXP_REPLACE("name", '[^a-zA-Z0-9]+', '_', 'g'))
 WHERE "slug" IS NULL;

ALTER TABLE "SubscriptionPlan" ALTER COLUMN "slug" SET NOT NULL;
CREATE UNIQUE INDEX "SubscriptionPlan_slug_key" ON "SubscriptionPlan" ("slug");

-- Preço nunca negativo — o checkout lê este valor como autoridade final.
ALTER TABLE "SubscriptionPlan"
  ADD CONSTRAINT "chk_subscription_plan_price" CHECK ("price" >= 0);

-- ---------------------------------------------------------------------------
-- 2. Subscription — vínculo com o gateway
-- ---------------------------------------------------------------------------
ALTER TABLE "Subscription"
  ADD COLUMN "provider"          TEXT,
  ADD COLUMN "gatewayCustomerId" TEXT;

-- ---------------------------------------------------------------------------
-- 3. WebhookEvent — idempotência de TODO evento, não só dos que geram
--    transação (PaymentTransaction."webhookEventId" cobre apenas esses).
-- ---------------------------------------------------------------------------
CREATE TYPE "WebhookEventStatus" AS ENUM ('PROCESSED', 'IGNORED', 'FAILED');

CREATE TABLE "WebhookEvent" (
  "id"          TEXT NOT NULL,
  "provider"    TEXT NOT NULL,
  "eventId"     TEXT NOT NULL,
  "eventType"   TEXT NOT NULL,
  "payloadHash" TEXT NOT NULL,
  "status"      "WebhookEventStatus" NOT NULL DEFAULT 'PROCESSED',
  "error"       TEXT,
  "receivedAt"  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMPTZ,

  CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- A trava de idempotência. Segunda entrega do mesmo evento colide aqui,
-- dentro da mesma transação que aplica o efeito — ou tudo é aplicado uma
-- vez, ou nada é reaplicado.
CREATE UNIQUE INDEX "uq_webhook_provider_event" ON "WebhookEvent" ("provider", "eventId");
CREATE INDEX "WebhookEvent_eventType_idx" ON "WebhookEvent" ("eventType");
CREATE INDEX "WebhookEvent_receivedAt_idx" ON "WebhookEvent" ("receivedAt");

-- ---------------------------------------------------------------------------
-- 4. Catálogo inicial (Fase 10 §2): grátis, treinador básico, profissional.
--    Idempotente (ON CONFLICT DO NOTHING) e seguro em produção — é dado de
--    catálogo, não dado de demonstração. `gatewayPriceId` fica nulo: o Asaas
--    cobra por valor na criação da assinatura, não por um id de preço
--    pré-cadastrado; a coluna existe para gateways que exigem (ex.: Stripe).
--
--    `featuresLimits` é validado por planLimitsSchema
--    (modules/subscriptions/plan-limits.ts) na leitura. maxAthletes null =
--    ilimitado. O plano FREE nunca vai a checkout (price = 0).
-- ---------------------------------------------------------------------------
INSERT INTO "SubscriptionPlan"
  ("id", "slug", "name", "description", "price", "currency", "billingCycle", "featuresLimits", "sortOrder", "isActive", "createdAt", "updatedAt")
VALUES
  (
    gen_random_uuid(), 'free', 'Grátis',
    'Para começar: até 3 atletas e prescrição manual.',
    0.00, 'BRL', 'MENSAL',
    '{"maxAthletes": 3, "features": []}'::jsonb,
    0, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
  ),
  (
    gen_random_uuid(), 'trainer_basic', 'Treinador Básico',
    'Até 25 atletas, biblioteca de exercícios e modelos de treino.',
    79.90, 'BRL', 'MENSAL',
    '{"maxAthletes": 25, "features": ["templates", "exercise_library", "reports"]}'::jsonb,
    1, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
  ),
  (
    gen_random_uuid(), 'trainer_pro', 'Treinador Profissional',
    'Atletas ilimitados, periodização, inteligência e relatórios premium.',
    179.90, 'BRL', 'MENSAL',
    '{"maxAthletes": null, "features": ["templates", "exercise_library", "reports", "periodization", "intelligence", "premium_reports"]}'::jsonb,
    2, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
  )
ON CONFLICT ("slug") DO NOTHING;
