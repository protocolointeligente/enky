import { prisma } from "@/infrastructure/database/prisma";
import { listCoachAthletes } from "@/modules/athletes/list-coach-athletes";
import {
  requireAuthenticatedUser,
  requireGlobalRole,
  resolveActiveOrganization,
} from "@/server/auth/guards";
import { apiError, apiSuccess } from "@/server/http/response";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const identity = await requireAuthenticatedUser();
    requireGlobalRole(identity, ["TRAINER"]);
    const { organizationId } = await resolveActiveOrganization(identity.userId);
    const trainerProfile = await prisma.trainerProfile.findUniqueOrThrow({
      where: { userId: identity.userId },
    });

    const athletes = await listCoachAthletes({
      organizationId,
      trainerProfileId: trainerProfile.id,
    });

    return apiSuccess({ athletes });
  } catch (error) {
    return apiError(error);
  }
}
