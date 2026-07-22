# modules/subscriptions

**Responsabilidade:** planos de assinatura SaaS, seu ciclo de vida e os limites que eles liberam — `SubscriptionPlan`, `Subscription`.

**Fonte de verdade:** Data Model Specification v1.2.1 §8; Product & Engineering Specification v1.0 §35.

**Regra crítica:** inadimplência nunca apaga dados — bloqueio gradual ou modo somente leitura.

**Status:** implementado na Fase 10 (assinatura da plataforma).

## Catálogo

Decisão comercial registrada na migração `20260717120000_plan_catalog_pricing` — que é a **fonte única** do catálogo (não existe seed paralelo; um `prisma/seed-plans.mjs` que semeava por nome foi removido justamente por brigar com ela).

| slug | nome | preço/mês | atletas | recursos |
| --- | --- | --- | --- | --- |
| `free` | Grátis | R$ 0 | 1 | prescrição manual |
| `starter` | Starter | R$ 97 | 15 | + biblioteca, modelos, relatórios |
| `pro` | Pro | R$ 197 | 50 | + periodização, inteligência, relatórios premium |
| `assessoria` | Assessoria | R$ 397 | ilimitado | mesmos recursos do Pro |

O limite de **1 atleta** do plano grátis é anterior à Fase 10 e foi reafirmado como definitivo — não altere sem decisão comercial explícita. Pro e Assessoria têm os mesmos recursos e diferem por volume; o diferencial real da Assessoria (múltiplos treinadores na mesma organização) é da Fase 6 (ADR-001).

**Fase 05 — limites por dimensão + trial.** `featuresLimits` passou a modelar, além de `maxAthletes` e `features`, também `maxTrainers`, `maxTemplates` e `maxStorageMb` (todos `null` = ilimitado; `plan-limits.ts`). `SubscriptionPlan.trialDays` torna o trial configurável por plano (Starter/Pro = 7 dias; Grátis/Assessoria = 0) — o gateway aplica o período no checkout e a assinatura entra `TRIALING` até o primeiro pagamento confirmado. Migração aditiva `20260718120000_plan_limits_trial` (nova coluna + UPSERT convergente do catálogo — nunca edita migração já aplicada). Novas features: `integrations`, `marketplace`.

## Entitlements — quem pode o quê

`entitlements.ts` é a fonte única. Nenhuma rota, tela ou serviço decide limite por conta própria.

Só `ACTIVE` e `TRIALING` dão direito ao plano pago. Todo o resto (`PAST_DUE`, `UNPAID`, `INCOMPLETE`, `PAUSED`, `CANCELLED`, `EXPIRED`) cai para o **plano grátis** — e essa é a decisão central da inadimplência:

> **degrada, nunca apaga.**

O treinador com 40 atletas que deixou de pagar continua vendo, treinando e exportando os 40. Ele apenas não cria o 41º. Um limite que apagasse atletas para "caber" no grátis destruiria dados de terceiros (os atletas) por uma disputa comercial com o treinador.

`INCOMPLETE` cai no grátis de propósito: é quem começou o checkout e não pagou. Liberar recurso ali seria confiar na intenção de pagar.

## Checkout

`startCheckoutInputSchema` aceita `{ planSlug, taxId }` e **nada de dinheiro** — não existe campo de preço, moeda ou desconto. O servidor resolve o slug no catálogo e usa o preço da linha do banco. O cliente escolhe **qual** plano pagar, nunca **quanto** (coberto por teste).

`taxId` (CPF/CNPJ) é exigido pelo Asaas para criar o cliente. Trafega só até o gateway e **nunca é persistido** — guardamos apenas o `gatewayCustomerId` devolvido.

O checkout deixa a assinatura `INCOMPLETE` e guarda os ids do gateway. Quem ativa é o webhook (`modules/payments`), e só ele.

## Cancelamento

`requestSubscriptionCancellation` pede o encerramento ao gateway e grava `cancelAtPeriodEnd` (intenção declarada). **Não** muda `status` — isso é consequência de evento confirmado. Se o gateway recusasse o cancelamento e já tivéssemos marcado `CANCELLED`, o treinador perderia acesso continuando a ser cobrado.

## Onde os limites são aplicados

- **Atletas:** `assertCanAddAthlete()` é chamado **dentro** de `inviteAthlete` (na transação, com o `tx`), não só na rota — o limite é invariante de negócio, não detalhe de HTTP. Mesmo racional da exceção de Fase 02C em `docs/ARCHITECTURE.md`. Usar `tx` é o que impede dois convites simultâneos na fronteira do limite de passarem os dois.
- **Templates:** `assertCanCreateTemplate()` é chamado **dentro** de `createTemplate` (na transação) — mesmo padrão. Grátis = 3 modelos (coberto por `tests/integration/workout-templates.test.ts`).
- **Recursos:** `assertFeature()` / `hasFeature()`. A Fase 10 estabelece o mecanismo e o catálogo; aplicar `assertFeature` nas rotas de periodização/inteligência/relatórios premium é o passo seguinte — hoje esses recursos seguem liberados para não retirar, sem aviso, o que já estava em uso.
- **Treinadores e armazenamento:** `maxTrainers`/`maxStorageMb` são declarados no catálogo (configuráveis por plano), mas o enforcement só faz sentido quando a feature existir — organização multiusuário é Fase 6 (ADR-001) e upload de arquivos ainda não existe. Declarados agora para o catálogo já ser completo; a checagem entra junto da feature.
