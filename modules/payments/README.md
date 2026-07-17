# modules/payments

**Responsabilidade:** `PaymentTransaction`, o adapter do gateway de pagamento e o webhook (`/api/webhooks/payment-provider`) — idempotente, com segredo validado, nunca confiando no frontend.

**Fonte de verdade:** Data Model Specification v1.2.1 §8; Interface Architecture v1.4 §1.D–E (segurança de dados de pagamento, pipeline transacional idempotente) e §10 (endpoint de pagamento); Product & Engineering Specification v1.0 §35.

**Regra crítica:** a ENKY nunca recebe, processa ou persiste número de cartão, CVV ou validade — apenas identificadores do gateway. Todo webhook exige evento único (`WebhookEvent`).

**Status:** implementado na Fase 10 (assinatura da plataforma). A compra de plano de marketplace entre treinadores (`MarketplacePurchase`) ainda **não** passa por aqui.

## Provedor: Asaas

`PaymentProvider` (`payment-provider.ts`) é a fronteira — nenhuma regra de negócio conhece o gateway. Adapters:

- `asaas-payment-provider.ts` — produção/sandbox, REST via `fetch` (sem SDK).
- `fake-payment-provider.ts` — development/test. Não fala com a rede, mas verifica o mesmo segredo e produz o mesmo formato de evento, para que os testes exercitem o caminho real.
- `get-payment-provider.ts` — decide qual usar. **Nunca cai para o falso fora de development/test** — um provedor falso em produção aceitaria "pagamento confirmado" forjado.

Duas particularidades do Asaas que ficam contidas no adapter:

1. **API:** header `access_token` (não `Authorization: Bearer`). A base URL é escolhida pelo prefixo da chave — `$aact_hmlg_` → sandbox.
2. **Webhook:** o Asaas **não assina o corpo com HMAC** (ao contrário da Stripe). Ele reenvia, em todo POST, o segredo compartilhado configurado no cadastro do webhook, no header `asaas-access-token`. A verificação é comparação timing-safe de segredo. Por isso o endpoint exige HTTPS em produção: o segredo viaja em claro no header.

## Idempotência

`WebhookEvent` (`@@unique([provider, eventId])`) é a trava. O INSERT é a **primeira** escrita da transação que aplica o efeito: a reentrega do mesmo evento colide, a transação inteira faz rollback e nada é reaplicado. Não é um "SELECT antes do INSERT" — esse teria janela de corrida entre duas entregas simultâneas, que o gateway realmente faz (coberto por teste).

Uma segunda camada protege a contabilidade: `PaymentTransaction.idempotencyKey` é `<provider>:payment:<gatewayPaymentId>` — por **cobrança**, não por evento. `PAYMENT_CONFIRMED` e `PAYMENT_RECEIVED` são eventos distintos da mesma cobrança e convergem para uma única linha.

## Regras invioláveis

- `Subscription.status` só muda aqui, a partir de evento verificado. O checkout deixa `INCOMPLETE`; o cancelamento grava só a intenção (`cancelAtPeriodEnd`).
- Falha de pagamento → `PAST_DUE`. **Nunca apaga dados** — ver `modules/subscriptions`.
- O webhook responde 200 em `processed`, `duplicate` e `ignored`. Só erro real devolve não-2xx: o Asaas desativa webhooks que falham repetidamente, o que silenciaria toda confirmação de pagamento da conta.
- A rota do webhook **não** usa `assertTrustedOrigin()` nem sessão — quem chama é um servidor, sem Origin e sem cookie. Ver o comentário de topo da rota.
- Escritas vindas do webhook são auditadas como `SYSTEM`, sem `userId`: não há sessão, e atribuí-las ao treinador falsificaria a trilha.
