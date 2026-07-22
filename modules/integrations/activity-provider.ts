import type { Modality } from "@prisma/client";

// Fronteira entre o domínio de treino e o provedor de atividades externas.
//
// Mesma razão de existir do `PaymentProvider` (Fase 10): o provedor escolhido
// é o Strava, mas nenhuma regra de negócio o conhece. Quem importa, deduplica,
// normaliza e vincula fala o vocabulário desta interface. Um segundo provedor
// (Garmin, Polar) é um adapter novo — nenhum serviço, rota ou tela muda.
//
// A ENKY nunca guarda credencial do atleta no provedor: o OAuth acontece no
// site do provedor e o que volta é um token, guardado cifrado
// (server/security/crypto.ts).

// Atividade JÁ NORMALIZADA para o vocabulário da ENKY. Um adapter só produz
// isto; o serviço de importação nunca vê o JSON cru do provedor.
export interface NormalizedActivity {
  // Id da atividade no provedor. É a chave de deduplicação — o mesmo id chega
  // pelo webhook e pela importação manual.
  providerActivityId: string;
  // Id do dono no provedor. Confrontado com o `providerAthleteId` da conexão
  // antes de qualquer escrita: sem isso, um provedor confuso (ou um webhook
  // forjado) poderia enxertar atividade de um estranho no histórico do atleta.
  providerAthleteId: string;
  name: string | null;
  // Tipo cru do provedor, preservado sempre — é o que permite reprocessar o
  // mapeamento depois sem reimportar.
  rawType: string;
  // Nulo quando `rawType` não mapeia para nenhuma Modality da ENKY.
  modality: Modality | null;
  startedAt: Date;
  // Data CIVIL onde a atividade aconteceu, "YYYY-MM-DD". Vem do provedor —
  // nunca derivada do fuso do servidor (diretriz temporal do schema §5).
  localDate: string;
  timezone: string | null;
  distanceMeters: number | null;
  movingSeconds: number | null;
  elapsedSeconds: number | null;
  elevationGainMeters: number | null;
  // s/km. Nulo quando não há distância ou duração para derivá-lo.
  paceSecondsPerKm: number | null;
}

export interface OAuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  scope: string | null;
  providerAthleteId: string;
}

// Evento de webhook JÁ VALIDADO e traduzido. Repare no que ele NÃO carrega:
// dado de atividade. O evento do Strava só diz "a atividade X do atleta Y
// mudou" — o dado é buscado na API com o nosso token. Ver
// strava-webhook-service.ts para por que isso é uma decisão de segurança, e
// não um detalhe do formato deles.
export type ActivityEventType = "ACTIVITY_CREATED" | "ACTIVITY_UPDATED" | "ACTIVITY_DELETED";

export interface ActivityWebhookEvent {
  // Chave de idempotência. O Strava não manda id de evento — o adapter compõe
  // uma chave estável a partir do que o evento tem.
  eventId: string;
  type: ActivityEventType;
  providerActivityId: string;
  providerAthleteId: string;
  rawType: string;
}

export class ProviderAuthorizationError extends Error {}

export interface ActivityProvider {
  readonly name: string;
  // Valor gravado em `ExternalConnection.provider`.
  readonly providerEnum: "STRAVA";

  // URL para onde o navegador do atleta é enviado. `state` é opaco para o
  // adapter — quem o assina e confere é oauth-state.ts.
  buildAuthorizationUrl(state: string, redirectUri: string): string;

  exchangeCode(code: string, redirectUri: string): Promise<OAuthTokens>;

  refreshTokens(refreshToken: string): Promise<OAuthTokens>;

  // Atividades recentes do dono do token, já normalizadas.
  listActivities(accessToken: string, after: Date, limit: number): Promise<NormalizedActivity[]>;

  // Uma atividade específica — o caminho do webhook. Retorna null quando o
  // provedor não a tem mais (apagada entre o evento e a busca), que é uma
  // condição normal, não um erro.
  getActivity(accessToken: string, providerActivityId: string): Promise<NormalizedActivity | null>;

  // Revoga o token no PROVEDOR. Best-effort por natureza: se o atleta já
  // revogou pelo site do Strava, isto falha — e a desconexão local acontece
  // do mesmo jeito (ver disconnect em external-connection.ts).
  deauthorize(accessToken: string): Promise<void>;

  // Handshake de criação da inscrição de webhook: valida o `hub.verify_token`
  // e devolve o desafio a ecoar. Retorna null quando o token não confere — o
  // chamador responde 403 sem pista de por quê.
  verifySubscription(mode: string | null, verifyToken: string | null, challenge: string | null): string | null;

  // Valida e traduz um POST de evento. Retorna null para evento irrelevante
  // (objeto que não é atividade, inscrição desconhecida) — que é descartado,
  // não é erro.
  parseWebhookEvent(rawBody: string): ActivityWebhookEvent | null;
}
