# modules/marketplace

**Responsabilidade:** vitrine e comercialização de planos entre treinadores e atletas — `MarketplacePlan`, `MarketplacePlanVersion` (versionamento comercial imutável) e `MarketplacePurchase`.

**Fonte de verdade:** Data Model Specification v1.2.1 §8; Product & Engineering Specification v1.0 §34.

**Regra crítica:** o checkout usa exclusivamente `MarketplacePlanVersion.priceSnapshot` da versão publicada — nunca o preço em edição do plano (`MarketplacePlan.price`, que é o rascunho da próxima versão). Nenhum plano libera acesso sem pagamento confirmado.

**Status:** fundação apenas — **adiado deliberadamente na Fase 10**, não esquecido.

## Por que ficou de fora da Fase 10

A Fase 10 monetiza a **plataforma** (assinatura do treinador) e para aí, de propósito: é o caminho mais curto até receita com uma superfície de risco pequena. O marketplace entre treinadores é um problema materialmente maior — não por ser mais telas, mas porque muda a natureza do dinheiro:

- deixa de ser cobrança da ENKY para o treinador e passa a ser **repasse a terceiro** (split/marketplace no gateway, com KYC de cada treinador recebedor);
- traz **reembolso e chargeback de conteúdo já entregue** (o atleta baixou o plano de treino), com regra de disputa própria;
- exige moderação (`PENDING_REVIEW`/`REJECTED` já existem no enum) e responsabilidade sobre o que é vendido.

Nada disso se resolve reaproveitando o checkout de assinatura, e misturar os dois agora contaminaria o fluxo simples que já funciona.

## O que já existe a favor

- O schema inteiro (`MarketplacePlan`, `MarketplacePlanVersion`, `MarketplacePurchase`, `PaymentTransaction.purchaseId`) — nada a migrar.
- `PaymentProvider` (`modules/payments`) é a mesma fronteira que o marketplace vai usar; hoje ela só expõe o que a assinatura precisa. Uma compra avulsa entra como novo método do contrato, não como um segundo gateway.
- O webhook já **ignora com segurança** cobrança sem assinatura vinculada (`return null` no adapter) — quando `MarketplacePurchase` entrar, é esse ponto que passa a resolvê-la, e o livro-razão `WebhookEvent` já garante a idempotência dela de graça.
