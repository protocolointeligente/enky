import { z } from "zod";
import { AuthenticationError } from "@/domain/errors";
import { prisma } from "@/infrastructure/database/prisma";
import { verifyPassword } from "@/server/auth/password";
import { createSession } from "@/server/auth/session";
import { normalizeEmail } from "./normalize-email";

export const loginInputSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

export type LoginInput = z.infer<typeof loginInputSchema>;

export interface LoginContext {
  ipAddress?: string;
  userAgent?: string;
}

export interface LoginResult {
  userId: string;
  sessionToken: string;
  sessionExpiresAt: Date;
}

const GENERIC_INVALID_CREDENTIALS = "E-mail ou senha inválidos.";

// A syntactically valid bcrypt hash that never matches any real password —
// compared against on every "account not found" path so the response
// timing doesn't leak account existence via an early return.
const DUMMY_HASH = "$2a$12$CwTycUXWue0Thq9StjUM0uJ8kQwLNfcyaVJvNa4o3iwGnl.OYPCse";

export async function login(input: LoginInput, context: LoginContext = {}): Promise<LoginResult> {
  const email = normalizeEmail(input.email);

  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
  });

  if (!user || !user.passwordHash || !user.isActive) {
    await verifyPassword(input.password, DUMMY_HASH);
    throw new AuthenticationError(GENERIC_INVALID_CREDENTIALS);
  }

  const passwordValid = await verifyPassword(input.password, user.passwordHash);
  if (!passwordValid) {
    throw new AuthenticationError(GENERIC_INVALID_CREDENTIALS);
  }

  const session = await createSession({
    userId: user.id,
    userAgent: context.userAgent,
    ipAddress: context.ipAddress,
  });

  await prisma.auditLog.create({
    data: {
      action: "LOGIN_SUCCESS",
      entityName: "User",
      entityId: user.id,
      userId: user.id,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      actorType: "USER",
    },
  });

  return { userId: user.id, sessionToken: session.token, sessionExpiresAt: session.expiresAt };
}
