# modules/marketplace

**Responsabilidade:** vitrine e comercialização de planos — `MarketplacePlan`, `MarketplacePlanVersion` (versionamento comercial imutável) e `MarketplacePurchase`.

**Fonte de verdade:** Data Model Specification v1.2.1 §8; Product & Engineering Specification v1.0 §34.

**Regra crítica:** o checkout usa exclusivamente `MarketplacePlanVersion.priceSnapshot` da versão publicada — nunca o preço em edição do plano. Nenhum plano libera acesso sem pagamento confirmado.

**Status:** fundação apenas. Nenhum modelo, serviço ou rota implementado nesta fase.
