import { prisma } from "@/infrastructure/database/prisma";

export interface TrainerScope {
  organizationId: string;
  trainerProfileId: string;
}

// Estados derivados para a tela de gestão de atletas (§3). Um "atleta" aqui
// é um AthleteProfile vinculado à organização do treinador — cada convite
// cria um AthleteProfile próprio, então cada linha tem no máximo um convite.
export type AthleteRosterStatus = "PENDING" | "EXPIRED" | "REVOKED" | "ACTIVE" | "ENDED";

export interface AthleteRosterEntry {
  athleteProfileId: string;
  invitationId: string | null;
  name: string | null;
  email: string | null;
  status: AthleteRosterStatus;
  isActiveLink: boolean;
  invitedAt: string | null;
  expiresAt: string | null;
  resentCount: number;
  canResend: boolean;
  canRevoke: boolean;
}

export async function listTrainerAthletes(
  actor: TrainerScope,
  now: Date = new Date(),
): Promise<AthleteRosterEntry[]> {
  const relationships = await prisma.coachAthleteRelationship.findMany({
    where: { organizationId: actor.organizationId, trainerId: actor.trainerProfileId },
    include: { athlete: { include: { user: { select: { name: true, email: true } } } } },
    orderBy: { startedAt: "desc" },
  });

  const athleteIds = relationships.map((relationship) => relationship.athleteId);
  const invitations = athleteIds.length
    ? await prisma.athleteInvitation.findMany({
        where: { organizationId: actor.organizationId, athleteId: { in: athleteIds } },
      })
    : [];
  const invitationByAthlete = new Map(
    invitations.map((invitation) => [invitation.athleteId, invitation]),
  );

  return relationships.map((relationship) => {
    const invitation = invitationByAthlete.get(relationship.athleteId) ?? null;
    const activated = relationship.athlete.user !== null;

    let status: AthleteRosterStatus;
    if (!relationship.isActive) {
      status = "ENDED";
    } else if (activated) {
      status = "ACTIVE";
    } else if (invitation?.isRevoked) {
      status = "REVOKED";
    } else if (invitation && invitation.expiresAt < now) {
      status = "EXPIRED";
    } else {
      status = "PENDING";
    }

    // Resend/revoke only make sense while the invitation is still an open,
    // unconsumed, un-revoked pending/expired invite (mirrors the guards in
    // resend-invitation.ts / revoke-invitation.ts).
    const invitationActionable =
      invitation !== null &&
      !invitation.isConsumed &&
      !invitation.isRevoked &&
      relationship.isActive &&
      !activated;

    return {
      athleteProfileId: relationship.athleteId,
      invitationId: invitation?.id ?? null,
      name: relationship.athlete.user?.name ?? null,
      email: relationship.athlete.user?.email ?? invitation?.email ?? null,
      status,
      isActiveLink: relationship.isActive,
      invitedAt: invitation?.createdAt.toISOString() ?? null,
      expiresAt: invitation?.expiresAt.toISOString() ?? null,
      resentCount: invitation?.resentCount ?? 0,
      canResend: invitationActionable,
      canRevoke: invitationActionable,
    };
  });
}
