import { NextResponse, type NextRequest } from "next/server";
import { getPublicBaseUrl } from "@/lib/env";
import { connectProvider } from "@/modules/integrations/external-connection";
import {
  getActivityProvider,
  stravaRedirectUri,
} from "@/modules/integrations/get-activity-provider";
import { verifyOAuthState } from "@/modules/integrations/oauth-state";
import {
  requireAuthenticatedUser,
  requireGlobalRole,
  resolveAthleteOrganization,
} from "@/server/auth/guards";
import { logger } from "@/server/observability/logger";
import { getClientIp } from "@/server/security/ip";
import { enforceRateLimit, integrationWriteRateLimiter } from "@/server/security/rate-limit";

export const dynamic = "force-dynamic";

const RESULT_PAGE = "/atleta/integracoes";

// Redireciona SEMPRE para a página de integrações, com o resultado no
// query string. É o retorno de uma navegação do usuário vinda do strava.com,
// não uma chamada de API: responder JSON deixaria o atleta olhando para um
// `{"ok":true}` cru no navegador.
//
// O motivo do erro vai como CÓDIGO curto, nunca como texto do provedor: a
// query string fica no histórico do navegador e em logs de proxy.
function backToApp(status: "conectado" | "erro", reason?: string): NextResponse {
  const url = new URL(RESULT_PAGE, getPublicBaseUrl());
  url.searchParams.set("strava", status);
  if (reason) url.searchParams.set("motivo", reason);
  return NextResponse.redirect(url);
}

// Este GET muta estado (cria a conexão), o que normalmente seria um POST. Não
// há escolha: é o Strava que redireciona o navegador para cá, e ele usa GET.
// O que substitui a proteção que um POST teria:
//   - `assertTrustedOrigin` NÃO se aplica (a navegação vem do strava.com, então
//     não há Origin confiável a exigir — exigi-lo rejeitaria 100% dos retornos
//     legítimos);
//   - em seu lugar, o `state` assinado prova que ESTE usuário iniciou ESTE
//     fluxo, que é exatamente a garantia que o CSRF token daria;
//   - a sessão continua obrigatória, e o `state` tem de ser dela.
export async function GET(request: NextRequest) {
  try {
    const identity = await requireAuthenticatedUser();
    requireGlobalRole(identity, ["ATHLETE"]);

    await enforceRateLimit(integrationWriteRateLimiter, `strava-callback:${identity.userId}`);

    const params = request.nextUrl.searchParams;

    // O atleta clicou em "Cancelar" na tela do Strava, ou negou o escopo.
    // Não é falha do sistema.
    if (params.get("error")) {
      return backToApp("erro", "autorizacao_negada");
    }

    const state = verifyOAuthState(params.get("state"));
    // State inválido/expirado, OU válido mas de OUTRO usuário — o ataque
    // descrito em oauth-state.ts. Não conectamos nada.
    if (!state || state.userId !== identity.userId) {
      logger.warn({ userId: identity.userId }, "callback do Strava com state inválido — recusado");
      return backToApp("erro", "estado_invalido");
    }

    const code = params.get("code");
    if (!code) return backToApp("erro", "codigo_ausente");

    // O Strava só concede o escopo que o atleta marcou. Sem `activity:read_all`
    // a importação traria só o público e deixaria buracos silenciosos no
    // histórico — melhor recusar agora e explicar do que "conectar" pela metade.
    const scope = params.get("scope") ?? "";
    if (!scope.split(",").includes("activity:read_all")) {
      return backToApp("erro", "escopo_insuficiente");
    }

    const provider = getActivityProvider();
    const tokens = await provider.exchangeCode(code, stravaRedirectUri());

    const { organizationId, athleteProfileId } = await resolveAthleteOrganization(identity.userId);

    await connectProvider(provider, tokens, {
      userId: identity.userId,
      organizationId,
      athleteProfileId,
      ipAddress: getClientIp(request),
      userAgent: request.headers.get("user-agent") ?? undefined,
    });

    return backToApp("conectado");
  } catch (error) {
    // Nenhum erro sobe como 500 aqui: o atleta está num navegador, no meio de
    // um fluxo. Ele volta para a página com um motivo legível. O detalhe fica
    // no log — que nunca vê o `code` nem o token.
    logger.warn({ err: error }, "falha no callback do Strava");
    return backToApp("erro", "falha_conexao");
  }
}
