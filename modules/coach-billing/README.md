# modules/coach-billing

**Responsabilidade:** mensalidades e pagamentos da assessoria (Etapa 4 §12–14) —
`CoachInvoice` + `CoachPayment` + geração determinística de cobranças.

**Fonte de verdade:** prompt "ENKY — Etapa 4" §12–14; auditoria §32; nomenclatura §38.

> `CoachInvoice`/`CoachPayment` ≠ `PaymentTransaction`/`WebhookEvent` (esses são o
> gateway SaaS ENKY↔treinador). Aqui é a cobrança da assessoria ao cliente, **manual**
> nesta etapa (sem gateway). **Não guardamos dado de cartão.**

## Geração de mensalidades (§14)

`generateContractInvoices({ contractId, fromDate, toDate })`:
- **Idempotente:** `createMany` + `skipDuplicates` contra
  `@@unique([contractId, referencePeriod])` — rodar de novo o mesmo intervalo não
  duplica competência (não é SELECT-then-INSERT, sem janela de corrida).
- **Determinística/testada** (`invoice-math`): uma competência por mês; vencimento
  no `billingDay` **clampeado ao último dia** (31 → 28/29/30); respeita início
  (`billingStartDate ?? startDate`) e fim do contrato; datas civis em UTC (fuso
  preservado).
- Só gera para contrato **ACTIVE/OVERDUE** (respeita pausa/cancelamento: outros
  status não geram).

## Pagamentos e status (§13)

- Uma fatura tem **vários** `CoachPayment` (parciais). O status é **sempre**
  recalculado da SOMA das baixas (`reconcileInvoiceStatus`, puro): total ≥ final →
  `PAID`; parcial → `PARTIALLY_PAID`; nada pago e vencido → `OVERDUE`; senão
  `PENDING`. Comparação em centavos (sem drift).
- `finalAmount = amount − desconto + juros + multa` (`computeInvoiceFinalAmount`).
- "Marcar como paga" = registrar um pagamento do saldo (mantém a trilha), não um
  atalho que perde o histórico.

## Escopo / deferido

- **Entregue:** modelos + enums; migração `20260719170000_coach_invoices_payments`;
  gerar/pagar/editar(venc./desconto/juros/multa)/cancelar; listar/detalhar; rotas
  `app/api/trainer/invoices/*`; UI `/treinador/gestao/mensalidades`.
- **Deferido:** varredura que promove PENDING→OVERDUE em lote e a visão de
  inadimplência com faixas de atraso (§15); indicadores/receita (§16–17); job
  periódico de geração (§14 — o serviço já é chamável; a fila é fatia futura);
  estornos (`REFUNDED`).

## Auditoria (§32)

`GENERATE_INVOICES`, `REGISTER_PAYMENT`, `UPDATE_INVOICE`, `CANCEL_INVOICE` —
sempre; nunca com valor em texto livre (só ids/ação/contagem).

## Segurança

`requireGlobalRole(["TRAINER"])` + `requireOrgRole`. Escrita: MANAGER/FINANCE
(OWNER passa sozinho); leitura: + SUPPORT/VIEWER. Tenant isolation: fatura de
outra org é NotFound.
