# ENKY — Estado Atual: CRM e Gestão Comercial da Assessoria

> Auditoria inicial da **Etapa 4** (`feat/coach-crm-business-management`), seção 1
> do brief. Documenta o que já existe no repositório antes de escrever qualquer
> código de feature, para não duplicar conceitos nem colidir com a nomenclatura
> do SaaS já implementado.
>
> **Escopo desta auditoria:** apenas leitura. Nenhuma migration, model ou rota
> foi criada. Branch criada a partir de `feat/intelligent-periodization-engine`
> (commit `c04a5e7`).

---

## 1. Resumo executivo

O ENKY hoje tem **um único domínio comercial implementado**: a assinatura SaaS
`ENKY ↔ treinador` (Fase 10). Todo o domínio da Etapa 4 — a relação
`assessoria ↔ atletas/clientes` (CRM, contratos, mensalidades, financeiro da
assessoria) — **não existe**. Não há sobreposição de dados, mas há **três riscos
concretos de colisão conceitual e de nomenclatura** que precisam de disciplina
(seção 5).

O erro conceitual que o brief aponta é real e localizado: o item **"Planos"** na
navegação operacional do treinador ([app/treinador/layout.tsx:15](../app/treinador/layout.tsx#L15))
aponta para o **catálogo de planos SaaS do ENKY** — que deve morar em
Configurações, não na operação esportiva.

---

## 2. Modelos existentes (Prisma)

`prisma/schema.prisma` (1340 linhas). Relevantes para a Etapa 4:

### 2.1 Domínio SaaS `ENKY ↔ treinador` — JÁ EXISTE, nomenclatura correta

| Model | Papel | Localização |
| --- | --- | --- |
| `SubscriptionPlan` | Catálogo SaaS do ENKY (`free`/`starter`/`pro`/`assessoria`) | [schema:1106](../prisma/schema.prisma#L1106) |
| `Subscription` | Assinatura da **organização** no ENKY | [schema:1139](../prisma/schema.prisma#L1139) |
| `PaymentTransaction` | Transação de pagamento **do SaaS** (gateway Asaas) | [schema:1160](../prisma/schema.prisma#L1160) |
| `WebhookEvent` | Livro-razão de idempotência de webhooks do gateway | [schema:1195](../prisma/schema.prisma#L1195) |

Estes modelos **já usam os nomes exigidos pela seção 38 do brief** (`SubscriptionPlan`,
`Subscription`). Não tocar. A Etapa 4 cria entidades paralelas com prefixo `Coach*`.

### 2.2 Tenant e organização — EXISTE, mas MÍNIMO

| Model | Estado | Lacuna vs. Etapa 4 |
| --- | --- | --- |
| `Organization` [schema:348](../prisma/schema.prisma#L348) | `id, name, slug, timezone, isActive, lockVersion` | Faltam **todos** os campos da seção 3: `legalName, document, email, phone, website, currency, logoUrl`, `status` (enum), e o bloco de defaults de faturamento (`defaultBillingDay`, `defaultGracePeriodDays`, etc.) |
| `OrganizationMembership` [schema:381](../prisma/schema.prisma#L381) | `userId, organizationId, role` | OK como vínculo; o enum de papel é insuficiente (abaixo) |
| `OrganizationRole` enum [schema:53](../prisma/schema.prisma#L53) | `OWNER, COACH, ADMIN, SUPPORT` (4) | Seção 4 pede 8: faltam `MANAGER, HEAD_COACH, ASSISTANT_COACH, FINANCE, VIEWER`. `ADMIN` daqui ≠ papéis do brief |

> **Nota de arquitetura (ADR-001):** hoje cada `TRAINER` recebe uma `Organization`
> pessoal implícita no cadastro. Organizações multiusuário reais (assessorias com
> vários treinadores) eram a "Fase 6" do roadmap antigo — **é exatamente o que a
> Etapa 4 concretiza**. O tenant já nasce isolado; falta a UI e o modelo de negócio.

### 2.3 Relação treinador–atleta — EXISTE, parcial

| Model | Estado | Lacuna |
| --- | --- | --- |
| `CoachAthleteRelationship` [schema:448](../prisma/schema.prisma#L448) | `org, trainer, athlete, isActive, startedAt, endedAt, terminationReason` | Sem **papel no vínculo** (`PRIMARY/ASSISTANT/TEMPORARY/VIEW_ONLY` da seção 19) e sem `assignedBy` |
| `AthleteProfile` [schema:419](../prisma/schema.prisma#L419) | perfil esportivo (`birthDate, gender, weightKg, heightCm`) | É o **atleta**, não o **cliente**. Não tem noção comercial |
| `AthleteInvitation` [schema:468](../prisma/schema.prisma#L468) | convite com token, expiração, revogação, reenvio | Reutilizável no fluxo "converter lead → convidar ao portal" (seção 7) |

### 2.4 Marketplace — EXISTE, mas é OUTRA COISA (ver risco §5.1)

`MarketplacePlan` [schema:1040](../prisma/schema.prisma#L1040), `MarketplacePlanVersion`,
`MarketplacePurchase` [schema:1080](../prisma/schema.prisma#L1080): venda **avulsa de
um plano de treino** de um treinador para um atleta, com versionamento de conteúdo.
É uma venda de conteúdo (one-time), **não** um contrato comercial recorrente. O
marketplace público está **fora de escopo** da Etapa 4.

### 2.5 Auditoria — EXISTE, reutilizável

`AuditLog` [schema:1316](../prisma/schema.prisma#L1316) (append-only, com
`changedFields`, hashes de before/after, `reason`, `correlationId`, redação LGPD).
Escrita via `domain/audit.ts` (`recordAuditLog` + catálogo `AuditAction`). Leitura
mora em `modules/admin`. **A Etapa 4 estende o catálogo `AuditAction`, não cria
tabela nova.**

---

## 3. Funcionalidades e módulos existentes

| Módulo | O que faz | Reuso na Etapa 4 |
| --- | --- | --- |
| `modules/subscriptions/` | `entitlements.ts` (fonte única de limites por plano SaaS), `plan-limits.ts`, `subscription-service.ts` | **Não misturar.** É o SaaS. A Etapa 4 tem financeiro próprio |
| `modules/payments/` | Provider abstrato + Asaas + fake, `webhook-service.ts` | Padrão de provider/idempotência reutilizável como **referência**; não é o cobrador da assessoria |
| `modules/organizations/` | Só README ("fundação apenas") — **nenhum serviço** | A Etapa 4 é quem finalmente implementa a gestão da organização |
| `modules/athletes/` | `invite/activate/revoke/resend`, `list-coach-athletes` | Base do fluxo lead→cliente→atleta e da atribuição de carteira |
| `modules/audit/` | Lado de escrita da trilha | Estender catálogo de ações |
| `modules/trainers/` | Só README | Base de "Gestão → Treinadores" (seção 18) |

**Autenticação / segurança** — `server/auth/guards.ts`:
- `requireAuthenticatedUser`, `requireGlobalRole`, `resolveActiveOrganization`
  (já devolve `organizationRole`), `requireOrganizationMembership`,
  `requireTrainerAccessToAthlete`.
- Resposta padronizada: `server/http/response.ts` (`apiSuccess`/`apiError`).
- **Lacuna crítica:** `organizationRole` é resolvido mas **não é imposto em lugar
  nenhum** — não existe `requireOrgRole(...)`. Toda a matriz de permissões da
  seção 4 precisa desse helper novo antes de qualquer rota de Gestão.

**UI comercial atual (o erro conceitual):**
- [app/treinador/planos/page.tsx](../app/treinador/planos/page.tsx) — catálogo de
  `SubscriptionPlan` + checkout/upgrade SaaS. Linkado na sidebar como "Planos".
- [app/treinador/assinatura/page.tsx](../app/treinador/assinatura/page.tsx) — visão
  da assinatura atual + últimos pagamentos SaaS. **Já existe e é conceitualmente
  correta**, mas não está na navegação.
- API: `app/api/trainer/billing/*` (`/plans`, checkout, subscription).

---

## 4. Lacunas (o que a Etapa 4 precisa criar do zero)

Nenhum destes existe hoje:

- **CRM:** `Lead`, `LeadInteraction` (seções 5–6).
- **Cliente / pagador:** entidade `Client` separada de `AthleteProfile`; separação
  cliente/atleta/pagador (seções 7–8). Hoje o modelo assume `cliente = atleta`.
- **Plano da assessoria:** `CoachServicePlan` (seção 9) — distinto de `SubscriptionPlan`
  **e** de `MarketplacePlan`.
- **Contrato:** `CoachClientContract` (seção 10) + documento HTML/aceite (seção 11).
- **Financeiro da assessoria:** `CoachInvoice`, `CoachPayment` (seções 12–14),
  gerador determinístico e idempotente de mensalidades, visão de inadimplência
  (seção 15).
- **Indicadores:** MRR, ticket médio, churn, conversão, LTV (seções 16–17).
- **Gestão de equipe:** papéis org estendidos + `requireOrgRole`, carteiras com
  papel de vínculo (seções 18–19).
- **Grupos:** `CoachGroup` (seção 20).
- **Ações em massa** (seção 21), **`modules/communications/` + `CommunicationLog`**
  (seção 22), **automações simples** (seção 23), **busca global** (seção 24),
  **importação/exportação CSV** (seções 26–27).
- **Navegação "Gestão"** e submenu **Configurações → Assinatura ENKY** (seção 2).

---

## 5. Conflitos de nomenclatura e riscos

### 5.1 `MarketplacePlan` vs `CoachServicePlan` — RISCO ALTO
São coisas diferentes que "soam" iguais. Marketplace = venda avulsa de conteúdo de
treino, versionada, fora de escopo. `CoachServicePlan` = produto comercial recorrente
da assessoria (mensalidade). **Nunca reutilizar `MarketplacePlan` como plano da
assessoria.** Manter os prefixos `Coach*` da seção 38 sem exceção.

### 5.2 `Subscription`/`SubscriptionPlan` vs contratos da assessoria — RISCO MÉDIO
`Subscription` é sagrado: é o SaaS `ENKY↔treinador`, com `status` mudando **só por
webhook confirmado**. A cobrança da assessoria (`CoachInvoice`) tem lógica própria e
independente — **não estender `PaymentTransaction`** (é do gateway SaaS).

### 5.3 `PaymentTransaction` (SaaS) vs `CoachPayment` (assessoria) — RISCO MÉDIO
Nomes parecidos, ledgers separados. `CoachPayment` registra o pagamento manual que o
gestor lança contra uma `CoachInvoice`; não passa pelo gateway do ENKY.

### 5.4 `OrganizationRole.ADMIN`/`SUPPORT` — RISCO BAIXO
O enum atual tem `ADMIN` e `SUPPORT` com semântica diferente da matriz do brief.
Estender o enum é aditivo, mas a matriz de permissões precisa ser explícita sobre o
que cada papel novo pode — e o `ADMIN` legado precisa ser mapeado (provavelmente para
`MANAGER`).

### 5.5 Papel global (`Role`) vs papel organizacional (`OrganizationRole`) — RISCO BAIXO
Toda rota da Etapa 4 valida **os dois eixos**: `requireGlobalRole(['TRAINER'])` +
o novo `requireOrgRole(...)`. Não colapsar num só.

---

## 6. Proposta de implementação (ordem sugerida das fatias)

Fatias pequenas, cada uma com commit semântico, testes e doc. Migrations sempre
aditivas, em banco de staging/descartável.

1. **Navegação (seção 2) — sem schema.** Mover "Planos" para Configurações →
   Assinatura ENKY; criar item "Gestão" com subáreas. Fatia barata, valida a UX
   antes de qualquer modelo. *(recomendada como primeira, isolada de migration)*
2. **Fundação org + papéis (seções 3–4).** Estender `Organization`, `OrganizationRole`,
   criar `requireOrgRole` + matriz de permissões documentada. **Pré-requisito de
   segurança de tudo abaixo.**
3. **CRM (seções 5–7).** `Lead`, `LeadInteraction`, conversão transacional/idempotente.
4. **Cliente/atleta/pagador (seção 8).** `Client` + relacionamento flexível.
5. **Planos e contratos (seções 9–11).** `CoachServicePlan`, `CoachClientContract`,
   documento HTML/aceite.
6. **Financeiro (seções 12–17).** `CoachInvoice`, `CoachPayment`, gerador de
   mensalidades, inadimplência, indicadores.
7. **Equipe/grupos/carteiras (seções 18–20).**
8. **Transversais (seções 21–27).** Ações em massa, comunicação, automações, busca,
   import/export.
9. **Dashboard gerencial (seção 16).**
10. **Endurecimento:** auditoria (seção 32), LGPD (seção 29), performance (seção 30),
    testes unit/integração/e2e (seções 33–35).

---

## 7. Fora de escopo (reafirmado do brief)

Marketplace público, split de pagamentos, comissão automática via gateway, folha de
pagamento, contabilidade/nota fiscal, app nativo, automação avançada de marketing,
WhatsApp oficial, IA generativa de vendas, franquias, white-label completo,
assinatura digital avançada sem provedor autorizado.

---

## 8. Pendências de infraestrutura / decisões abertas

- **Banco de staging** para rodar as migrations (regra obrigatória: nunca em produção,
  nunca `migrate reset`).
- **Mapeamento do `OrganizationRole.ADMIN` legado** para os novos papéis — decisão de
  produto.
- **Cobrança da assessoria é manual nesta etapa** (sem gateway). Confirmar que a
  geração de mensalidades roda como serviço determinístico chamável, com job periódico
  preparado mas não dependente de fila externa (seção 14).
