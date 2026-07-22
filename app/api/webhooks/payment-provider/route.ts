import type { NextRequest } from "next/server";
import { AuthenticationError } from "@/domain/errors";
import { handlePaymentWebhook } from "@/modules/payments/webhook-service";
import { WebhookVerificationError } from "@/modules/payments/payment-provider";
import { apiError, apiSuccess } from "@/server/http/response";
import { logger } from "@/server/observability/logger";
import { getClientIp } from "@/server/security/ip";
import { enforceRateLimit, webhookRateLimiter } from "@/server/security/rate-limit";

export const dynamic = "force-dynamic";

// Webhook do gateway de pagamento (Asaas). Três coisas o diferenciam de toda
// outra rota de mutação do sistema — cada uma deliberada:
//
//  1. NÃO chama `assertTrustedOrigin()`. O CSRF de origem existe para pedidos
//     disparados pelo NAVEGADOR de um usuário logado; aqui quem chama é um
//     servidor do gateway, sem Origin/Referer e cross-origin por definição.
//     Exigir origem confiável rejeitaria 100% dos eventos legítimos. O que
//     autentica esta rota é o segredo compartilhado verificado dentro do
//     adapter (`asaas-access-token`), e não há cookie de sessão envolvido —
//     nada que um site de terceiros possa fazer o navegador enviar.
//
//  2. NÃO chama `requireAuthenticatedUser()`. Não há sessão: as escritas que
//     ela produz são auditadas como SYSTEM.
//
//  3. Lê o corpo como TEXTO CRU (`request.text()`), nunca `parseJsonBody`.
//     O segredo é conferido antes de o corpo ser interpretado, e o hash do
//     payload registrado é o dos bytes recebidos — reserializar o JSON mudaria
//     esses bytes.
export async function POST(request: NextRequest) {
  try {
    await enforceRateLimit(webhookRateLimiter, `payment-webhook:${getClientIp(request)}`);

    const rawBody = await request.text();
    const result = await handlePaymentWebhook(rawBody, request.headers);

    // 200 em processed, duplicate E ignored. Só o 200 faz o gateway parar de
    // reenviar; um erro aqui vira retentativa infinita e, no Asaas,
    // desativação do webhook depois de falhas seguidas — que silenciaria TODA
    // confirmação de pagamento da conta. "Já processei" e "não me interessa"
    // são sucesso, não falha.
    return apiSuccess({ outcome: result.outcome });
  } catch (error) {
    if (error instanceof WebhookVerificationError) {
      // Segredo inválido/ausente: 401 e nada tocado no banco. Sem detalhe na
      // resposta — quem falhou a verificação não recebe pista de por quê.
      logger.warn(
        { ip: getClientIp(request), reason: error.message },
        "webhook de pagamento com verificação inválida — rejeitado",
      );
      return apiError(new AuthenticationError("Webhook não autenticado."));
    }
    return apiError(error);
  }
}
