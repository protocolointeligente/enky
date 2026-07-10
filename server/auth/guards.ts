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

export interface AthleteOrganizationScope {
  organizationId: string;
  athleteProfileId: string;
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

// Athletes never get an OrganizationMembership row — only the trainer who
// owns a personal organization does (ADR-001). An athlete's tenant is
// instead reached through their CoachAthleteRelationship, so this is the
// athlete-side equivalent of resolveActiveOrganization(): same MVP
// single-relationship assumption, same single extension point for when
// Fase 6 allows an athlete to train with more than one organization.
export async function resolveAthleteOrganization(userId: string): Promise<AthleteOrganizationScope> {
  const athleteProfile = await prisma.athleteProfile.findUnique({ where: { userId } });
  if (!athleteProfile) {
    throw new AuthorizationError("Usuário não possui perfil de atleta.");
  }

  const relationship = await prisma.coachAthleteRelationship.findFirst({
    where: { athleteId: athleteProfile.id, isActive: true },
    orderBy: { startedAt: "asc" },
  });
  if (!relationship) {
    throw new AuthorizationError("Atleta não pertence a nenhuma organização.");
  }

  return { organizationId: relationship.organizationId, athleteProfileId: athleteProfile.id };
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
