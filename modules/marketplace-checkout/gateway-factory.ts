import { env } from "@/lib/env";
import { type MarketplacePaymentGateway, SandboxMarketplaceGateway } from "./gateway";

// Resolve o gateway do marketplace. Só sandbox por ora.
// ponytail: adapter Asaas real (split/KYC/repasse) é a fatia B; entra aqui como
// nova implementação de MarketplacePaymentGateway sem tocar em quem chama.

// Sandbox só precisa de um segredo não-vazio p/ assinar/verificar webhook.
// Reusa o segredo de webhook de pagamento; AUTH_SECRET é o fallback sempre presente.
function webhookSecret(): string {
  return env.PAYMENT_PROVIDER_WEBHOOK_SECRET || env.AUTH_SECRET;
}

let cached: MarketplacePaymentGateway | null = null;

export function getMarketplaceGateway(): MarketplacePaymentGateway {
  if (!cached) cached = new SandboxMarketplaceGateway(webhookSecret());
  return cached;
}
