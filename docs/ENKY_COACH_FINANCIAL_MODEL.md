# ENKY — Modelo Financeiro da Assessoria (Etapa 4)

> As fórmulas e regras de dinheiro. Toda a matemática mora em funções PURAS e
> testadas (`modules/coach-billing/invoice-math.ts`,
> `modules/coach-finance/finance-math.ts`) — este documento é a especificação
> formal delas.

## 1. Princípios

- **Cobrança manual** nesta etapa (sem gateway). **Nunca** se armazena dado de
  cartão. Distinto de `PaymentTransaction` (gateway SaaS ENKY).
- **Aritmética em centavos** (`Math.round(x*100)`) para evitar drift de ponto
  flutuante. Valores nunca ficam negativos (clamp em 0).
- Datas civis em **UTC** (convenção `@db.Date`).

## 2. Contrato — preço congelado (§10)

No aceite, o contrato guarda um snapshot:

```
finalPrice = clamp0(price − discount)          // computeFinalPrice
```

`price` pode ser personalizado na criação (valor avulso), não precisa ser o do
plano. `discount ≤ price` (senão erro). Editar `price/discount` só é permitido em
`DRAFT`/`PENDING_SIGNATURE` — depois está **congelado**.

## 3. Mensalidade — geração (§14)

`generateContractInvoices({ contractId, fromDate, toDate })`, determinístico e
**idempotente** (`@@unique([contractId, referencePeriod])` + `createMany
skipDuplicates`):

- **uma competência por mês-calendário** no intervalo `[from,to] ∩ [início, fim]`;
- **vencimento** = `billingDay` clampeado ao último dia do mês
  (`billingDay=31` em fevereiro → 28/29);
- respeita `billingStartDate ?? startDate` e `endDate`;
- só gera para contrato **ACTIVE/OVERDUE**.

```
amount      = contract.finalPrice     (base da competência)
finalAmount = amount − discount + interest + penalty   // computeInvoiceFinalAmount
```

## 4. Pagamento e reconciliação (§13)

Uma fatura tem **vários** `CoachPayment` (parciais). O status é **sempre**
recalculado da SOMA das baixas (`reconcileInvoiceStatus`), em centavos:

```
cancelada                      → CANCELLED
totalPago ≥ finalAmount        → PAID       (paidAt = data da última baixa)
totalPago > 0                  → PARTIALLY_PAID
não pago e vencido (now>due)   → OVERDUE
senão                          → PENDING
```

"Marcar como paga" = registrar uma baixa do saldo restante (mantém a trilha).

## 5. Inadimplência (§15)

Faturas abertas (`PENDING/PARTIALLY_PAID/OVERDUE`) já vencidas, com saldo > 0.
Faixas de atraso (`overdueBucket`): **1-7 / 8-15 / 16-30 / 31-60 / 60+** dias.
Não bloqueia acesso a treino (§15).

## 6. Indicadores (§17) — fórmulas formais

| Indicador | Fórmula |
| --- | --- |
| Receita recebida | Σ pagamentos no período |
| Receita prevista | Σ `finalAmount` de faturas não canceladas vencendo no período |
| Receita vencida | Σ saldo das faturas vencidas em aberto |
| MRR | Σ valor **mensalizado** dos contratos ativos recorrentes (`monthlyValue`) |
| Ticket médio | receita recebida / clientes pagantes |
| Churn | contratos cancelados no período / contratos ativos no início |
| Conversão | leads ganhos / (ganhos + perdidos) |
| LTV simples | ticket médio / churn (0 sem churn — nunca inventa) |

`monthlyValue`: WEEKLY×52/12, MONTHLY×1, QUARTERLY/3, SEMIANNUAL/6, ANNUAL/12.

## 7. Limitações conhecidas (registradas, não escondidas)

- `daysLate`/janelas em **UTC**, não no fuso da organização.
- "Contratos ativos no início" ≈ ativos agora + cancelados no período (aproximação).
- `hasData=false` → a UI diz "Ainda não há dados suficientes" em vez de métrica falsa (§16).
- Estornos (`REFUNDED`), cache de dashboard e job periódico de geração/varredura
  OVERDUE: deferidos.

## 8. Auditoria financeira (§32)

Toda ação sensível gera `AuditLog` (nunca com o valor em texto livre — só
ids/ação/contagem): geração de faturas, pagamento, edição (desconto/juros/multa),
cancelamento de fatura, e no contrato: criação/desconto/cancelamento/aceite.
