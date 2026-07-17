import { BusinessRuleError } from "@/domain/errors";
import { env, getPublicBaseUrl } from "@/lib/env";
import type { ActivityProvider } from "./activity-provider";
import { StravaProvider } from "./strava-provider";

// Callback do OAuth. Precisa bater EXATAMENTE com o "Authorization Callback
// Domain" cadastrado no painel do Strava, e é derivado da URL pública real do
// deployment — nunca de localhost em produção (ver getPublicBaseUrl()).
//
// Vive aqui, e não na rota que o usa: o Next.js só permite exports conhecidos
// (GET/POST/...) num `route.ts`, e as DUAS rotas do fluxo precisam produzir
// esta URL byte a byte igual — o Strava recusa a troca do code se o
// `redirect_uri` do callback divergir do que foi enviado na autorização.
export function stravaRedirectUri(): string {
  return `${getPublicBaseUrl()}/api/athlete/integrations/strava/callback`;
}

// Ponto de decisão único de qual provedor de atividades o código usa — mesmo
// contrato de `getPaymentProvider()` e `getInvitationMailer()`.
//
// Diferença deliberada em relação ao gateway de pagamento: NÃO existe provedor
// falso com fallback automático. Um FakePaymentProvider ativo por engano
// liberaria plano pago de graça; um "FakeStravaProvider" ativo por engano
// escreveria atividade INVENTADA no histórico do atleta — que o treinador
// leria como treino realizado e usaria para ajustar a carga. Dado clínico
// falso é pior que integração ausente. Os testes injetam o duplo
// explicitamente (`setActivityProviderForTests`), nunca por variável de
// ambiente.
//
// Sem credencial configurada, a integração simplesmente NÃO EXISTE para o
// usuário: as rotas respondem 422 com mensagem explícita e todo o resto do
// produto segue funcionando. Essa é a regra "falha de integração não quebra
// treino manual" na sua forma mais forte — a ausência da integração é um
// estado suportado, não uma avaria.
let cached: ActivityProvider | null = null;
let injected: ActivityProvider | null = null;

export function isStravaConfigured(): boolean {
  return Boolean(injected ?? (env.STRAVA_CLIENT_ID && env.STRAVA_CLIENT_SECRET));
}

export function getActivityProvider(): ActivityProvider {
  if (injected) return injected;
  if (cached) return cached;

  const clientId = env.STRAVA_CLIENT_ID;
  const clientSecret = env.STRAVA_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new BusinessRuleError(
      "Integração com o Strava não está configurada nesta instalação.",
    );
  }

  cached = new StravaProvider(
    clientId,
    clientSecret,
    env.STRAVA_WEBHOOK_VERIFY_TOKEN,
    env.STRAVA_WEBHOOK_SUBSCRIPTION_ID,
  );
  return cached;
}

// Só para os testes: injeta um duplo e descarta o provedor memoizado.
// Passar null restaura o comportamento real.
export function setActivityProviderForTests(provider: ActivityProvider | null): void {
  injected = provider;
  cached = null;
}
