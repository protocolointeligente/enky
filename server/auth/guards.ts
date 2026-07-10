import { cookies } from "next/headers";
import type { OrganizationRole, Role } from "@prisma/client";
import { AuthenticationError, AuthorizationError } from "@/domain/errors";
import { prisma } from "@/infrastructure/database/prisma";
import { SESSION_COOKIE_NAME, verifySessionByToken } from "@/server/auth/session";

export interface CurrentIdentity {
  userId: string;
  email: string;
  name: string;
  globalRole: Role;
}

export interface ActiveOrganization {
  organizationId: string;
  organizationRole: OrganizationRole;
}

// Role is always read live from the database, never cached in the session
// token — a demoted/deactivated user loses access on their very next
// request, not only after the session expires.
export async function getCurrentSession(): Promise<CurrentIdentity | null> {
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

export async function requireAuthenticatedUser(): Promise<CurrentIdentity> {
  const identity = await getCurrentSession();
  if (!identity) {
    throw new AuthenticationError("Sessão ausente, expirada ou revogada.");
  }
  return identity;
}

export function requireGlobalRole(identity: CurrentIdentity, allowedRoles: readonly Role[]): void {
  if (!allowedRoles.includes(identity.globalRole)) {
    throw new AuthorizationError("Papel do usuário não autorizado para esta ação.");
  }
}

// MVP: cada TRAINER tem exatamente uma OrganizationMembership (a
// organização pessoal do ADR-001) — "ativa" é trivial hoje. Esta função é
// o único ponto de extensão para quando a Fase 6 introduzir múltiplas
// memberships por usuário; nenhuma outra parte do código deve resolver
// tenant de outra forma.
export async function resolveActiveOrganization(userId: string): Promise<ActiveOrganization> {
  const membership = await prisma.organizationMembership.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });

  if (!membership) {
    throw new AuthorizationError("Usuário não pertence a nenhuma organização.");
  }

  return { organizationId: membership.organizationId, organizationRole: membership.role };
}

export async function requireOrganizationMembership(
  userId: string,
  organizationId: string,
): Promise<OrganizationRole> {
  const membership = await prisma.organizationMembership.findUnique({
    where: { userId_organizationId: { userId, organizationId } },
  });

  if (!membership) {
    throw new AuthorizationError("Usuário não é membro desta organização.");
  }

  return membership.role;
}

// Product & Engineering Specification v1.0 §14: treinador só acessa
// atletas vinculados, e apenas enquanto o vínculo estiver ativo.
export async function requireTrainerAccessToAthlete(
  organizationId: string,
  trainerProfileId: string,
  athleteProfileId: string,
): Promise<void> {
  const relationship = await prisma.coachAthleteRelationship.findUnique({
    where: {
      organizationId_trainerId_athleteId: {
        organizationId,
        trainerId: trainerProfileId,
        athleteId: athleteProfileId,
      },
    },
  });

  if (!relationship || !relationship.isActive) {
    throw new AuthorizationError("Treinador não tem vínculo ativo com este atleta.");
  }
}
