# modules/coach-finance

**Responsabilidade:** analítica financeira da assessoria (Etapa 4 §15–17) —
inadimplência e indicadores. Só **leitura/agregação**; não cria entidade.

**Fonte de verdade:** prompt "ENKY — Etapa 4" §15 (inadimplência), §17 (fórmulas).

## Inadimplência (§15)

`listDelinquency` = faturas abertas (`PENDING`/`PARTIALLY_PAID`/`OVERDUE`) já
vencidas, com saldo restante > 0. Classifica em faixas **1-7 / 8-15 / 16-30 /
31-60 / 60+** dias (`overdueBucket`) e resume por faixa. **Não bloqueia acesso a
treino** (§15). Cap de 500 itens — paginar quando escalar (§30).

## Indicadores (§17)

`computeIndicators` (período default = mês corrente). Fórmulas formais em
`finance-math` (puras, testadas):

| Indicador | Fórmula |
| --- | --- |
| Ticket médio | receita recebida / clientes pagantes |
| Churn | contratos cancelados no período / contratos ativos no início |
| Conversão | leads ganhos / (ganhos + perdidos) |
| MRR | Σ valor mensalizado dos contratos ativos recorrentes |
| LTV simples | ticket médio / churn (0 sem churn — nunca inventa) |
| Receita prevista | Σ finalAmount de faturas não canceladas vencendo no período |
| Receita recebida | Σ pagamentos no período |
| Receita vencida | Σ saldo das faturas vencidas em aberto |

**Limitações conhecidas** (registradas, não escondidas):
- `daysLate`/períodos em **UTC**, não no fuso da organização (refinamento futuro).
- `contratos ativos no início` ≈ ativos agora + cancelados no período (aproximação).
- `hasData=false` → a UI mostra "Ainda não há dados suficientes" (§16), nunca métrica falsa.

## Escopo / deferido

- **Entregue:** inadimplência + indicadores; rotas `app/api/trainer/finance/*`; UI
  `/treinador/gestao/financeiro` (Resumo + Inadimplência).
- **Deferido:** varredura em lote PENDING→OVERDUE persistida (aqui o overdue é
  derivado na leitura, sempre correto); gráficos (§16 mostra cards numéricos +
  faixas); dashboard técnico unificado (a parte técnica segue no Painel).

## Segurança

Só leitura. `requireOrgRole`: indicadores → MANAGER/FINANCE; inadimplência →
+ HEAD_COACH/SUPPORT/VIEWER (OWNER passa sozinho). Tenant isolation em toda query.
