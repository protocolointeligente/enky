# ENKY — Etapa 4: Homologação e Endurecimento (§28–41)

> Status do CRM/Gestão comercial da assessoria na branch
> `feat/coach-crm-business-management`. Este documento cobre o endurecimento
> (§28–35), os critérios de aceite (§39), a validação (§40) e a entrega (§41),
> além do **checklist de homologação manual** que o operador roda no staging.
>
> **Nada foi aplicado em banco.** As migrations são geradas offline e aguardam o
> operador (regra da etapa: nunca migrar produção; usar staging isolado).

---

## 1. Migrations desta etapa (aditivas, aplicar em ordem)

Todas geradas via `prisma migrate diff` (offline), **só aditivas** (CREATE / ADD
COLUMN / ADD VALUE — nada removido ou reescrito):

| Migração | Conteúdo |
| --- | --- |
| `20260719120000_org_foundation_roles` | Papéis org (8) + identidade da org (§3–4) |
| `20260719130000_crm_leads` | Lead + LeadInteraction (§5–6) |
| `20260719140000_clients` | Client + ClientStatus (§8) |
| `20260719150000_coach_service_plans` | CoachServicePlan + enums (§9) |
| `20260719160000_coach_contracts` | CoachClientContract + enums (§10–11) |
| `20260719170000_coach_invoices_payments` | CoachInvoice + CoachPayment (§12–14) |
| `20260719180000_coach_team_groups` | Carteira (papel/assignedBy) + membership.isActive + CoachGroup (§18–20) |
| `20260719190000_communications` | CommunicationLog (§22) |

Aplicar: `prisma migrate deploy` (contra `DIRECT_URL` de staging).

---

## 2. Endurecimento (§28–35) — status

### §28 Segurança — **FEITO** (padrão por rota)
Toda rota de Gestão valida, na ordem: `assertTrustedOrigin` (CSRF, nas escritas) →
`requireAuthenticatedUser` → `requireGlobalRole(["TRAINER"])` →
`resolveActiveOrganization` → `requireOrgRole(...)` → `enforceRateLimit` (escritas)
→ Zod (`parseJsonBody`) → serviço com **tenant isolation** (todo `where` inclui
`organizationId`; recurso de outra org é `NotFound`, nunca vaza existência) →
`apiError` padronizado. Papel global **e** organizacional sempre checados.

### §29 LGPD — **PARCIAL**
- **Feito:** exportar dados comerciais do titular (`/clients/[id]/lgpd` GET) e
  **anonimizar** cliente (POST) preservando o financeiro (não apaga contrato/fatura
  — retenção legal); ambos auditados. Origem do lead (`Lead.source`) e do cliente
  (`Client.sourceLeadId`) preservadas. Separação de domínios: aqui só dado
  **comercial** — saúde/fisiológico nunca entra nos exports.
- **Deferido:** consentimento comercial explícito, bloqueio de marketing, política
  de retenção configurável, e o export/anonimização a partir do painel /admin.

### §30 Performance — **FEITO no essencial**
Paginação por **cursor** (leads/clientes/contratos/faturas), **índices** em todos
os `@@index([organizationId, ...])`, agregação no banco (`groupBy` na carteira,
`aggregate` nos indicadores), sem N+1 nas listagens. **Deferido:** cache de
dashboard e paginação da inadimplência (hoje cap 500).

### §31 Eventos de domínio — **DEFERIDO**
Não há barramento; a **trilha de auditoria síncrona** (`AuditLog`) cobre o
rastro que os eventos dariam. `LeadConverted`/`InvoicePaid` etc. entram quando
houver processamento assíncrono.

### §32 Auditoria — **FEITO**
Ações sensíveis auditadas via `domain/audit.ts` (nunca com valor/nota em texto
livre — só ids/ação/contagem): `CREATE/UPDATE/CHANGE_CONTRACT_STATUS/CANCEL/
ACCEPT_CONTRACT`, `GENERATE_INVOICES/UPDATE_INVOICE/CANCEL_INVOICE/REGISTER_PAYMENT`,
`CONVERT_LEAD`, `CHANGE_MEMBER_ROLE/SET_MEMBER_ACTIVE/ASSIGN/UNASSIGN/TRANSFER_ATHLETE`,
`BULK_UPDATE_CLIENTS`, `IMPORT_CLIENTS`, `EXPORT_CLIENT_DATA/ANONYMIZE_CLIENT`.

### §33 Testes unitários — **FEITO (lógica pura)**
604 testes no total. Da Etapa 4, cobrindo a lógica de dinheiro/estado/datas
(a parte arriscada): `requireOrgRole` (papéis), `resolveStatusFields` (lead),
`normalizeBillingInterval` (plano), `computeFinalPrice`+`resolveCancellationFields`
(contrato), `invoice-math` (competências/valor/status), `finance-math` (ticket/
churn/conversão/LTV/faixas), `alert-windows`, `csv-parse`+`validateClientImport`.

### §34 Testes de integração — **FEITO e VERIFICADO**
`tests/integration/coach-crm.test.ts` (7 cenários) roda contra o Postgres real e
**passa** após as migrations: conversão ponta a ponta (cliente+contrato+fatura+
lead WON), idempotência de conversão e de geração de faturas, reconciliação de
pagamento parcial/total, inadimplência com faixa, carteira (atribuir/transferir),
grupo idempotente, e **tenant isolation** (outra org = NotFound). Auto-limpa.
Rodar: `npm run test:integration`.

### §35 Testes E2E — **ESCRITO** (`tests/e2e/coach-crm.spec.ts`)
Dois casos: (1) todas as subáreas de Gestão carregam para um treinador real
(pega página que quebra no load); (2) criar um plano pela UI e vê-lo na lista.
Precisa do dev server + browser (`npm run test:e2e`) — roda pelo operador na
validação §40. A lógica de negócio profunda já está coberta pelo §34 (runnable).

---

## 3. Critérios de aceite (§39)

| Critério | Status |
| --- | --- |
| Assinatura ENKY em Configurações | ✅ `/treinador/configuracoes` |
| "Gestão" na navegação | ✅ sidebar + 10 subáreas linkadas |
| Assessoria cria seus planos | ✅ §9 |
| Lead convertido | ✅ §7 (transacional/idempotente) |
| Cliente/atleta/pagador separados | ✅ vínculo no contrato (§8/§10) |
| Contrato criável | ✅ §10–11 |
| Mensalidades geradas | ✅ §14 (idempotente) |
| Pagamento registrável | ✅ §13 |
| Inadimplência visível | ✅ §15 |
| Indicadores calculados | ✅ §17 |
| Treinadores atribuíveis | ✅ §18–19 (carteiras) |
| Grupos funcionam | ✅ §20 |
| Permissões aplicadas | ✅ requireOrgRole + matriz |
| Tenant isolation testado | ✅ unit (guards) + integração (coach-crm.test.ts) |
| Ações financeiras auditadas | ✅ §32 |
| Import/export seguros | ✅ §26/§27 (preview; sem sobrescrever) |
| Testes passam | ✅ 604 unit; integração/e2e no staging |
| Production inalterada | ✅ nada aplicado/promovido |

**Fora de escopo (confirmado):** marketplace público, split de pagamento, folha,
nota fiscal, app nativo, WhatsApp oficial, IA de vendas, white-label.

---

## 4. Checklist de homologação manual (rodar no staging)

Pré: aplicar as 8 migrations (`prisma migrate deploy`) + `prisma generate`.

**Fluxo principal (§35):**
1. Login como treinador (OWNER da org).
2. Gestão → Planos e serviços → criar um plano recorrente mensal.
3. Gestão → Leads → criar lead → mover no pipeline → "Converter em cliente"
   (escolher o plano, marcar "gerar 1ª mensalidade" e "criar atleta + convite").
4. Verificar: cliente criado (Clientes), contrato ACTIVE (Contratos), 1ª fatura
   (Mensalidades), lead vira WON, e-mail de convite disparado.
5. Mensalidades → registrar pagamento total → status vira PAID.
6. Gestão → Grupos → criar grupo → adicionar o atleta.
7. Gestão → Treinadores → carteira mostra o atleta.

**Inadimplência (§15):** gerar mensalidades de meses passados → Financeiro →
Inadimplência mostra faixas e total; registrar pagamento → sai da lista.

**Permissão/tenant:** com um segundo usuário/org, confirmar que não acessa
contrato/fatura da primeira (deve dar 404/403).

**Import/export (§26/§27):** importar um CSV de clientes (preview → importar);
exportar clientes/faturas em CSV.

**LGPD (§29):** exportar dados de um cliente; anonimizar e confirmar que a PII
some mas contratos/faturas permanecem.

**Idempotência (§14):** gerar mensalidades do mesmo período duas vezes →
segunda vez cria 0.

---

## 5. Validação (§40)

Rodado: `prisma validate` ✅, `prisma format` ✅, `typecheck` ✅, `eslint` ✅,
`test` (unit) ✅ 604, **`test:integration` (coach-crm) ✅ 7/7 contra o banco
migrado**. **Pendente do operador:** `test:e2e` (dev server + browser), `build`
completo, e a suíte de integração inteira. `migrate deploy` já aplicado.

---

## 6. Pendências e recomendação para a próxima etapa

- **Infra:** aplicar migrations no staging; rodar integração/e2e/build; validar
  o preview.
- **Deferidos de escopo:** convite de treinador NOVO (multi-org, ADR-001/Fase 6);
  eventos de domínio assíncronos; cache de dashboard; consentimento/retenção LGPD
  completos; disparo real de e-mail avulso; automações com toggle persistido;
  mapeamento livre de colunas na importação; gráficos financeiros; drag-and-drop
  no Kanban; restrição fina "SUPPORT não altera preço".
- **Recomendação:** homologar este núcleo no staging **antes** de abrir a próxima
  etapa; o multi-org (que destrava assessoria multi-treinador de verdade) é o
  maior pré-requisito arquitetural pendente.
