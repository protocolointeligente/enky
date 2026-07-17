import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";

// O parâmetro `state` do OAuth: a defesa contra CSRF do handshake.
//
// O ATAQUE que isto impede (é concreto, não teórico): o atacante inicia o
// OAuth com a PRÓPRIA conta Strava, intercepta o `code` do callback e induz a
// vítima logada na ENKY a abrir `/callback?code=<code-do-atacante>`. Sem
// `state`, a ENKY trocaria aquele code e ligaria a conta Strava DO ATACANTE ao
// atleta vítima — que passaria a ter as atividades de um estranho importadas
// como suas, e a receber prescrição corrigida por elas.
//
// A defesa: `state` é assinado por nós e AMARRADO ao usuário que iniciou o
// fluxo. No callback, o state precisa (a) ter assinatura válida, (b) não estar
// expirado e (c) pertencer ao MESMO usuário da sessão atual. O state do
// atacante falha em (c).
//
// Por que HMAC assinado e não uma linha no banco/cookie: o state é
// efêmero, de uso único dentro de minutos, e a sessão da ENKY já é a
// autoridade sobre quem é o usuário. Uma tabela de states pendentes seria
// mais uma coisa a expirar e limpar para ganhar nada — o `nonce` já dá
// unicidade e o `issuedAt` já dá validade. (Não há proteção a replay dentro
// da janela: o mesmo `code` do Strava só é trocável uma vez, então repetir o
// state com o code queimado falha na troca.)

const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutos — o usuário está no fluxo agora.

export interface OAuthStatePayload {
  userId: string;
  issuedAt: number;
  nonce: string;
}

function sign(body: string): string {
  return createHmac("sha256", env.AUTH_SECRET).update(body).digest("base64url");
}

export function createOAuthState(userId: string, now: Date = new Date()): string {
  const payload: OAuthStatePayload = {
    userId,
    issuedAt: now.getTime(),
    nonce: randomBytes(16).toString("base64url"),
  };
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${body}.${sign(body)}`;
}

// Devolve o payload quando o state é íntegro e vigente; null em qualquer outro
// caso. Nunca lança: um state inválido é entrada hostil esperada, não uma
// exceção do sistema.
export function verifyOAuthState(state: string | null, now: Date = new Date()): OAuthStatePayload | null {
  if (!state) return null;

  const separator = state.lastIndexOf(".");
  if (separator <= 0) return null;

  const body = state.slice(0, separator);
  const signature = state.slice(separator + 1);

  const expected = Buffer.from(sign(body), "utf8");
  const received = Buffer.from(signature, "utf8");
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;

  let payload: OAuthStatePayload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as OAuthStatePayload;
  } catch {
    return null;
  }

  if (typeof payload.userId !== "string" || typeof payload.issuedAt !== "number") return null;
  // Expirado, ou emitido "no futuro" (relógio adulterado / payload forjado com
  // assinatura de outro ambiente).
  const age = now.getTime() - payload.issuedAt;
  if (age < 0 || age > STATE_TTL_MS) return null;

  return payload;
}
