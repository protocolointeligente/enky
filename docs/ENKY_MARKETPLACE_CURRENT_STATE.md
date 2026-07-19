# ENKY Marketplace — Estado Atual (Auditoria §1, Etapa 5)

Branch: `feat/public-marketplace-commerce` (criada a partir de `main`).
Data da auditoria: 2026-07-19.
Escopo desta sessão: **auditoria + fundação de schema**. Sem UI, checkout, jobs ou seeds nesta entrega.

---

## 1. O que já existe (fundação em `main`)

### Modelos de marketplace (schema §8, imutável)
| Modelo | Papel atual | Comprador | Observação |
|---|---|---|---|
| `MarketplacePlan` | Plano de treino vendido por um `TrainerProfile` dentro de uma `Organization`. Campos: `title`, `description`, `price`, `modality`, `targetLevel`, `durationWeeks`, `status` (`MarketplaceStatus`), `commercialVersion`, `lockVersion`, `publishedVersionId`. | — | Um único tipo de produto (treino). Sem `productType`, `seller público`, `visibility`, `categoria`, `variante`, `mídia`, `SEO`. |
| `MarketplacePlanVersion` | Snapshot comercial **imutável** por versão (`titleSnapshot`, `priceSnapshot`, `contentSnapshot: Json`). `@@unique([marketplacePlanId, commercialVersion])`. | — | Padrão de versionamento já resolvido — **reutilizar o conceito**. |
| `MarketplacePurchase` | Compra ligada a `athleteId` (`AthleteProfile`) + `organizationId`, referencia uma `MarketplacePlanVersion`. Status `MarketplacePurchaseStatus`. Liga a `Workout[]` e `PaymentTransaction[]`. | `AthleteProfile` | **Comprador = atleta de uma org**, não um comprador público. Conflito conceitual com o marketplace público (comprador = `User` qualquer). |

### Infra financeira / pagamentos
- `PaymentTransaction` — genérica: liga a `MarketplacePurchase?` **ou** `Subscription?`. Já resolve **idempotência e webhook**: `idempotencyKey @unique`, `webhookEventId @unique`, `webhookPayloadHash`, `webhookEventType`, `webhookReceivedAt/ProcessedAt`, `gatewayRefId @unique`, `lockVersion`. **Reutilizar** para o dinheiro do marketplace.
- `Subscription` / `SubscriptionPlan` — assinatura SaaS ENKY (não confundir — §53).
- `modules/payments/README.md` — regra crítica: ENKY nunca persiste cartão/CVV, só tokens do gateway; todo webhook exige `idempotencyKey`/`webhookEventId` único. **Nenhum código de gateway implementado** (só README).

### Auditoria
- `AuditLog` — pronto: `action`, `entityName`, `entityId`, `actorType`, `correlationId`, `changedFields[]`, `previousValuesHash`/`newValuesHash`, IP, requestId. **Reutilizar** para todas as ações de moderação/comissão/entrega.

### Enums reutilizáveis
- `PaymentStatus` (PENDING/PAID/FAILED/REFUNDED/CANCELLED/DISPUTED/EXPIRED) — serve ao pagamento do pedido.
- `Modality` (RUNNING/STRENGTH/FUNCTIONAL/CYCLING/SWIMMING/TRIATHLON).
- `WorkoutSource` já inclui `MARKETPLACE` — a entrega de plano pode marcar a origem.

### Módulos (só README de fundação, sem código)
`modules/marketplace`, `modules/payments`. Demais módulos de negócio (athletes, workouts, periodization, templates, exercises, etc.) têm código real e são as **fontes de conteúdo** para produtos.

---

## 2. Lacunas vs. Etapa 5

Não existe nada de: tipos de produto além de treino; perfil público de vendedor + verificação; categorias; variantes; carrinho; pedido multi-item; comissão; ledger/saldo; payouts/split; avaliações/reputação; moderação (além do enum de status); entitlements como conceito separado; cupons; abstração de gateway (`MarketplacePaymentGateway`); serviço de entrega; páginas públicas/SEO; busca/filtros; jobs; notificações; analytics.

---

## 3. Conflitos conceituais e decisões

1. **Comprador atleta-de-org vs. comprador público.** `MarketplacePurchase.athleteId` assume que o comprador é um atleta interno. O marketplace público precisa de `buyerUserId` (qualquer `User`). → **Novos modelos** (`MarketplaceOrder` com `buyerUserId`), não estender `MarketplacePurchase`.
2. **`MarketplacePlan` vs. `MarketplaceProduct`.** §53 exige nomes distintos. `MarketplacePlan` é uma venda estreita (treino, atleta, org). O produto público precisa de `productType`, vendedor, visibilidade, categoria, mídia, SEO. → **Introduzir a família `MarketplaceProduct`**; **não apagar** `MarketplacePlan` (regra de não destruir dados/modelos). Reconciliação (migrar planos → produtos, ou aposentar) fica como trabalho futuro documentado em ADR. Ver `docs/adr`.
3. **Evento de webhook.** `PaymentTransaction` já deduplica webhooks, mas eventos podem chegar fora de ordem / desconhecidos (§21). → Manter o dinheiro em `PaymentTransaction` (adicionar FK opcional `marketplaceOrderId`) **e** um log cru `MarketplacePaymentEvent` para dedupe/reprocesso.
4. **Status enum.** `MarketplaceStatus` (usado por `MarketplacePlan`) não tem `APPROVED`/`SUSPENDED`. → Novo enum `MarketplaceProductStatus` para não colidir.

---

## 4. Reutilização confirmada
- Padrão de **versão imutável** (`*Version` + snapshot + `@@unique`).
- **`PaymentTransaction`** (idempotência + webhook) — money movement do pedido.
- **`AuditLog`** — todas as ações auditáveis (§46).
- **`lockVersion`** (optimistic locking) — em pedidos, entitlements, saldo.
- Enums `PaymentStatus`, `Modality`, `WorkoutSource.MARKETPLACE`.

## 5. Modelos novos (fundação desta sessão)
Família `MarketplaceProduct`: Product, Variant, Version, SellerProfile, Category (+join), Order (+Item), Cart (+Item), Entitlement, Review (+Response), LedgerEntry, SellerBalance, CommissionRule, PaymentEvent, Coupon (+Redemption). Enums correspondentes. Detalhe no schema e em `docs/ENKY_MARKETPLACE_PRODUCT_MODEL.md`.

## 6. Fora do escopo desta sessão (Etapa 5 continua em sessões seguintes)
UI pública, painel vendedor/admin, checkout, integração de gateway real (só interface + sandbox), webhooks handler, serviço de entrega, jobs, notificações, seed dos 20 produtos oficiais, testes de integração/e2e. Migrations rodam apenas em banco descartável — **nunca produção**.
