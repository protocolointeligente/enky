import { cookies } from "next/headers";
import type { Role } from "@prisma/client";
import { AuthenticationError, AuthorizationError } from "@/domain/errors";
import { prisma } from "@/infrastructure/database/prisma";
import { SESSION_COOKIE_NAME, verifySessionByToken } from "@/server/auth/session";

export interface CurrentIdentity {
  userId: string;
  email: string;
  name: string;
  globalRole: Role;
}

// Role is always read live from the database, never cached in the session
// token — a demoted/deactivated user loses access on their very next
// request, not only after the session expires.
export async function getCurrentIdentity(): Promise<CurrentIdentity | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const session = await verifySessionByToken(token);
  if (!session) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, email: true, name: true, globalRole: true, isActive: true },
  });

  if (!user || !user.isActive) return null;

  return { userId: user.id, email: user.email, name: user.name, globalRole: user.globalRole };
}

export async function requireIdentity(): Promise<CurrentIdentity> {
  const identity = await getCurrentIdentity();
  if (!identity) {
    throw new AuthenticationError("Sessão ausente, expirada ou revogada.");
  }
  return identity;
}

export function requireRole(identity: CurrentIdentity, allowedRoles: readonly Role[]): void {
  if (!allowedRoles.includes(identity.globalRole)) {
    throw new AuthorizationError("Papel do usuário não autorizado para esta ação.");
  }
}
