import { NextResponse, type NextRequest } from "next/server";
import { getActivityProvider } from "@/modules/integrations/get-activity-provider";
import { handleStravaWebhook } from "@/modules/integrations/strava-webhook-service";
import { apiSuccess } from "@/server/http/response";
import { logger } from "@/server/observability/logger";
import { getClientIp } from "@/server/security/ip";
import { enforceRateLimit, webhookRateLimiter } from "@/server/security/rate-limit";

export const dynamic = "force-dynamic";

// Webhook do Strava. Como o de pagamento (Fase 10), não usa
// `assertTrustedOrigin` nem `requireAuthenticatedUser`: quem chama é um
// servidor do Strava, sem cookie e cross-origin por definição.
//
// GET — handshake de criação da inscrição. É o ÚNICO momento em que há um
// segredo a validar: o Strava ecoa o `hub.verify_token` que enviamos ao criar
// a inscrição, e devolvemos o `hub.challenge` para provar que o endpoint é
// nosso. Ver strava-webhook-service.ts para por que o POST não tem equivalente
// e por que isso não nos torna vulneráveis.
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;

  let challenge: string | null = null;
  try {
    challenge = getActivityProvider().verifySubscription(
      params.get("hub.mode"),
      params.get("hub.verify_token"),
      params.get("hub.challenge"),
    );
  } catch {
    // Instalação sem Strava configurado. Cai no 403 abaixo: para quem chama, um
    // endpoint sem segredo cadastrado e um segredo errado são a mesma coisa —
    // e é isso mesmo que queremos revelar (nada).
  }

  if (!challenge) {
    logger.warn({ ip: getClientIp(request) }, "handshake do webhook do Strava recusado");
    // 403 sem detalhe — quem falhou a verificação não recebe pista de por quê.
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // O Strava exige exatamente `{"hub.challenge": "<valor>"}` — não é o
  // envelope `{ok,data}` do resto da API. Um formato diferente faz a criação
  // da inscrição falhar.
  return NextResponse.json({ "hub.challenge": challenge });
}

// POST — evento de atividade.
//
// SEMPRE 200, inclusive em falha. O Strava exige resposta em até 2s e
// DESATIVA a inscrição depois de falhas repetidas — o que silenciaria a
// integração de TODOS os atletas por causa do erro de um. O evento com falha
// fica registrado como FAILED no livro-razão (WebhookEvent), que é onde a
// investigação acontece; e a importação manual sempre recupera o que se
// perdeu. Mesma lógica do webhook do Asaas, por uma razão idêntica.
export async function POST(request: NextRequest) {
  try {
    await enforceRateLimit(webhookRateLimiter, `strava-webhook:${getClientIp(request)}`);

    // Texto cru: o hash registrado no livro-razão precisa ser o dos bytes
    // recebidos — reserializar o JSON mudaria esses bytes.
    const rawBody = await request.text();
    const result = await handleStravaWebhook(getActivityProvider(), rawBody);

    return apiSuccess({ outcome: result.outcome });
  } catch (error) {
    // Inclui o caso "instalação sem Strava configurado" (BusinessRuleError de
    // getActivityProvider): alguém POSTando numa instalação sem integração não
    // é um incidente, é ruído.
    logger.error({ err: error }, "erro não tratado no webhook do Strava");
    return apiSuccess({ outcome: "ignored" });
  }
}
