-- Fase 10 — catálogo comercial definitivo.
--
-- Por que uma migração NOVA e não uma edição da 20260716140000: aquela já foi
-- aplicada (dev, preview e produção). Editar migração aplicada muda o checksum,
-- quebra `prisma migrate dev` de quem já rodou, e — o principal — NUNCA chega
-- aos bancos que já a aplicaram: o catálogo errado continuaria lá. Migração
-- aplicada é imutável; correção de dado é migração nova.
--
-- O que a 20260716140000 semeou eram PLACEHOLDERS (trainer_basic R$ 79,90 /
-- trainer_pro R$ 179,90) e um limite grátis de 3 atletas inventado. Os valores
-- decididos são:
--
--   Grátis     R$   0,00  ·  1 atleta   ·  prescrição manual
--   Starter    R$  97,00  ·  15 atletas ·  + biblioteca, modelos, relatórios
--   Pro        R$ 197,00  ·  50 atletas ·  + periodização, inteligência, premium
--   Assessoria R$ 397,00  ·  ilimitado  ·  mesmos recursos do Pro
--
-- O limite de 1 atleta do grátis é anterior a esta fase e foi reafirmado como
-- definitivo — não o altere sem decisão comercial explícita. Pro e Assessoria
-- têm os mesmos recursos e diferem por volume; o diferencial real da Assessoria
-- (múltiplos treinadores na mesma organização) é da Fase 6 (ADR-001).
--
-- Tudo é UPDATE/UPSERT em cima da linha existente — nunca DELETE + INSERT.
-- Subscription.subscriptionPlanId é ON DELETE RESTRICT: apagar um plano
-- assinado falharia, e se não falhasse levaria junto o histórico de quem
-- assinou. Renomear preserva a assinatura e o vínculo.

-- 1. Slugs placeholder → slugs definitivos. Idempotente: na segunda execução
--    não há mais linha com o slug antigo e o UPDATE afeta 0 linhas.
UPDATE "SubscriptionPlan" SET "slug" = 'starter' WHERE "slug" = 'trainer_basic';
UPDATE "SubscriptionPlan" SET "slug" = 'pro'     WHERE "slug" = 'trainer_pro';

-- 2. Catálogo canônico, por slug. ON CONFLICT DO UPDATE (e não DO NOTHING):
--    aqui a intenção é justamente CONVERGIR as linhas que já existem com os
--    valores errados. Reexecutar converge para o mesmo estado.
--
--    O plano grátis legado guardava `featuresLimits` no formato antigo de
--    flags booleanas ({"intelligence": true, "reports": true, ...}), que
--    planLimitsSchema não lê — as flags seriam ignoradas em silêncio. Este
--    UPDATE normaliza para {maxAthletes, features}.
INSERT INTO "SubscriptionPlan"
  ("id", "slug", "name", "description", "price", "currency", "billingCycle", "featuresLimits", "sortOrder", "isActive", "createdAt", "updatedAt")
VALUES
  (
    gen_random_uuid(), 'free', 'Grátis',
    'Para experimentar: 1 atleta e prescrição manual.',
    0.00, 'BRL', 'MENSAL',
    '{"maxAthletes": 1, "features": []}'::jsonb,
    0, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
  ),
  (
    gen_random_uuid(), 'starter', 'Starter',
    'Até 15 atletas, com biblioteca de exercícios, modelos de treino e relatórios.',
    97.00, 'BRL', 'MENSAL',
    '{"maxAthletes": 15, "features": ["templates", "exercise_library", "reports"]}'::jsonb,
    1, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
  ),
  (
    gen_random_uuid(), 'pro', 'Pro',
    'Até 50 atletas, com periodização, Inteligência ENKY e relatórios premium.',
    197.00, 'BRL', 'MENSAL',
    '{"maxAthletes": 50, "features": ["templates", "exercise_library", "reports", "periodization", "intelligence", "premium_reports"]}'::jsonb,
    2, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
  ),
  (
    gen_random_uuid(), 'assessoria', 'Assessoria',
    'Atletas ilimitados, com todos os recursos do Pro. Para carteiras grandes.',
    397.00, 'BRL', 'MENSAL',
    '{"maxAthletes": null, "features": ["templates", "exercise_library", "reports", "periodization", "intelligence", "premium_reports"]}'::jsonb,
    3, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
  )
ON CONFLICT ("slug") DO UPDATE SET
  "name"           = EXCLUDED."name",
  "description"    = EXCLUDED."description",
  "price"          = EXCLUDED."price",
  "currency"       = EXCLUDED."currency",
  "billingCycle"   = EXCLUDED."billingCycle",
  "featuresLimits" = EXCLUDED."featuresLimits",
  "sortOrder"      = EXCLUDED."sortOrder",
  "isActive"       = EXCLUDED."isActive",
  "updatedAt"      = CURRENT_TIMESTAMP;
