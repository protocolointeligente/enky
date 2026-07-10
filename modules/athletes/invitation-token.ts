import { createHmac, randomBytes } from "node:crypto";
import { env } from "@/lib/env";

export const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias

export function generateInvitationToken(): string {
  return randomBytes(32).toString("base64url");
}

// Same HMAC-pepper pattern as server/auth/session.ts — only the hash is
// ever persisted, the raw token exists solely in the response/e-mail.
export function hashInvitationToken(token: string): string {
  return createHmac("sha256", env.AUTH_SECRET).update(token).digest("base64url");
}
