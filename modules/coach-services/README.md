# modules/coach-services

**Responsabilidade:** planos e serviços comerciais da assessoria (Etapa 4 §9) —
modelo `CoachServicePlan`. O produto que a assessoria **vende ao cliente**.

**Fonte de verdade:** prompt "ENKY — Etapa 4" §9; nomenclatura §38.

## Não confundir (§38)

| Entidade | Significado |
| --- | --- |
| `CoachServicePlan` (aqui) | plano/serviço vendido pela assessoria ao cliente |
| `SubscriptionPlan` | plano SaaS do ENKY (ENKY ↔ treinador) |
| `MarketplacePlan` | venda avulsa de conteúdo de treino — outra coisa, fora de escopo |

## Regras

- **Intervalo só em RECURRING:** `normalizeBillingInterval` (função pura, testada)
  é o ponto único que impõe — RECURRING exige `billingInterval`; os demais tipos
  (ONE_TIME/PACKAGE/FREE/CUSTOM) têm intervalo `null`.
- **Preço congela no contrato:** editar/desativar um plano aqui **nunca** retroage
  sobre contratos já assinados (§10 guarda o preço no momento).
- **Duplicar** cria cópia **inativa** para ajuste antes de publicar.
- **Benefícios** (`maxSessionsPerWeek`, `includedAssessments`, `includedReports`,
  `includedCommunication`, `includedFeatures`) são **descritivos** — proposta de
  valor mostrada na comparação; nada os impõe tecnicamente ainda.

## Escopo desta fatia

- **Entregue:** modelo + enums; migração `20260719150000_coach_service_plans`;
  CRUD + duplicar + ativar/desativar; Zod; rotas `app/api/trainer/service-plans/*`;
  UI `/treinador/gestao/servicos`.
- **Deferido:** "clientes vinculados" e "receita por plano" (dependem de contratos,
  §10); listagem pública/checkout (`isPublic` — marketplace público fora de escopo).

## Segurança

`requireGlobalRole(["TRAINER"])` + `requireOrgRole`. Só **MANAGER** escreve plano
comercial (OWNER passa sozinho); **COACH não vê**; HEAD_COACH/FINANCE/SUPPORT/VIEWER
leem. Tenant isolation: plano de outra org é NotFound.
