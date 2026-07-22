# modules/marketplace

**Responsabilidade:** comercialização de treino. Duas gerações convivem:

- **Legado (fundação `main`):** `MarketplacePlan`, `MarketplacePlanVersion`, `MarketplacePurchase` — venda estreita treinador→atleta dentro de uma org.
- **Marketplace público (Etapa 5):** família `MarketplaceProduct` — comprador = `User` qualquer, vendedor com perfil público, catálogo, pedido, entrega, comissão, ledger e avaliações.

**Fonte de verdade:** Data Model Specification v1.2.1 §8 (legado); brief Etapa 5 + `docs/adr/ADR-005-marketplace-public-foundation.md` (público).

## Estado (Etapa 5)

**Fundação + MVP de compra ponta a ponta entregues.** Migração
`20260719150000_marketplace_public_commerce` — aditiva, **aplicada em prod e
staging**.

Modelos (fundação): `MarketplaceSellerProfile`, `MarketplaceProduct` (+`Variant`,
`Version`), `MarketplaceCategory` (+join), `MarketplaceOrder` (+`Item`),
`MarketplaceCart` (+`Item`), `MarketplaceEntitlement`, `MarketplaceReview`
(+`Response`), `MarketplaceCommissionRule`, `MarketplaceLedgerEntry`,
`MarketplaceSellerBalance`, `MarketplacePaymentEvent`, `MarketplaceCoupon`
(+`Redemption`).

Submódulos com código:
- `marketplace/` — `pricing.ts`, `ledger.ts` (dinheiro puro em centavos).
- `marketplace-catalog/` — `catalog.ts` (leitura PUBLISHED+PUBLIC), `labels.ts`, `seo.ts`.
- `marketplace-checkout/` — `gateway.ts` (interface + sandbox + HMAC), `gateway-factory.ts`, `checkout-service.ts` (pedido idempotente), `webhook-service.ts` (verificação + dedupe + PAID→entrega).
- `marketplace-delivery/` — `delivery-payload.ts` (plano puro), `delivery-service.ts` (confirma pagamento, concede entitlement, lança ledger — idempotente).
- `marketplace-orders/` — `library.ts` (biblioteca do comprador).

Superfície HTTP: páginas `/marketplace`, `/marketplace/produtos/[slug]`,
`/marketplace/biblioteca`; rotas `/api/marketplace/checkout`,
`/api/webhooks/marketplace`, `/api/marketplace/library`. Cobertura: 48+ testes
unitários + `tests/integration/marketplace-purchase.test.ts` (checkout→webhook→
entrega→biblioteca, idempotência).

**Regras críticas:** checkout usa exclusivamente o `priceSnapshot` da versão
publicada, nunca o preço em edição; nenhum acesso sem pagamento confirmado; ENKY
nunca persiste dados de cartão (só tokens do gateway).

Painel do vendedor entregue (`marketplace-seller/seller-service.ts` +
`/treinador/marketplace`): treinador cria perfil de vendedor, cadastra produto
(DRAFT) e publica (congela versão comercial → entra no catálogo). Ownership
verificado. Sem moderação (self-publish).

## Próximas fatias (fatia B — restante)

Gateway real Asaas (split/KYC/repasse) no lugar do sandbox + coleta de CPF no
checkout; execução da entrega (cópia efetiva de periodização/templates para a
conta do comprador — hoje só o entitlement é gravado); payouts; moderação
(`PENDING_REVIEW`/`REJECTED`); avaliações; cupons; carrinho multi-item; busca;
seed dos 20 produtos oficiais; reembolso/chargeback.
