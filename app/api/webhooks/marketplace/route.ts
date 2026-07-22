import type { NextRequest } from "next/server";
import { AuthenticationError, ExternalServiceError } from "@/domain/errors";
import { handleMarketplaceWebhook } from "@/modules/marketplace-checkout/webhook-service";
import { apiError, apiSuccess } from "@/server/http/response";
import { logger } from "@/server/observability/logger";
import { getClientIp } from "@/server/security/ip";
import { enforceRateLimit, webhookRateLimiter } from "@/server/security/rate-limit";

export const dynamic = "force-dynamic";

// Webhook do gateway do marketplace. Mesmas exceções da rota de pagamento
// (webhooks/payment-provider): sem assertTrustedOrigin e sem sessão (quem chama
// é o gateway), corpo lido como TEXTO CRU (o hash registrado é o dos bytes
// recebidos), e 200 em processed/duplicate/ignored — só erro real faz o gateway
// reenviar.
export async function POST(request: NextRequest) {
  try {
    await enforceRateLimit(webhookRateLimiter, `marketplace-webhook:${getClientIp(request)}`);

    const rawBody = await request.text();
    const signature = request.headers.get("x-webhook-signature") ?? "";
    const result = await handleMarketplaceWebhook(rawBody, signature);

    return apiSuccess({ outcome: result.outcome });
  } catch (error) {
    if (error instanceof ExternalServiceError) {
      logger.warn(
        { ip: getClientIp(request), reason: error.message },
        "webhook do marketplace com assinatura inválida — rejeitado",
      );
      return apiError(new AuthenticationError("Webhook não autenticado."));
    }
    return apiError(error);
  }
}
