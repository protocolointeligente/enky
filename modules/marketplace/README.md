# modules/marketplace

**Responsabilidade:** comercialização de treino. Duas gerações convivem:

- **Legado (fundação `main`):** `MarketplacePlan`, `MarketplacePlanVersion`, `MarketplacePurchase` — venda estreita treinador→atleta dentro de uma org.
- **Marketplace público (Etapa 5):** família `MarketplaceProduct` — comprador = `User` qualquer, vendedor com perfil público, catálogo, pedido, entrega, comissão, ledger e avaliações.

**Fonte de verdade:** Data Model Specification v1.2.1 §8 (legado); brief Etapa 5 + `docs/adr/ADR-005-marketplace-public-foundation.md` (público).

## Estado (Etapa 5)

Fatia entregue: **auditoria + fundação de schema**.

- Auditoria: `docs/ENKY_MARKETPLACE_CURRENT_STATE.md`.
- Modelos novos: `MarketplaceSellerProfile`, `MarketplaceProduct` (+`Variant`, `Version`), `MarketplaceCategory` (+join), `MarketplaceOrder` (+`Item`), `MarketplaceCart` (+`Item`), `MarketplaceEntitlement`, `MarketplaceReview` (+`Response`), `MarketplaceCommissionRule`, `MarketplaceLedgerEntry`, `MarketplaceSellerBalance`, `MarketplacePaymentEvent`, `MarketplaceCoupon` (+`Redemption`). Enums correspondentes.
- Migração: `prisma/migrations/20260719150000_marketplace_public_commerce` — **aditiva**, ainda não aplicada a nenhum banco.

**Regras críticas herdadas:** checkout usa exclusivamente o `priceSnapshot` da versão publicada, nunca o preço em edição; nenhum acesso sem pagamento confirmado; ENKY nunca persiste dados de cartão (só tokens do gateway).

## Próximas fatias (fora desta entrega)

Submódulos previstos (`marketplace-catalog`, `-orders`, `-checkout`, `-delivery`, `-reviews`, `-payouts`, `-moderation`, `-search`) serão criados **quando tiverem código** — não antes. Serviços, gateway (`MarketplacePaymentGateway`), webhook handler, entrega, jobs, páginas públicas, seed dos 20 produtos oficiais e testes de integração/e2e ainda não implementados.
