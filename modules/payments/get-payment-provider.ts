import { env } from "@/lib/env";
import { AsaasPaymentProvider } from "./asaas-payment-provider";
import { FakePaymentProvider } from "./fake-payment-provider";
import type { PaymentProvider } from "./payment-provider";

// Ponto de decisão único de qual gateway o código usa — mesmo contrato do
// `getInvitationMailer()`, e pela mesma razão: a escolha nunca se espalha
// pelas rotas.
//
// Regra (idêntica à do mailer, e aqui ela vale ainda mais): NUNCA há fallback
// silencioso para o provedor falso fora de development/test. Um FakeProvider
// ativo em produção aceitaria "pagamento confirmado" forjado — libera plano
// pago de graça e, pior, faria isso em silêncio. Sem configuração, produção
// falha de forma explícita.
//
// Preview na Vercel roda com NODE_ENV=production: para testar pagamento em
// Preview, configure as chaves de SANDBOX do Asaas ($aact_hmlg_...). O adapter
// detecta o prefixo e fala com api-sandbox.asaas.com sozinho.
let cached: PaymentProvider | null = null;

export function getPaymentProvider(): PaymentProvider {
  if (cached) return cached;

  const apiKey = env.PAYMENT_PROVIDER_SECRET_KEY;
  const webhookSecret = env.PAYMENT_PROVIDER_WEBHOOK_SECRET;

  if (apiKey && webhookSecret) {
    cached = new AsaasPaymentProvider(apiKey, webhookSecret);
    return cached;
  }

  if (env.NODE_ENV === "production") {
    throw new Error(
      "Gateway de pagamento não configurado: defina PAYMENT_PROVIDER_SECRET_KEY e PAYMENT_PROVIDER_WEBHOOK_SECRET.",
    );
  }

  cached = new FakePaymentProvider();
  return cached;
}
