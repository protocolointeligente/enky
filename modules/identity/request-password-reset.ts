import { prisma } from "@/infrastructure/database/prisma";
import { normalizeEmail } from "./normalize-email";
import { createPasswordResetToken, PASSWORD_RESET_TTL_MS } from "./password-reset-token";

export interface PasswordResetRequest {
  email: string;
  userName: string;
  token: string;
  expiresAt: Date;
}

// Returns null when no account matches. The ROUTE must always answer
// generically regardless, so e-mail existence is never disclosed (anti-
// enumeration). The token is bound to the user's current password hash.
export async function requestPasswordReset(
  rawEmail: string,
  now: number,
): Promise<PasswordResetRequest | null> {
  const email = normalizeEmail(rawEmail);
  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true, email: true, name: true, passwordHash: true },
  });
  // No account, or an account that never set a password (invited but not yet
  // activated) — nothing to reset. The route answers generically either way.
  if (!user || !user.passwordHash) return null;

  return {
    email: user.email,
    userName: user.name,
    token: createPasswordResetToken(user.id, user.passwordHash, now),
    expiresAt: new Date(now + PASSWORD_RESET_TTL_MS),
  };
}
