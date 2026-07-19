# ADR-005 — Marketplace público: fundação de dados (Etapa 5)

**Status:** Aceito (fundação de schema; implementação de fluxos em sessões seguintes)
**Data:** Etapa 5 — Marketplace Público, primeira fatia (auditoria + schema).
**Contexto:** o ENKY tem três domínios comerciais que não podem se misturar (§CONTEXTO do brief): assinatura SaaS (`Subscription`), venda privada assessoria→cliente (`MarketplacePlan`/`MarketplacePurchase`) e o marketplace público. A auditoria (`docs/ENKY_MARKETPLACE_CURRENT_STATE.md`) confirmou que só existe a fundação estreita de `MarketplacePlan` (comprador = atleta de uma org), inadequada ao comprador público.

## Decisões

### 1. Família nova `MarketplaceProduct`, sem apagar `MarketplacePlan`
O marketplace público usa modelos próprios (`MarketplaceProduct`, `MarketplaceOrder`, `MarketplaceSellerProfile`, `MarketplaceEntitlement`, etc.). `MarketplacePlan`/`MarketplacePurchase` **permanecem** (regra: não destruir modelos/dados) como venda estreita legada. A reconciliação (migrar planos → produtos, ou aposentar) é trabalho futuro — **não** feita agora para não arriscar migração destrutiva numa fatia de fundação. Enums novos (`MarketplaceProductStatus` com `APPROVED`/`SUSPENDED`) não colidem com `MarketplaceStatus` do legado.

### 2. Comprador = `User`, não atleta
`MarketplaceOrder.buyerUserId` referencia `User` (comprador público qualquer), com `buyerOrganizationId` opcional. Isolamento do comprador via FK + índice. Vínculo com atleta/CRM só acontece na **entrega** de serviços (COACHING), fora do pedido.

### 3. Snapshot imutável (mesmo padrão de `MarketplacePlanVersion`)
`MarketplaceProductVersion` guarda snapshot comercial (`priceSnapshot`, `contentSnapshot`). O pedido referencia a **versão**, e `MarketplaceOrderItem` copia título/tipo/preço/comissão como snapshot. Ids de vendedor em order-item/entitlement/ledger são `String` **sem FK** — snapshots não devem cascatear nem mudar quando a origem muda. Checkout usa exclusivamente `priceSnapshot`, nunca `MarketplaceProduct.price` (valor em edição).

### 4. Pedido multivendedor: um pedido, itens por vendedor
`MarketplaceOrder` é multi-item; cada `MarketplaceOrderItem` carrega `sellerOrganizationId` + comissão própria. O MVP pode restringir o carrinho a um vendedor por pedido na camada de serviço; o schema já suporta multivendedor sem migração. Carrinho e itens em moeda única (`currency` VarChar(3), default BRL).

### 5. Ledger é a fonte de verdade do saldo
`MarketplaceLedgerEntry` (SALE / PLATFORM_FEE / GATEWAY_FEE / REFUND / CHARGEBACK / PAYOUT / ADJUSTMENT) é append-only; `MarketplaceSellerBalance` é **cache derivável** (nunca mutar sem lançar no ledger). Comissão vem de `MarketplaceCommissionRule` e é congelada em `MarketplaceOrderItem.commissionSnapshot` — sem recálculo retroativo.

### 6. Split: só ledger interno nesta fase
Não há split real. Repasse fica como entradas `PAYOUT` pendentes no ledger. **Não** ativar split em produção (regra do brief).

### 7. Webhook: reutiliza `PaymentTransaction`, com log cru à parte
O dinheiro do pedido usa `PaymentTransaction` (idempotência + campos de webhook já existentes; adicionado FK `marketplaceOrderId`). `MarketplacePaymentEvent` é o log cru do webhook (`@@unique([gateway, externalEventId])`) para dedupe/reprocesso e eventos fora de ordem/desconhecidos.

### 8. Idempotência de entrega
`MarketplaceEntitlement.orderItemId @unique` garante um entitlement por item — entrega repetida não duplica acesso.

## Consequências / pendências
- Reconciliação `MarketplacePlan` ↔ `MarketplaceProduct` (ADR futuro).
- Índice parcial para dedupe de carrinho sem variante (hoje na camada de serviço — ver comentário `ponytail:` no schema).
- Migração `20260719150000_marketplace_public_commerce` é aditiva; **testar em banco descartável** antes de qualquer deploy — não foi aplicada a nenhum banco nesta sessão.
