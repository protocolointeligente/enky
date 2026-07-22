import type { NextRequest } from "next/server";
import {
  getActivityProvider,
  stravaRedirectUri,
} from "@/modules/integrations/get-activity-provider";
import { createOAuthState } from "@/modules/integrations/oauth-state";
import { requireAuthenticatedUser, requireGlobalRole } from "@/server/auth/guards";
import { apiError, apiSuccess } from "@/server/http/response";
import { assertTrustedOrigin } from "@/server/security/csrf";
import { enforceRateLimit, integrationWriteRateLimiter } from "@/server/security/rate-limit";

export const dynamic = "force-dynamic";

// Devolve a URL de autorização em JSON em vez de responder 302.
//
// Por quê: o cliente é uma SPA que chama isto com `fetch`. Um 302 para o
// strava.com seria seguido pelo próprio fetch, que então falharia no CORS — e
// o atleta veria um erro em vez da tela de permissão. Devolvendo a URL, a
// página navega com `window.location`, que é o que precisa acontecer: o
// handshake OAuth é uma navegação do usuário, não uma chamada de API.
export async function POST(request: NextRequest) {
  try {
    assertTrustedOrigin(request);
    const identity = await requireAuthenticatedUser();
    requireGlobalRole(identity, ["ATHLETE"]);

    await enforceRateLimit(integrationWriteRateLimiter, `strava-authorize:${identity.userId}`);

    // Lança BusinessRuleError (422) quando a instalação não tem credencial do
    // Strava — a integração é opcional e a ausência é um estado suportado.
    const provider = getActivityProvider();

    // `state` assinado e amarrado a ESTE usuário: é o que impede que o code de
    // um atacante seja trocado na sessão da vítima (ver oauth-state.ts).
    const state = createOAuthState(identity.userId);

    return apiSuccess({ authorizationUrl: provider.buildAuthorizationUrl(state, stravaRedirectUri()) });
  } catch (error) {
    return apiError(error);
  }
}
