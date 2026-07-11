import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";

export const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000; // 1 hora

// Stateless password-reset token — no DB row, no migration. It is signed with
// AUTH_SECRET and BOUND to the user's current password hash, so the moment the
// password changes the signature stops verifying: the link becomes single-use
// in practice (and every previously-issued link dies too). Format:
//   base64url(userId) . expiryMs . base64url(HMAC(userId.expiry.passwordHash))
function sign(userId: string, expiry: number, passwordHash: string): string {
  return createHmac("sha256", env.AUTH_SECRET)
    .update(`${userId}.${expiry}.${passwordHash}`)
    .digest("base64url");
}

export function createPasswordResetToken(
  userId: string,
  passwordHash: string,
  now: number,
): string {
  const expiry = now + PASSWORD_RESET_TTL_MS;
  const signature = sign(userId, expiry, passwordHash);
  const encodedUserId = Buffer.from(userId, "utf8").toString("base64url");
  return `${encodedUserId}.${expiry}.${signature}`;
}

export interface ParsedResetToken {
  userId: string;
  expiry: number;
  signature: string;
}

export function parsePasswordResetToken(token: string): ParsedResetToken | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [encodedUserId, expiryRaw, signature] = parts;
  if (!encodedUserId || !expiryRaw || !signature) return null;
  const expiry = Number(expiryRaw);
  if (!Number.isFinite(expiry)) return null;
  let userId: string;
  try {
    userId = Buffer.from(encodedUserId, "base64url").toString("utf8");
  } catch {
    return null;
  }
  if (userId === "") return null;
  return { userId, expiry, signature };
}

export function verifyPasswordResetToken(
  parsed: ParsedResetToken,
  passwordHash: string,
  now: number,
): boolean {
  if (parsed.expiry < now) return false;
  const expected = sign(parsed.userId, parsed.expiry, passwordHash);
  const provided = Buffer.from(parsed.signature);
  const expectedBuf = Buffer.from(expected);
  return provided.length === expectedBuf.length && timingSafeEqual(provided, expectedBuf);
}
