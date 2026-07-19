# ENKY — Arquitetura do CRM / Gestão Comercial (Etapa 4)

> Arquitetura do módulo de gestão da assessoria (`treinador ↔ atletas/clientes`),
> separado da assinatura SaaS (`ENKY ↔ treinador`). Complementa
> [ENKY_COACH_CRM_CURRENT_STATE.md](./ENKY_COACH_CRM_CURRENT_STATE.md) (auditoria),
> [ENKY_COACH_BUSINESS_MODEL.md](./ENKY_COACH_BUSINESS_MODEL.md) (entidades) e
> [ENKY_COACH_FINANCIAL_MODEL.md](./ENKY_COACH_FINANCIAL_MODEL.md) (dinheiro).

## 1. Camadas

```
app/treinador/gestao/*      UI (client components, design system ENKY)
app/api/trainer/*           rotas HTTP finas (auth + Zod + delega ao módulo)
modules/*                   regra de negócio (serviços) + lógica pura testável
server/*                    transversais (auth/guards, http, security, observability)
domain/*                    erros e catálogo de auditoria
infrastructure/database     Prisma client
prisma/schema.prisma        modelo de dados
```

**Regra de ouro:** nenhuma regra de negócio em componente React. A rota valida e
delega; o módulo decide. A lógica pura (dinheiro/estado/datas) fica isolada em
funções sem I/O, testadas por unit.

## 2. Módulos da Etapa 4

| Módulo | Responsabilidade | § |
| --- | --- | --- |
| `modules/organizations` | papéis org (`org-roles.ts`) + identidade | 3–4 |
| `modules/crm` | leads, interações, conversão (`convert-lead.ts`) | 5–7 |
| `modules/clients` | cliente comercial | 8 |
| `modules/coach-services` | planos/serviços vendidos | 9 |
| `modules/contracts` | contratos + documento HTML | 10–11 |
| `modules/coach-billing` | mensalidades + pagamentos (`invoice-math`) | 12–14 |
| `modules/coach-finance` | inadimplência + indicadores (`finance-math`) | 15–17 |
| `modules/coach-team` | equipe + carteiras | 18–19 |
| `modules/coach-groups` | grupos/turmas | 20 |
| `modules/coach-bulk` | ações em massa | 21 |
| `modules/communications` | log de comunicação | 22 |
| `modules/coach-automations` | alertas on-read | 23 |
| `modules/coach-search` | busca global | 24 |
| `modules/coach-import` / `coach-export` | CSV | 26–27 |
| `modules/coach-lgpd` | export/anonimização | 29 |

## 3. Padrão de rota (§28)

Toda rota de Gestão segue a mesma espinha:

```ts
assertTrustedOrigin(request);                 // CSRF (escritas)
const identity = await requireAuthenticatedUser();
requireGlobalRole(identity, ["TRAINER"]);     // eixo 1: papel global
const active = await resolveActiveOrganization(identity.userId);
requireOrgRole(active, [...]);                // eixo 2: papel organizacional
await enforceRateLimit(limiter, key);         // escritas
const input = await parseJsonBody(request, schema); // Zod
const result = await service(input, actor);   // tenant isolation dentro
return apiSuccess(result);                     // apiError padroniza falhas
```

`requireOrgRole`: **OWNER passa sempre**; `ADMIN` legado conta como `MANAGER`; o
resto é allow-list por rota. Matriz em [ENKY_CRM_PERMISSIONS.md](./ENKY_CRM_PERMISSIONS.md).

## 4. Isolamento multi-tenant

Todo `where` de serviço inclui `organizationId`. Um recurso de outra organização
retorna `NotFound` (nunca vaza existência). `resolveActiveOrganization` é o ponto
único que resolve o tenant do treinador (e barra org suspensa). Índices
`@@index([organizationId, ...])` em todas as tabelas novas.

## 5. Lógica pura isolada (testada por unit)

- `resolveStatusFields` (lead), `computeFinalPrice`+`resolveCancellationFields`
  (contrato), `normalizeBillingInterval` (plano), `invoice-math`
  (competências/valor/status), `finance-math` (indicadores/faixas),
  `alert-windows` (automações), `csv-parse` (importação).
- I/O (transações, upserts, auditoria) orquestra essas funções — mas não repete a
  regra.

## 6. Transações e idempotência

Operações que tocam várias tabelas usam `prisma.$transaction`: conversão de lead,
geração de faturas, pagamento, aceite/cancelamento de contrato, transferência de
atleta. Idempotência por **constraint**, não por SELECT-then-INSERT:
`@@unique([contractId, referencePeriod])` (faturas), `Client.sourceLeadId`
(conversão), `@@unique([groupId, athleteId])` (grupo).

## 7. Nomenclatura (§38)

`CoachServicePlan`/`CoachClientContract`/`CoachInvoice`/`CoachPayment`/`CoachGroup`
= assessoria. NUNCA confundir com `SubscriptionPlan`/`Subscription`/
`PaymentTransaction` (SaaS ENKY) nem `MarketplacePlan` (conteúdo avulso).

## 8. Fronteiras deferidas

- **Multi-org** (um usuário em N organizações) — bloqueio do ADR-001; destrava o
  convite de treinador novo (§18) e é o maior pré-requisito da próxima etapa.
- **Eventos de domínio assíncronos** (§31) — hoje a auditoria síncrona cobre o rastro.
- **Job periódico** de geração de mensalidades / varredura OVERDUE — o serviço já é
  chamável; falta o agendador.
