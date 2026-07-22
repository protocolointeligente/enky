# modules/marketplace-checkout

**Responsabilidade (§18–21):** criação de cobrança, idempotência, abstração de gateway, verificação e reconciliação de webhook do marketplace público.

**Fonte de verdade:** brief Etapa 5 §18–21; `docs/adr/ADR-005-marketplace-public-foundation.md`.

## Estado

Entregue: **abstração de gateway + verificação de webhook**.

- `gateway.ts` — interface `MarketplacePaymentGateway` (createCheckout / getPaymentStatus / cancelPayment / refundPayment / verifyWebhook). Regras do marketplace nunca acoplam ao Asaas — falam só com esta interface.
- Primitivas puras `signWebhook` / `verifyWebhookSignature` (HMAC-SHA256, comparação em tempo constante) / `hashPayload` — reutilizáveis por qualquer implementação, incl. Asaas.
- `SandboxMarketplaceGateway` — implementação determinística em memória para testes e Preview (`simulateWebhook` gera o par corpo+assinatura real). **Não usar em produção.**

**Regra crítica:** assinatura de webhook validada em tempo constante; nunca confiar em preço/valor vindos do frontend (recalcular no servidor via `modules/marketplace/pricing`).

## Pendente (próximas fatias)

Orquestração de checkout (pedido → `PaymentTransaction` idempotente → gateway → webhook → entrega → entitlement) — depende de banco descartável. Implementação real de gateway (Asaas sandbox) consome a mesma interface + primitivas; segredo do webhook virá de variável de ambiente (ex.: `MARKETPLACE_WEBHOOK_SECRET`), injetado no construtor.
