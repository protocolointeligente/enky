import { createCipheriv, createDecipheriv, hkdfSync, randomBytes, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";

// Cifragem simétrica de segredo de terceiro guardado em repouso — hoje, os
// tokens OAuth do Strava (Fase 11, modules/integrations).
//
// Por que cifrar em vez de hashear: um token de sessão da ENKY só precisa ser
// COMPARADO, então basta o hash (server/auth/session.ts). Um token OAuth
// precisa ser APRESENTADO ao Strava — temos de recuperar o valor original.
// Hash não serve; cifra serve.
//
// Por que isso importa: um dump da tabela `ExternalConnection` sem cifra
// entregaria acesso vivo à conta Strava de cada atleta (e o refresh token não
// expira sozinho). Com cifra, o dump sozinho não vale nada — o atacante
// precisa também do AUTH_SECRET, que não está no banco.
//
// AES-256-GCM: cifra AUTENTICADA. Não é só confidencialidade — a tag detecta
// adulteração, então um token trocado no banco falha ao decifrar em vez de ser
// enviado ao provedor.

const ALGORITHM = "aes-256-gcm";
const KEY_BYTES = 32;
const IV_BYTES = 12; // 96 bits — o tamanho recomendado para GCM.
const ENVELOPE_VERSION = "v1";

// Chave derivada do AUTH_SECRET por HKDF, com `info` fixando o propósito. Sem
// a derivação, o mesmo segredo usado para HMAC de sessão viraria chave de
// cifra: reúso de material entre primitivas distintas, exatamente o que HKDF
// existe para evitar.
//
// CONSEQUÊNCIA OPERACIONAL, deliberada: rotacionar AUTH_SECRET torna os tokens
// existentes indecifráveis e cada atleta precisa reconectar o Strava. É o mesmo
// contrato que o .env.example já documenta para sessões e convites ("rotating
// it invalidates every session and every pending invitation at once") — e
// perder acesso a tokens de terceiro num incidente de segredo vazado é o
// comportamento certo, não um efeito colateral a contornar.
let cachedKey: Buffer | null = null;

function encryptionKey(): Buffer {
  if (cachedKey) return cachedKey;
  cachedKey = Buffer.from(
    hkdfSync("sha256", Buffer.from(env.AUTH_SECRET, "utf8"), Buffer.alloc(0), "enky:token-encryption:v1", KEY_BYTES),
  );
  return cachedKey;
}

// Só para os testes: descarta a chave memoizada quando o cenário troca o
// AUTH_SECRET do processo.
export function resetEncryptionKeyCache(): void {
  cachedKey = null;
}

// Envelope: `v1.<iv>.<tag>.<ciphertext>`, tudo base64url. O prefixo de versão
// existe para que trocar de algoritmo depois seja possível sem adivinhar o
// formato do que já está gravado.
export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    ENVELOPE_VERSION,
    iv.toString("base64url"),
    tag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

export class DecryptionError extends Error {}

// Lança DecryptionError em envelope malformado, versão desconhecida, chave
// errada OU tag inválida — nunca devolve texto "quase certo". O chamador
// (modules/integrations/external-connection.ts) trata isso como conexão
// inutilizável e pede reconexão, em vez de mandar lixo ao provedor.
export function decryptSecret(envelope: string): string {
  const [version, ivPart, tagPart, ciphertextPart] = envelope.split(".");
  if (version !== ENVELOPE_VERSION || !ivPart || !tagPart || !ciphertextPart) {
    throw new DecryptionError("Envelope cifrado inválido ou de versão desconhecida.");
  }

  try {
    const decipher = createDecipheriv(ALGORITHM, encryptionKey(), Buffer.from(ivPart, "base64url"));
    decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertextPart, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch (cause) {
    // A mensagem original do OpenSSL não agrega e o valor NUNCA é logado.
    throw new DecryptionError("Não foi possível decifrar o segredo armazenado.", { cause });
  }
}

// Comparação de segredo compartilhado em tempo constante — o `hub.verify_token`
// do handshake do Strava (Fase 11) e o `asaas-access-token` do webhook de
// pagamento (Fase 10) passam por aqui. Vive neste arquivo, e não em cada
// adapter, porque é primitiva de segurança: duas cópias divergem em silêncio, e
// a que ficar para trás não avisa ninguém.
export function equalsSecret(received: string | null | undefined, expected: string): boolean {
  if (!received || !expected) return false;
  const a = Buffer.from(received, "utf8");
  const b = Buffer.from(expected, "utf8");
  // timingSafeEqual exige buffers do mesmo tamanho — comparar o tamanho antes
  // vaza apenas o comprimento do segredo, não seu conteúdo.
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
