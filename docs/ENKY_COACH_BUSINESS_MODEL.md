# ENKY — Modelo de Negócio da Assessoria (Etapa 4)

> As entidades comerciais e seus ciclos de vida. Complementa
> [ENKY_COACH_CRM_ARCHITECTURE.md](./ENKY_COACH_CRM_ARCHITECTURE.md) e
> [ENKY_COACH_FINANCIAL_MODEL.md](./ENKY_COACH_FINANCIAL_MODEL.md).

## 1. O funil, ponta a ponta

```
Lead  ──converte──▶  Client  ──contrata──▶  CoachClientContract  ──gera──▶  CoachInvoice  ──baixa──▶  CoachPayment
 (§5)                 (§8)                     (§10)                          (§12)                     (§13)
```

Cada seta é uma transação idempotente. O Lead nunca é apagado — vira `WON` ao
converter (§7).

## 2. A separação que define o domínio (§8)

`Cliente ≠ Atleta ≠ Pagador`. Três papéis que costumam coincidir mas nem sempre:

| Papel | Entidade | Quem é |
| --- | --- | --- |
| Cliente | `Client` | quem tem a relação comercial (contrata) |
| Atleta | `AthleteProfile` | quem treina |
| Pagador | `Client` (via `payerClientId`) | quem paga |

Exemplos: pai paga / filho treina; empresa paga / funcionário treina; equipe paga /
vários treinam. Por isso **`Client` não tem `athleteProfileId`** — o vínculo
cliente↔atleta↔pagador é **por contrato** (`CoachClientContract.clientId` /
`athleteId` / `payerClientId`), onde pode ser 1→N.

## 3. Ciclos de vida (enums)

- **Lead** (`LeadStatus`): `NEW → CONTACTED → QUALIFIED → TRIAL → PROPOSAL →
  NEGOTIATION → WON | LOST | ARCHIVED`. Etapas livres; `WON/LOST/ARCHIVED` derivam
  timestamps consistentes (`resolveStatusFields`). Toda mudança gera uma
  `LeadInteraction` `STATUS_CHANGE`.
- **Client** (`ClientStatus`): `PROSPECT → TRIAL → ACTIVE → PAUSED → INACTIVE →
  CANCELLED → ARCHIVED`.
- **CoachServicePlan** (`CoachBillingType`): `RECURRING | ONE_TIME | PACKAGE | FREE |
  CUSTOM`; intervalo (`CoachBillingInterval`) só existe em RECURRING.
- **CoachClientContract** (`ContractStatus`): `DRAFT → PENDING_SIGNATURE → ACTIVE →
  (PAUSED | OVERDUE) → CANCELLED | EXPIRED | COMPLETED`. Aceite (§11) ativa.
- **CoachInvoice** (`CoachInvoiceStatus`): `DRAFT | PENDING | PAID | OVERDUE |
  PARTIALLY_PAID | CANCELLED | REFUNDED | FAILED`.

## 4. Conversão de lead (§7) — o coração do funil

`convertLead` numa transação: cria `Client` (com `sourceLeadId`) → opcional
`AthleteProfile` + vínculo + convite ao portal → `CoachClientContract` (ACTIVE,
preço congelado) → opcional 1ª `CoachInvoice` → lead vira `WON`. **Idempotente**
pela chave `Client.sourceLeadId`: reconverter devolve o cliente existente sem
duplicar. Permite cliente **sem** atleta (pai pagante, empresa, avulso).

## 5. Regras invariantes

- **Preço congelado no contrato** (§10): editar/trocar o plano depois nunca retroage.
- **Sem duplicado involuntário**: não cria 2º contrato *vivo* para o mesmo
  cliente+plano (mas múltiplos contratos por cliente são permitidos).
- **Pagador default = cliente** quando omitido.
- **Idempotência de faturas**: `@@unique([contractId, referencePeriod])`.

## 6. Equipe e composição

- **Carteira** (§19): `CoachAthleteRelationship.role` = `PRIMARY | ASSISTANT |
  TEMPORARY | VIEW_ONLY`. Um atleta pode ter titular + assistente. Histórico
  preservado (soft-end via `endedAt`).
- **Grupos** (§20): `CoachGroup` + `CoachGroupMember` — turmas de atletas com
  treinador responsável.

## 7. Papéis organizacionais (§4)

8 papéis (`OrganizationRole`): OWNER, MANAGER, HEAD_COACH, COACH, ASSISTANT_COACH,
FINANCE, SUPPORT, VIEWER. Definição e fronteiras de dado em
[ENKY_ORGANIZATION_ROLES.md](./ENKY_ORGANIZATION_ROLES.md); matriz recurso×papel em
[ENKY_CRM_PERMISSIONS.md](./ENKY_CRM_PERMISSIONS.md).

## 8. Fora de escopo

Marketplace público, split de pagamento, comissão via gateway, folha, nota fiscal,
app nativo, WhatsApp oficial, IA de vendas, white-label, assinatura digital avançada.
