import { prisma } from "@/infrastructure/database/prisma";
import { AuthenticationError, ValidationError } from "@/domain/errors";
import { hashPassword } from "@/server/auth/password";
import { passwordSchema } from "./password-policy";
import { parsePasswordResetToken, verifyPasswordResetToken } from "./password-reset-token";

// Confirms a reset: validates the new password against the policy, verifies the
// stateless token against the user's CURRENT password hash, then rotates the
// hash and revokes all existing sessions (a password change should log every
// device out). Token and user-not-found both surface the same generic error so
// nothing about validity leaks.
export async function resetPassword(
  token: string,
  newPassword: string,
  now: number,
): Promise<void> {
  const parsedPassword = passwordSchema.safeParse(newPassword);
  if (!parsedPassword.success) {
    throw new ValidationError(parsedPassword.error.issues[0]?.message ?? "Senha inválida.");
  }

  const parsed = parsePasswordResetToken(token);
  if (!parsed) {
    throw new AuthenticationError("Link de redefinição inválido ou expirado.");
  }

  const user = await prisma.user.findUnique({
    where: { id: parsed.userId },
    select: { id: true, passwordHash: true },
  });
  if (!user || !user.passwordHash || !verifyPasswordResetToken(parsed, user.passwordHash, now)) {
    throw new AuthenticationError("Link de redefinição inválido ou expirado.");
  }

  const passwordHash = await hashPassword(newPassword);
  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { passwordHash } }),
    prisma.session.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date(now) },
    }),
  ]);
}
