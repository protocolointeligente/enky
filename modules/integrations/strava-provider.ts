import { ExternalServiceError } from "@/domain/errors";
import { logger } from "@/server/observability/logger";
import { equalsSecret } from "@/server/security/crypto";
import {
  ProviderAuthorizationError,
  type ActivityProvider,
  type ActivityWebhookEvent,
  type ActivityEventType,
  type NormalizedActivity,
  type OAuthTokens,
} from "./activity-provider";
import { normalizeStravaActivity, type StravaActivityPayload } from "./strava-normalize";

// Adapter do Strava (https://developers.strava.com). REST com `fetch`, sem
// SDK — mesma razão do adapter do Asaas: a superfície que usamos é de cinco
// endpoints, e um SDK a mais é uma dependência a mais para auditar numa área
// que manipula token de terceiro.
//
// Particularidades do Strava que o resto do código não precisa saber:
//
//  1. TOKEN CURTO: o access token vale ~6h. Todo uso passa por
//     `withFreshAccessToken` (external-connection.ts), nunca por leitura
//     direta da coluna.
//
//  2. REFRESH ROTATIVO: o Strava pode devolver um refresh token NOVO na
//     renovação. Guardar só o access e manter o refresh velho quebraria a
//     conexão silenciosamente na renovação seguinte — por isso
//     `refreshTokens` sempre devolve o par completo e o chamador sempre
//     grava os dois.
//
//  3. WEBHOOK SEM ASSINATURA: ver `parseWebhookEvent`.
//
//  4. ESCOPO: `activity:read` basta para atividade pública/de seguidores;
//     `activity:read_all` inclui as privadas. Pedimos o segundo — um atleta
//     que marca treino como privado é comum, e sem isso a importação teria
//     buracos que ninguém consegue explicar.

const OAUTH_BASE_URL = "https://www.strava.com/oauth";
const API_BASE_URL = "https://www.strava.com/api/v3";
const REQUIRED_SCOPE = "activity:read_all";

const EVENT_TYPE_MAP: Record<string, ActivityEventType> = {
  create: "ACTIVITY_CREATED",
  update: "ACTIVITY_UPDATED",
  delete: "ACTIVITY_DELETED",
};

interface StravaTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_at?: number; // epoch em SEGUNDOS
  scope?: string;
  athlete?: { id?: number | string };
}

interface StravaWebhookBody {
  object_type?: string;
  object_id?: number | string;
  aspect_type?: string;
  owner_id?: number | string;
  subscription_id?: number | string;
  event_time?: number; // epoch em segundos
}

export class StravaProvider implements ActivityProvider {
  readonly name = "strava";
  readonly providerEnum = "STRAVA" as const;

  constructor(
    private readonly clientId: string,
    private readonly clientSecret: string,
    private readonly webhookVerifyToken?: string,
    private readonly webhookSubscriptionId?: string,
  ) {}

  buildAuthorizationUrl(state: string, redirectUri: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      // `force` e não `auto`: o atleta vê a tela de permissão mesmo se já
      // autorizou antes. Reconectar tem de ser um ato consciente, e é o que
      // permite corrigir um escopo negado na primeira vez.
      approval_prompt: "force",
      scope: REQUIRED_SCOPE,
      state,
    });
    return `${OAUTH_BASE_URL}/authorize?${params.toString()}`;
  }

  // Nenhuma resposta de erro do Strava é ecoada para o cliente e nenhum corpo
  // de token vai para o log: o corpo de `/oauth/token` É o segredo.
  private async requestTokens(body: Record<string, string>): Promise<OAuthTokens> {
    let response: Response;
    try {
      response = await fetch(`${OAUTH_BASE_URL}/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: this.clientId,
          client_secret: this.clientSecret,
          ...body,
        }),
        cache: "no-store",
      });
    } catch (cause) {
      throw new ExternalServiceError("Não foi possível falar com o Strava.", cause);
    }

    if (!response.ok) {
      // 400/401 aqui significa credencial recusada — code expirado/já usado, ou
      // autorização revogada pelo atleta no site do Strava. É condição de
      // negócio ("reconecte"), não indisponibilidade.
      if (response.status === 400 || response.status === 401) {
        throw new ProviderAuthorizationError("Autorização do Strava inválida ou expirada.");
      }
      throw new ExternalServiceError(`Strava respondeu HTTP ${response.status}.`);
    }

    const payload = (await response.json()) as StravaTokenResponse;
    if (!payload.access_token || !payload.refresh_token || !payload.expires_at) {
      throw new ExternalServiceError("Resposta de token do Strava incompleta.");
    }

    const providerAthleteId = payload.athlete?.id !== undefined ? String(payload.athlete.id) : "";

    return {
      accessToken: payload.access_token,
      refreshToken: payload.refresh_token,
      expiresAt: new Date(payload.expires_at * 1000),
      scope: payload.scope ?? null,
      providerAthleteId,
    };
  }

  async exchangeCode(code: string, redirectUri: string): Promise<OAuthTokens> {
    const tokens = await this.requestTokens({
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    });

    // Só a troca do code traz o `athlete` — a renovação não. Sem o id do dono
    // não há como resolver webhook nem provar posse da atividade depois.
    if (!tokens.providerAthleteId) {
      throw new ExternalServiceError("Strava não informou o atleta dono do token.");
    }
    return tokens;
  }

  async refreshTokens(refreshToken: string): Promise<OAuthTokens> {
    return this.requestTokens({ refresh_token: refreshToken, grant_type: "refresh_token" });
  }

  private async apiGet(accessToken: string, path: string): Promise<unknown | null> {
    let response: Response;
    try {
      response = await fetch(`${API_BASE_URL}${path}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      });
    } catch (cause) {
      throw new ExternalServiceError("Não foi possível falar com o Strava.", cause);
    }

    if (response.status === 401) {
      throw new ProviderAuthorizationError("Token do Strava recusado.");
    }
    // 404 é normal: a atividade foi apagada entre o evento e a busca.
    if (response.status === 404) return null;
    if (response.status === 429) {
      // O Strava limita a 100 req/15min e 1000/dia por aplicação. Não é erro
      // nosso nem do atleta — é sinal de recuar, e a importação manual pode
      // ser refeita depois.
      throw new ExternalServiceError("Limite de requisições do Strava atingido. Tente mais tarde.");
    }
    if (!response.ok) {
      throw new ExternalServiceError(`Strava respondeu HTTP ${response.status}.`);
    }

    return response.json();
  }

  async listActivities(
    accessToken: string,
    after: Date,
    limit: number,
  ): Promise<NormalizedActivity[]> {
    const params = new URLSearchParams({
      after: String(Math.floor(after.getTime() / 1000)),
      per_page: String(Math.min(limit, 100)), // 100 é o teto do Strava.
    });

    const payload = await this.apiGet(accessToken, `/athlete/activities?${params.toString()}`);
    if (!Array.isArray(payload)) return [];

    // O resumo de `/athlete/activities` NÃO traz `athlete.id` em todas as
    // versões da API — mas o endpoint é autenticado pelo token do próprio
    // dono, então a posse já está provada pelo Bearer. Preenchemos o dono a
    // partir do que veio, e o chamador confere contra a conexão.
    const activities: NormalizedActivity[] = [];
    for (const item of payload) {
      try {
        activities.push(normalizeStravaActivity(item as StravaActivityPayload));
      } catch (error) {
        // Uma atividade malformada não pode derrubar a importação inteira das
        // outras 29. Registra o id e segue — sem o corpo, que tem dado de
        // localização do atleta.
        logger.warn(
          { activityId: (item as StravaActivityPayload)?.id, err: error },
          "atividade do Strava ignorada por payload inválido",
        );
      }
    }
    return activities;
  }

  async getActivity(
    accessToken: string,
    providerActivityId: string,
  ): Promise<NormalizedActivity | null> {
    const payload = await this.apiGet(accessToken, `/activities/${providerActivityId}`);
    if (!payload) return null;
    return normalizeStravaActivity(payload as StravaActivityPayload);
  }

  async deauthorize(accessToken: string): Promise<void> {
    let response: Response;
    try {
      response = await fetch(`${OAUTH_BASE_URL}/deauthorize`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      });
    } catch (cause) {
      throw new ExternalServiceError("Não foi possível falar com o Strava.", cause);
    }
    if (!response.ok && response.status !== 401) {
      throw new ExternalServiceError(`Strava respondeu HTTP ${response.status} ao revogar.`);
    }
    // 401 = o token já não vale (o atleta revogou pelo site do Strava). O
    // objetivo — o acesso não existir mais — já está cumprido.
  }

  // Handshake de criação da inscrição (GET). É o ÚNICO ponto em que o Strava
  // prova que o endpoint é nosso, e o `hub.verify_token` é um segredo que só
  // nós e ele conhecemos.
  verifySubscription(
    mode: string | null,
    verifyToken: string | null,
    challenge: string | null,
  ): string | null {
    if (mode !== "subscribe" || !challenge) return null;
    if (!this.webhookVerifyToken) return null;
    if (!equalsSecret(verifyToken, this.webhookVerifyToken)) return null;
    return challenge;
  }

  // POST de evento.
  //
  // FATO INCÔMODO, e a decisão de segurança que ele força: o Strava NÃO assina
  // o corpo do webhook. Não há HMAC, não há segredo no header — o
  // `hub.verify_token` só participa do handshake acima. Qualquer um que
  // descubra a URL pode POSTar um evento sintético.
  //
  // Por isso este método NÃO extrai dado de atividade do corpo, e o serviço
  // (strava-webhook-service.ts) trata o evento como um mero AVISO: "vá olhar a
  // atividade X do atleta Y". O dado é então buscado na API do Strava com o
  // NOSSO token, e só é gravado se o Strava confirmar que a atividade existe e
  // pertence àquele atleta. O pior que um POST forjado consegue é nos fazer
  // gastar uma chamada de API buscando algo que não existe — não consegue
  // injetar uma única linha de dado falso.
  parseWebhookEvent(rawBody: string): ActivityWebhookEvent | null {
    let body: StravaWebhookBody;
    try {
      body = JSON.parse(rawBody) as StravaWebhookBody;
    } catch {
      return null;
    }

    // Eventos de `athlete` (ex.: o atleta revogou o acesso pelo site do
    // Strava) chegam neste mesmo endpoint. v1 não os consome: a revogação é
    // detectada de qualquer forma na próxima renovação de token, que falha com
    // ProviderAuthorizationError e marca a conexão. Descartar é honesto;
    // processar pela metade não seria.
    if (body.object_type !== "activity") return null;

    const type = EVENT_TYPE_MAP[body.aspect_type ?? ""];
    if (!type) return null;

    const providerActivityId = body.object_id !== undefined ? String(body.object_id) : "";
    const providerAthleteId = body.owner_id !== undefined ? String(body.owner_id) : "";
    if (!providerActivityId || !providerAthleteId) return null;

    // Descarta evento de outra inscrição quando sabemos qual é a nossa. Não é
    // autenticação (o campo é forjável como o resto do corpo) — é higiene: o
    // mesmo aplicativo Strava serve preview e produção, e um evento da
    // inscrição do outro ambiente não é nosso para processar.
    if (
      this.webhookSubscriptionId &&
      body.subscription_id !== undefined &&
      String(body.subscription_id) !== this.webhookSubscriptionId
    ) {
      return null;
    }

    return {
      // O Strava não manda id de evento — compomos a chave de idempotência.
      //
      // `event_time` faz parte dela por um motivo específico: sem ele, a chave
      // seria `atividade:aspecto`, e a SEGUNDA edição legítima de uma mesma
      // atividade (o atleta corrige o título, depois o tipo) colidiria com a
      // primeira e seria descartada como "duplicada" — a correção nunca
      // chegaria. Com `event_time`, uma reentrega da MESMA entrega mantém a
      // chave (dedupa, que é o que queremos) e duas edições distintas têm
      // chaves distintas (ambas processadas).
      eventId: `${providerActivityId}:${body.aspect_type}:${body.event_time ?? 0}`,
      type,
      providerActivityId,
      providerAthleteId,
      rawType: `activity.${body.aspect_type}`,
    };
  }
}
