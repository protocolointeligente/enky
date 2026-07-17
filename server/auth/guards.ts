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
    include: { organization: { select: { isActive: true } } },
  });

  if (!membership) {
    throw new AuthorizationError("Usuário não pertence a nenhuma organização.");
  }

  // Suspensão de organização (Fase 9) é aplicada aqui, no único ponto que
  // resolve tenant para o treinador — e não em cada rota. Suspender a
  // organização no /admin passa a valer na requisição seguinte, sem revogar
  // sessão nem tocar em nenhum dado: o vínculo continua intacto e reativar
  // devolve o acesso. É por isso que suspender substitui delete.
  if (!membership.organization.isActive) {
    throw new AuthorizationError("Organização suspensa. Contate o suporte da plataforma.");
  }

  return { organizationId: membership.organizationId, organizationRole: membership.role };
}

// Athletes never get an OrganizationMembership row — only the trainer who
// owns a personal organization does (ADR-001). An athlete's tenant is
// instead reached through their CoachAthleteRelationship.
//
// MVP política (Fase 02D): um atleta tem NO MÁXIMO uma organização ativa.
// Isso não é uma suposição frouxa — o fluxo de ativação de convite já a
// garante: ativar um segundo convite para o mesmo e-mail falha com
// ConflictError ("e-mail já cadastrado") em activate-invitation.ts, então
// nenhum User de atleta chega a acumular dois vínculos ativos pela via
// suportada. Por isso NUNCA resolvemos "a primeira" organização de forma
// arbitrária (o antigo findFirst+orderBy escondia um bug latente): se
// houver mais de um vínculo ativo, isso é uma violação de invariante e
// falhamos ruidosamente, em vez de escolher um tenant não-determinístico
// que poderia vazar treinos da organização errada.
//
// Suporte real a múltiplas organizações por atleta — derivar o tenant do
// próprio recurso acessado (Workout.organizationId) para detalhes e
// agregar/segregar listagens por organização — é trabalho de Fase 6. Este
// é o único ponto de extensão; nenhuma rota de atleta resolve tenant de
// outra forma.
export async function resolveAthleteOrganization(
  userId: string,
): Promise<AthleteOrganizationScope> {
  const athleteProfile = await prisma.athleteProfile.findUnique({ where: { userId } });
  if (!athleteProfile) {
    throw new AuthorizationError("Usuário não possui perfil de atleta.");
  }

  const activeRelationships = await prisma.coachAthleteRelationship.findMany({
    where: { athleteId: athleteProfile.id, isActive: true },
    select: { organizationId: true, organization: { select: { isActive: true } } },
  });

  const [relationship, ...extraRelationships] = activeRelationships;
  if (!relationship) {
    throw new AuthorizationError("Atleta não pertence a nenhuma organização ativa.");
  }
  if (extraRelationships.length > 0) {
    // Invariante do MVP violada — melhor recusar do que servir dados de
    // uma organização escolhida de forma não-determinística.
    throw new AuthorizationError(
      "Atleta possui vínculos ativos em múltiplas organizações — não suportado no MVP.",
    );
  }

  // Suspender a organização também corta o atleta, não só o treinador — senão
  // a suspensão seria meia-suspensão e o tenant continuaria operando por
  // metade. Mesmo racional de `resolveActiveOrganization`.
  if (!relationship.organization.isActive) {
    throw new AuthorizationError("Organização suspensa. Contate o suporte da plataforma.");
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
