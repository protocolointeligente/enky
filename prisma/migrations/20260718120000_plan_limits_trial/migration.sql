-- Fase 05 — limites configuráveis por dimensão + trial por plano. Migração
-- ADITIVA: nova coluna com default e UPSERT convergente do catálogo (nunca
-- DELETE). Editar migração já aplicada é proibido — correção/enriquecimento de
-- catálogo é sempre migração nova (mesma regra de 20260717120000).

-- 1. Trial configurável por plano (0 = sem trial).
ALTER TABLE "SubscriptionPlan" ADD COLUMN "trialDays" INTEGER NOT NULL DEFAULT 0;

-- 2. Enriquece `featuresLimits` das linhas canônicas com as novas dimensões
--    (maxTrainers/maxTemplates/maxStorageMb) e a feature `integrations`, e
--    define o trial. Convergente: reexecutar leva ao mesmo estado. Só toca os
--    slugs conhecidos — um catálogo customizado pela operação não é sobrescrito.
UPDATE "SubscriptionPlan" SET
  "featuresLimits" = '{"maxAthletes": 1, "maxTrainers": 1, "maxTemplates": 3, "maxStorageMb": 100, "features": []}'::jsonb,
  "trialDays" = 0,
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "slug" = 'free';

UPDATE "SubscriptionPlan" SET
  "featuresLimits" = '{"maxAthletes": 15, "maxTrainers": 1, "maxTemplates": 50, "maxStorageMb": 2048, "features": ["templates", "exercise_library", "reports"]}'::jsonb,
  "trialDays" = 7,
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "slug" = 'starter';

UPDATE "SubscriptionPlan" SET
  "featuresLimits" = '{"maxAthletes": 50, "maxTrainers": 1, "maxTemplates": null, "maxStorageMb": 10240, "features": ["templates", "exercise_library", "reports", "periodization", "intelligence", "premium_reports", "integrations"]}'::jsonb,
  "trialDays" = 7,
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "slug" = 'pro';

UPDATE "SubscriptionPlan" SET
  "featuresLimits" = '{"maxAthletes": null, "maxTrainers": null, "maxTemplates": null, "maxStorageMb": null, "features": ["templates", "exercise_library", "reports", "periodization", "intelligence", "premium_reports", "integrations", "marketplace"]}'::jsonb,
  "trialDays" = 0,
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "slug" = 'assessoria';
