# ENKY OS — Estado Atual (Auditoria Fase 0)

**Data:** 2026-07-17
**Branch auditada:** `feat/fase-03-foundation-stabilization` (criada a partir de `feat/fase-02d-calendar-library`, que está **13 commits à frente de `main`**).
**Autor:** Auditoria de sincronização documento ↔ código.

> **Achado principal:** o código está muito à frente do que o `README.md` e vários
> `README` de módulo declaram. O `README.md` diz "Fase 02G" e afirma que
> "marketplace, pagamentos, periodização, relatórios e admin permanecem como
> fundação/especificação, sem produto funcional". **Isso é falso hoje:** o
> histórico da branch e o código contêm as Fases 6, 8, 9, 10, 11 e 12
> implementadas. A auditoria abaixo reflete o **código real**, não os READMEs.

---

## 1. Funcionalidades implementadas

| Domínio | Estado | Evidência |
|---|---|---|
| Identidade / auth (registro, login, logout, sessão, reset de senha) | ✅ | `modules/identity`, `server/auth/*`, `app/api/auth/*` |
| Sessão opaca revogável (por token e por usuário) | ✅ | `server/auth/session.ts` (`revokeSession`, `revokeAllSessionsForUser`) |
| Organização pessoal implícita por treinador (ADR-001) | ✅ | `modules/organizations`, `server/auth/guards.ts` |
| Convite de atleta (criar / reenviar / revogar / ativar) | ✅ | `app/api/athletes/invitations/*`, `modules/athletes` |
| Gestão de roster | ✅ | `app/api/trainer/athletes/roster`, `modules/athletes` |
| Biblioteca de exercícios (global + org, vídeo, modalidade, equipamento, nível, licença/crédito) | ✅ | `modules/exercises`, migration `exercise_library_metadata`, `app/api/trainer/exercises/*` |
| Templates (criar / editar / duplicar / arquivar / reativar / aplicar) | ✅ | `modules/templates`, `app/api/trainer/templates/*` |
| Treinos (criar / editar / duplicar / publicar / mover / copiar semana / cancelar / arquivar / salvar como template) | ✅ | `modules/workouts/*` (14 casos de uso), `app/api/trainer/workouts/*` |
| Portal do atleta (calendário, detalhe, execução guiada, vídeo, marcação de concluído) | ✅ | `app/atleta/*`, `app/api/athlete/*`, `modules/workouts/get-athlete-workout.ts` |
| Feedback (status, duração, RPE, sRPE, dor/desconforto, observação, confiança) | ✅ | `modules/feedback/*` (`session-rpe.ts`, `submit-workout-feedback.ts`) |
| Treinador vê execução + feedback | ✅ | `modules/feedback/get-trainer-workout-feedback.ts`, `app/api/trainer/workouts/[id]/feedback` |
| ENKY Intelligence — motor de atenção (determinístico, explicável, sem LLM) | ✅ | `modules/intelligence/attention.ts`, `analyze-workout.ts`, `interpret-feedback.ts` |
| Intelligence — persistência de insight + ciclo de decisão (aceito/ignorado) | ✅ | `modules/intelligence/insight-store.ts`, migration `add_insight_lifecycle`, `app/api/trainer/intelligence/insights/[id]/decision` |
| Intelligence — check-in de prontidão/recuperação | ✅ | `modules/intelligence/readiness*.ts`, migration `add_readiness_checkin` |
| Periodização — geração assistida multiesporte por semana + modo AUTOMATIC / escopo FULL_CYCLE (Fase 6) | ✅ | `modules/periodization/*`, `app/api/trainer/periodizations/*` |
| Relatórios premium com PDF, compartilhamento e revogação (Fase 8) | ✅ | `modules/reports`, `app/api/trainer/reports/*`, `app/api/athlete/reports/*` |
| Painel administrativo / superadmin (Fase 9) | ✅ | `app/admin/*`, `app/api/admin/*`, `modules/admin` |
| Planos e pagamentos — Asaas atrás de `PaymentProvider`, webhook idempotente (Fase 10) | ✅ | `modules/payments`, `modules/subscriptions`, `app/api/trainer/billing/*`, `app/api/webhooks/payment-provider` |
| Integração Strava v1 (Fase 11) | ✅ | `modules/integrations`, `app/api/athlete/integrations/strava/*`, `app/api/webhooks/strava` |
| Feed de novidades para o treinador | ✅ | `modules/content`, `app/api/novidades`, `app/treinador/novidades` |
| Segurança transversal: CSRF de origem, rate limiting, logging estruturado com redação, erros padronizados | ✅ | `server/security/{csrf,rate-limit,crypto,ip}.ts`, `server/observability/logger.ts`, `domain/errors.ts` |
| Observabilidade: `instrumentation.ts` (`onRequestError`), `app/global-error.tsx` | ✅ | raiz do repo, Fase 12 |
| Operação: OPERATIONS.md, ROLLBACK.md, PRODUCTION_READINESS.md, scripts de bootstrap/seed com guard de produção | ✅ | `docs/*`, `scripts/*` |

## 2. Funcionalidades parcialmente implementadas

| Item | O que existe | O que falta |
|---|---|---|
| Organizações multiusuário (assessoria com vários treinadores) | Enums `OrganizationRole` (OWNER/COACH/ADMIN/SUPPORT), matriz de permissões, org pessoal por treinador | UI e fluxo de convite de membro da org; hoje todo treinador é OWNER da própria org (ADR-001, adiado para "Fase 6" do roadmap oficial) |
| Metric Registry | Especificado (`docs/ENKY_METRIC_REGISTRY.md`, `ENKY_METRICS_CATALOG.md`) | `modules/metrics` só tem README — relatórios usam caminho próprio, o registry catalogado não foi implementado |

## 3. Funcionalidades apenas especificadas (sem produto funcional)

| Item | Fonte da especificação | Estado no código |
|---|---|---|
| Marketplace (venda de método/planos) | Constitution §14, Product Spec | `modules/marketplace` = só README |
| Metric Registry programável | `docs/ENKY_METRIC_REGISTRY.md` | `modules/metrics` = só README |

## 4. Rotas existentes

**API (route handlers):** 70+ handlers sob `app/api/`, incluindo `auth/*`, `athletes/invitations/*`,
`trainer/{athletes,calendar,exercises,templates,workouts,billing,reports,periodizations,intelligence}/*`,
`athlete/{calendar,workouts,readiness,reports,integrations/strava}/*`, `admin/*`,
`webhooks/{payment-provider,strava}`, `health`, `novidades`, `exercise-media/[id]`.
Inventário completo gerado em auditoria (ver `find app/api -name route.ts`).

**Páginas (App Router):** `/registrar`, `/login`, `/recuperar-senha`, `/redefinir-senha`, `/convite/ativar`,
`/treinador/*` (atletas, calendário, exercícios, templates, treinos, periodização, relatórios, planos, assinatura, novidades),
`/atleta/*` (calendário, treinos, prontidão, relatórios, integrações), `/admin/*`.

## 5. Módulos existentes

`modules/`: `identity`, `organizations`, `athletes`, `trainers`, `workouts`, `calendar`, `feedback`,
`exercises`, `templates`, `intelligence`, `periodization`, `reports`, `metrics`, `subscriptions`,
`payments`, `integrations`, `admin`, `content`, `audit`, `marketplace`.

Implementados com regra de negócio: todos **exceto** `marketplace` e `metrics` (só README).
Camadas transversais: `domain/` (errors, audit), `server/` (auth, http, security, observability),
`infrastructure/` (database, mail).

> ⚠️ `modules/README.md` está desatualizado: afirma "nenhuma regra de negócio foi implementada".

## 6. Estado das migrations

9 migrations em `prisma/migrations/`, todas aditivas, `schema.prisma` com 1208 linhas:

1. `20260710104023_initial_enky_schema`
2. `20260710104255_rename_derived_metric_unique_index`
3. `20260710104346_add_native_postgres_constraints`
4. `20260712120000_add_insight_lifecycle`
5. `20260712130000_add_readiness_checkin`
6. `20260716120000_exercise_library_metadata`
7. `20260716140000_subscription_billing`
8. `20260717120000_plan_catalog_pricing`
9. `20260717140000_strava_integration`

Verificação idempotente disponível: `npm run check:migrations -- --confirm` (reset → replay → status →
`prisma validate` → deploy idempotente contra **banco descartável**). Nenhuma migration destrutiva.

## 7. Estado dos testes

| Suíte | Comando | Resultado nesta auditoria |
|---|---|---|
| Lint | `npm run lint` | ✅ exit 0 |
| Typecheck | `npm run typecheck` | ✅ exit 0 |
| Unitário (Vitest) | `npm run test` | ✅ **417 testes / 39 arquivos** |
| Build | `npm run build` | ✅ compilou (ver relatório final) |
| Integração (Vitest + Postgres) | `npm run test:integration` | ⚠️ **não executável neste ambiente** — exige `DATABASE_URL` de um Postgres isolado. Infra presente: `vitest.integration.config.ts`, `docker-compose.yml` (serviço `db`), `tests/integration/setup.ts`, 17 specs (workout-flow, negative-authorization/tenant, identity-auth, insight-lifecycle, readiness, subscription-billing, strava, admin, report, periodization…) |
| E2E (Playwright) | `npm run test:e2e` / `test:smoke` | ⚠️ **não executável neste ambiente** — exige banco + `npx playwright install`. Specs presentes: `smoke.spec.ts` (registrar→convidar→ativar→treino→feedback→relatório), `workout-flow.spec.ts`, `adversarial.spec.ts`, `periodization-generation.spec.ts` |

O fluxo obrigatório completo e o isolamento cross-tenant **já têm cobertura escrita** em
`tests/integration/workout-flow.test.ts` + `negative-authorization.test.ts` e em `tests/e2e/smoke.spec.ts`.

## 8. Lacunas críticas

1. **Documentação desincronizada** (README.md, modules/README.md) — corrigido nesta branch.
2. **Integração e E2E nunca rodados neste ambiente** — não há Postgres isolado aqui. É um gap de
   *ambiente/execução*, não de código: as suítes existem e são acionáveis onde houver banco.
3. **Metric Registry e Marketplace** especificados mas não implementados — fora do escopo Fase 0–2.

## 9. Riscos de segurança

- **Baixo, no geral** — as invariantes exigidas (auth, autorização, tenant, Zod, auditoria, erros
  padronizados, CSRF, rate limit) estão implementadas nas rotas de mutação e cobertas por testes
  negativos. Exceções documentadas e justificadas: webhook do gateway (sem CSRF/sessão, autenticado
  por segredo compartilhado) e revalidação de vínculo treinador-atleta dentro do caso de uso.
- **Rate limiter em memória não é seguro para múltiplas instâncias** — já documentado; produção usa
  Upstash e degrada com log explícito (`DegradedInMemoryRateLimiter`). Verificar que o Upstash está
  configurado antes do piloto.
- **Nenhum segredo versionado** — confirmado (`git ls-files | grep .env` → só `.env.example`).

## 10. Riscos operacionais

- Vários itens de go-live são **tarefas do operador** que exigem credenciais de produção ausentes deste
  ambiente (Vercel/Neon/Resend/Asaas/Upstash) — enumerados em `PRODUCTION_READINESS.md` como `[ ]`:
  env de produção, banco Preview/Production isolados, backup/PITR testado, smoke contra Preview,
  ensaio de rollback. **Nada disso é código; é operação.**
- Migrations só validadas contra banco descartável quando o operador rodar `check:migrations --confirm`.

## 11. Divergências entre README, documentos e código

| Documento | Divergência | Ação |
|---|---|---|
| `README.md` | Declara "Fase 02G"; afirma marketplace/pagamentos/periodização/relatórios/admin "sem produto funcional" | **Corrigido nesta branch** para refletir Fases 6–12 |
| `modules/README.md` | "nenhuma regra de negócio foi implementada" | **Corrigido nesta branch** |
| `docs/ARCHITECTURE.md` | **Atualizado e correto** (cobre Fase 10 pagamentos) | Nenhuma |
| `docs/PRODUCTION_READINESS.md` | Correto (Fase 12, honesto sobre `[x]` repo vs `[ ]` operador) | Nenhuma |
| Comando de execução (Fases 0–2 como greenfield) | Trata o produto como se estivesse no início; o código já está na Fase 12 | Ver recomendação |

## 12. Recomendação da próxima etapa

O escopo literal do comando ("construir as Fases 0–2") está **substancialmente já entregue e validado**
no repositório. A entrega desta branch é, portanto, **consolidação**, não construção:

1. **Fase 0 — concluída:** este documento + sincronização de README.md e modules/README.md.
2. **Fase 1 — verificar, não reconstruir:** lint/typecheck/test/build já verdes aqui; os primitivos
   (rate limiter dual-mode, redação de log, sessões revogáveis, CSRF, tenant isolation testado,
   scripts com guard de produção, migrations idempotentes) já existem. **Ação restante:** rodar
   `test:integration` e `test:e2e` contra um Postgres isolado — trabalho de ambiente, não de código.
3. **Fase 2 — verificar, não reconstruir:** o fluxo operacional completo existe com testes escritos.

**Próximo passo real recomendado:** homologação em **Preview** com banco isolado — subir a branch,
rodar integração + E2E contra a Preview, homologação visual humana, e fechar os `[ ]` de
`PRODUCTION_READINESS.md`.

---

## 13. Atualização — Fases 03/04/05 (branch `feat/fase-04-intelligence-periodization-billing`)

Fechamento das lacunas identificadas (as três fases já estavam 70–90% implementadas; este trabalho
fechou os gaps concretos contra a especificação, sem reconstruir o que já existia):

- **Fase 03 (Intelligence 02H):** `InsightStatus` virou máquina de estados completa
  (`NEW/VIEWED/ACCEPTED/IGNORED/RESOLVED/EXPIRED`, era 3 estados); `Insight` ganhou `note` e
  `workoutId` opcional; dedup passou a incluir versão de regras + janela ISO (situação recorrente em
  semana nova = insight novo); varredura expira o que fica aberto e some. Prontidão ganhou `mood`,
  `disposition`, `localizedPain` (dado de saúde, redigido em log). Migrations aditivas
  `20260718100000/…100`.
- **Fase 04 (Periodização):** criação virou modal sobreposto com dropdowns e **parâmetros por
  modalidade** (VDOT/pace, FTP/TSS, CSS, séries/RIR/tonelagem, padrão de movimento); `Periodization`
  ganhou modalidade, prova-alvo, nível, controle de carga, unidade, volume, meso/microciclos,
  recuperação, distribuição de dificuldade, geração automática, observações e `parameters` (JSON
  validado). Rascunho (`isDraft`) vs. plano completo. Migration aditiva `20260718110000`.
- **Fase 05 (Planos/Pagamentos):** os 4 planos (FREE/STARTER/PRO/ASSESSORIA) já estavam semeados;
  `PlanLimits` ganhou `maxTrainers/maxTemplates/maxStorageMb` + features `integrations`/`marketplace`;
  `SubscriptionPlan.trialDays` (trial configurável); enforcement de teto de templates
  (`assertCanCreateTemplate`) dentro do caso de uso. Migration aditiva `20260718120000`.

**Verificação:** `npm run validate` (lint + typecheck + build + unit) verde a cada fase; testes
unitários novos (fingerprint/janela/versão, prontidão, periodization-schema, plan-limits) e de
integração (ciclo/expiração de insight, teto de templates). **Integração/E2E/Preview seguem pendentes
de banco isolado** (mesma fronteira de ambiente das fases anteriores) — o operador roda em Preview.

**Fora de escopo (inalterado):** Marketplace e Metric Registry seguem só especificados; organização
multiusuário/grupo e upload de arquivos são Fase 6+ (ADR-001) — por isso `maxTrainers`/`maxStorageMb`
são declarados no catálogo mas sem ponto de enforcement ainda.
