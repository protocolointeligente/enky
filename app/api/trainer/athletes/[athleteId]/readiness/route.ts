import type { NextRequest } from "next/server";
import { prisma } from "@/infrastructure/database/prisma";
import { getAthleteReadiness } from "@/modules/intelligence/readiness-checkin";
import {
  requireAuthenticatedUser,
  requireGlobalRole,
  requireTrainerAccessToAthlete,
  resolveActiveOrganization,
} from "@/server/auth/guards";
import { apiError, apiSuccess } from "@/server/http/response";

export const dynamic = "force-dynamic";

// Treinador lê a prontidão recente de um atleta vinculado (Fase II — item 5).
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ athleteId: string }> },
) {
  try {
    const identity = await requireAuthenticatedUser();
    requireGlobalRole(identity, ["TRAINER"]);
    const { organizationId } = await resolveActiveOrganization(identity.userId);
    const trainerProfile = await prisma.trainerProfile.findUniqueOrThrow({
      where: { userId: identity.userId },
    });

    const { athleteId } = await params;
    await requireTrainerAccessToAthlete(organizationId, trainerProfile.id, athleteId);

    const checkIns = await getAthleteReadiness(organizationId, athleteId);
    return apiSuccess({ checkIns });
  } catch (error) {
    return apiError(error);
  }
}
