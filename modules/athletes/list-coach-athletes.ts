import { prisma } from "@/infrastructure/database/prisma";

export interface TrainerScope {
  organizationId: string;
  trainerProfileId: string;
}

// Feeds the trainer's roster picker in the canonical prescription form —
// only actively-linked athletes are selectable, matching
// requireTrainerAccessToAthlete's own isActive check.
export async function listCoachAthletes(actor: TrainerScope) {
  const relationships = await prisma.coachAthleteRelationship.findMany({
    where: { organizationId: actor.organizationId, trainerId: actor.trainerProfileId, isActive: true },
    include: { athlete: { include: { user: { select: { name: true, email: true } } } } },
    orderBy: { startedAt: "desc" },
  });

  return relationships.map((relationship) => ({
    athleteProfileId: relationship.athleteId,
    name: relationship.athlete.user?.name ?? null,
    email: relationship.athlete.user?.email ?? null,
  }));
}
