# modules/payments

**Responsabilidade:** `PaymentTransaction` e o webhook do gateway de pagamento (`/api/webhooks/payment-provider`) — idempotente, com segredo validado, nunca confiando no frontend.

**Fonte de verdade:** Data Model Specification v1.2.1 §8; Interface Architecture v1.4 §1.D–E (segurança de dados de pagamento, pipeline transacional idempotente) e §10 (endpoint de pagamento).

**Regra crítica:** a ENKY nunca recebe, processa ou persiste número de cartão, CVV ou validade — apenas tokens do gateway. Todo webhook exige `idempotencyKey`/`webhookEventId` único.

**Status:** fundação apenas. Nenhum modelo, serviço ou rota implementado nesta fase.
