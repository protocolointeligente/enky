# modules/contracts

**Responsabilidade:** contratos comerciais assessoria↔cliente (Etapa 4 §10–11) —
modelo `CoachClientContract` + documento HTML.

**Fonte de verdade:** prompt "ENKY — Etapa 4" §10–11; auditoria §32; nomenclatura §38.

## O que este módulo é

É **onde nasce o vínculo cliente↔atleta↔pagador** (`clientId` / `athleteId` /
`payerClientId`) — três campos distintos de propósito (§8). O contrato **congela
o preço** do plano no momento (`price`/`discount`/`finalPrice`): editar ou trocar
o `CoachServicePlan` depois **nunca** retroage.

## Regras

- **finalPrice = price − discount** (clamp ≥ 0), em centavos, por `computeFinalPrice`
  (função pura, testada). `desconto > preço` é erro.
- **Preço congelado após aceite:** `price`/`discount` só editam em
  `DRAFT`/`PENDING_SIGNATURE`; depois viram erro de regra.
- **Duplicado involuntário bloqueado:** não cria um 2º contrato *vivo* para o mesmo
  `cliente+plano` (mas múltiplos contratos por cliente, em planos/períodos
  diferentes, são permitidos).
- **Pagador default = cliente** quando omitido; modelado à parte para os casos que
  diferem.
- **Aceite (§11):** `accept` grava `acceptedAt/acceptedBy/acceptanceMethod/IP` e
  ativa o contrato. Sem assinatura digital avançada (só MANUAL/CHECKBOX/IMPORTED).
- **Documento HTML** gerado do template versionado (`renderContractHtml`, puro e
  escapado) — para visualizar/exportar.
- **Auditoria (§32):** criar/editar/mudar status/cancelar/aceitar → `AuditLog`
  (nunca o valor em texto livre, só ids/ação).

## Escopo desta fatia / deferido

- **Entregue:** modelo + enums (`ContractStatus`, `ContractAcceptanceMethod`);
  migração `20260719160000_coach_contracts`; CRUD + status + aceite + documento;
  rotas `app/api/trainer/contracts/*`; UI `/treinador/gestao/contratos`.
- **Deferido:** geração de mensalidades a partir do contrato (§12–14); renovação
  automática efetiva (`autoRenew` é armazenado, o job de renovação é fatia futura);
  restrição fina "SUPPORT não altera preço" (§4 — hoje o freeze pós-aceite já
  protege).

## Segurança

`requireGlobalRole(["TRAINER"])` + `requireOrgRole`. Escrita: MANAGER/SUPPORT
(OWNER passa sozinho); leitura: + HEAD_COACH/FINANCE/VIEWER. Tenant isolation:
contrato/cliente/plano/atleta de outra org são recusados.
