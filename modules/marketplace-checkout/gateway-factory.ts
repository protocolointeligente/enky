import { env } from "@/lib/env";
import { AsaasMarketplaceGateway } from "./asaas-marketplace-gateway";
import { type MarketplacePaymentGateway, SandboxMarketplaceGateway } from "./gateway";

// Resolve o gateway do marketplace: Asaas real (com split 90/10) em PRODUÇÃO com
// credenciais; caso contrário o sandbox determinístico (sem rede, com
// simulateWebhook para testes/Preview). Reusa a API key e o segredo de webhook
// já usados pela assinatura B2B.

function webhookSecret(): string {
  return env.PAYMENT_PROVIDER_WEBHOOK_SECRET || env.AUTH_SECRET;
}

let cached: MarketplacePaymentGateway | null = null;

export function getMarketplaceGateway(): MarketplacePaymentGateway {
  if (cached) return cached;
  if (env.NODE_ENV === "production" && env.PAYMENT_PROVIDER_SECRET_KEY) {
    cached = new AsaasMarketplaceGateway(env.PAYMENT_PROVIDER_SECRET_KEY, webhookSecret());
  } else {
    cached = new SandboxMarketplaceGateway(webhookSecret());
  }
  return cached;
}
