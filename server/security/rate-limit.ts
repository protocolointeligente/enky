import { ExternalServiceError, RateLimitError } from "@/domain/errors";

export interface RateLimitResult {
  allowed: boolean;
  retryAfterMs: number;
}

export interface RateLimiter {
  consume(key: string): Promise<RateLimitResult>;
}

interface Bucket {
  count: number;
  resetAt: number;
}

// In-memory fixed-window limiter. Safe for local development and
// single-instance deployments ONLY — state lives in process memory, resets
// on redeploy, and does not coordinate across multiple server instances.
// Production uses UpstashRateLimiter (shared store); this is the dev/test
// fallback only (see `createRateLimiter`).
export class InMemoryRateLimiter implements RateLimiter {
  private readonly buckets = new Map<string, Bucket>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  async consume(key: string): Promise<RateLimitResult> {
    const now = Date.now();
    const bucket = this.buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + this.windowMs });
      return { allowed: true, retryAfterMs: 0 };
    }

    if (bucket.count >= this.limit) {
      return { allowed: false, retryAfterMs: bucket.resetAt - now };
    }

    bucket.count += 1;
    return { allowed: true, retryAfterMs: 0 };
  }
}

// Distributed fixed-window limiter backed by Upstash Redis over its REST API.
// HTTP-based (no persistent socket) → fits Vercel's serverless runtime, and
// the count is shared across every instance, so limits hold under horizontal
// scaling and survive redeploys. Same `RateLimiter` interface — swapping this
// in for InMemory requires no change in any caller.
//
// Fixed window via a single pipelined round-trip:
//   INCR key                      → hits in the current window (1 on the first)
//   PEXPIRE key <windowMs> NX     → set the window TTL only on the first hit
//   PTTL key                      → remaining ms, for retryAfter when blocked
export class UpstashRateLimiter implements RateLimiter {
  constructor(
    private readonly url: string,
    private readonly token: string,
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  async consume(key: string): Promise<RateLimitResult> {
    const redisKey = `enky:rl:${key}`;
    let response: Response;
    try {
      response = await fetch(`${this.url}/pipeline`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify([
          ["INCR", redisKey],
          ["PEXPIRE", redisKey, String(this.windowMs), "NX"],
          ["PTTL", redisKey],
        ]),
        cache: "no-store",
      });
    } catch (cause) {
      // Fail-closed: sem contagem confiável não liberamos a requisição — do
      // contrário uma indisponibilidade do store abriria brute-force livre.
      throw new ExternalServiceError("Serviço de rate limit indisponível.", cause);
    }

    if (!response.ok) {
      throw new ExternalServiceError(`Serviço de rate limit respondeu HTTP ${response.status}.`);
    }

    const results = (await response.json()) as Array<{ result?: unknown; error?: string }>;
    const incr = results[0];
    if (incr?.error) {
      throw new ExternalServiceError(`Serviço de rate limit retornou erro: ${incr.error}.`);
    }

    const count = Number(incr?.result ?? 0);
    const ttl = Number(results[2]?.result ?? this.windowMs);

    if (count > this.limit) {
      return { allowed: false, retryAfterMs: ttl > 0 ? ttl : this.windowMs };
    }
    return { allowed: true, retryAfterMs: 0 };
  }
}

// Produção sem store distribuído configurado. Degrada para memória em vez de
// barrar: a versão anterior era fail-closed (lançava), e o resultado prático foi
// login 100% fora do ar por uma variável de ambiente errada. Trocar toda a
// autenticação por uma proteção de brute-force é o pior dos dois mundos.
//
// O que se perde: a contagem passa a ser POR INSTÂNCIA (várias instâncias
// multiplicam o limite efetivo) e um redeploy zera as janelas. Ainda segura o
// ataque óbvio de uma origem só, e é muito melhor que ninguém entrar.
// Não é silencioso: grita no log na primeira vez que é usado.
class DegradedInMemoryRateLimiter extends InMemoryRateLimiter {
  private warned = false;

  async consume(key: string): Promise<RateLimitResult> {
    if (!this.warned) {
      this.warned = true;
      // console, não o logger: o logger toca `env`, e este arquivo já derrubou
      // produção uma vez por acoplar rate limit à validação global de ambiente.
      console.error(
        "[rate-limit] DEGRADADO — produção sem UPSTASH_REDIS_REST_URL/TOKEN válidos. " +
          "Contagem por instância, não global. Configure o Upstash e faça redeploy " +
          "(variável nova só vale em deployment novo).",
      );
    }
    return super.consume(key);
  }
}

// Escolhe o backend uma vez, no carregamento do módulo. Lê `process.env`
// diretamente (não o proxy `env`) para não disparar a validação completa de
// ambiente durante o build do Next — mesmo padrão de lib/env.ts.
// A URL é validada AQUI, e não no schema de `lib/env`: lá a validação é global
// e um valor malformado derruba toda rota que toca `env` (foi o que aconteceu
// — /api/health e /api/auth/session caíram por causa de uma config de rate
// limit). Aqui o raio da falha é o rate limit, que é de quem o valor é.
function restUrl(raw: string | undefined): string | null {
  if (!raw) return null;
  const value = raw.trim().replace(/\/+$/, "");
  // Precisa ser a REST URL (https://...upstash.io) do console, não a connection
  // string redis://: o adapter fala HTTP, não o protocolo do Redis.
  if (!/^https:\/\//i.test(value)) return null;
  try {
    new URL(value);
    return value;
  } catch {
    return null;
  }
}

export function createRateLimiter(limit: number, windowMs: number): RateLimiter {
  const url = restUrl(process.env.UPSTASH_REDIS_REST_URL);
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (url && token) return new UpstashRateLimiter(url, token, limit, windowMs);
  if (process.env.NODE_ENV === "production") return new DegradedInMemoryRateLimiter(limit, windowMs);
  return new InMemoryRateLimiter(limit, windowMs);
}

export async function enforceRateLimit(limiter: RateLimiter, key: string): Promise<void> {
  const result = await limiter.consume(key);
  if (!result.allowed) {
    throw new RateLimitError("Muitas tentativas. Tente novamente mais tarde.", result.retryAfterMs);
  }
}

// Pre-configured limiters for the identity/invitation/write flows. Keyed by the
// caller (route handler) using IP for anonymous endpoints and normalized
// email / user id for account-specific brute-force protection. Upstash in
// production, in-memory in development/test (see createRateLimiter).
export const registerRateLimiter = createRateLimiter(5, 60 * 60 * 1000); // 5/hora por IP
export const loginRateLimiter = createRateLimiter(10, 5 * 60 * 1000); // 10/5min por e-mail
export const inviteRateLimiter = createRateLimiter(20, 60 * 60 * 1000); // 20/hora por treinador
export const resendInvitationRateLimiter = createRateLimiter(5, 60 * 60 * 1000); // 5/hora por convite
export const revokeInvitationRateLimiter = createRateLimiter(30, 60 * 60 * 1000); // 30/hora por treinador
export const activateInvitationRateLimiter = createRateLimiter(10, 15 * 60 * 1000); // 10/15min por IP
export const passwordResetRateLimiter = createRateLimiter(5, 60 * 60 * 1000); // 5/hora por IP
export const workoutWriteRateLimiter = createRateLimiter(60, 60 * 60 * 1000); // 60/hora por treinador
export const feedbackWriteRateLimiter = createRateLimiter(30, 60 * 60 * 1000); // 30/hora por atleta
export const executionWriteRateLimiter = createRateLimiter(240, 60 * 60 * 1000); // 240/hora por atleta (start + lotes de eventos, inclui sync offline)
export const libraryWriteRateLimiter = createRateLimiter(120, 60 * 60 * 1000); // 120/hora por treinador (exercícios + templates)
export const intelligenceWriteRateLimiter = createRateLimiter(120, 60 * 60 * 1000); // 120/hora por treinador (aceitar/ignorar insight)
export const readinessWriteRateLimiter = createRateLimiter(30, 60 * 60 * 1000); // 30/hora por atleta (check-in de prontidão)
export const reportWriteRateLimiter = createRateLimiter(60, 60 * 60 * 1000); // 60/hora por treinador (gerar/compartilhar relatório)
export const periodizationWriteRateLimiter = createRateLimiter(60, 60 * 60 * 1000); // 60/hora por treinador (criar/excluir periodização)
export const assessmentWriteRateLimiter = createRateLimiter(60, 60 * 60 * 1000); // 60/hora por treinador (criar/editar/validar avaliação)
export const billingWriteRateLimiter = createRateLimiter(10, 60 * 60 * 1000); // 10/hora por treinador (checkout/cancelamento)
export const crmWriteRateLimiter = createRateLimiter(240, 60 * 60 * 1000); // 240/hora por usuário (leads + interações — trabalho de digitação em lote)
// Fase 11 — Integração Strava.
// Conectar/desconectar: 10/hora por atleta. É ato raro e cada tentativa dispara
// um handshake OAuth com um terceiro.
export const integrationWriteRateLimiter = createRateLimiter(10, 60 * 60 * 1000);
// Importação manual: 6/hora por atleta. Baixo porque cada clique gasta cota da
// API do Strava (100 req/15min por APLICAÇÃO, compartilhada entre TODOS os
// atletas): um atleta clicando sem parar deixaria os outros sem importação.
export const activityImportRateLimiter = createRateLimiter(6, 60 * 60 * 1000);
// Webhook do gateway, por IP. Teto ALTO de propósito: o limitador aqui é
// anti-flood, não controle de acesso — quem autentica o webhook é o segredo
// verificado pelo adapter. Apertar isso derrubaria confirmação de pagamento
// legítima em pico de cobrança (o Asaas enfileira e dispara em lote), e um
// evento recusado com 429 é reenviado, não perdido — mas atrasa a liberação
// do plano de quem pagou.
export const webhookRateLimiter = createRateLimiter(600, 60 * 1000); // 600/min por IP
// 30/hora por admin (bloquear usuário, suspender organização). Baixo de
// propósito: são ações raras e de alto impacto — uma rajada aqui é engano ou
// conta comprometida, nunca uso normal.
export const adminWriteRateLimiter = createRateLimiter(30, 60 * 60 * 1000);
