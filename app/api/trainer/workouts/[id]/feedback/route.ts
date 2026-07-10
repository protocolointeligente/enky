import type { NextRequest } from "next/server";
import { prisma } from "@/infrastructure/database/prisma";
import { getTrainerWorkoutFeedback } from "@/modules/feedback/get-trainer-workout-feedback";
import { requireAuthenticatedUser, requireGlobalRole, resolveActiveOrganization } from "@/server/auth/guards";
import { apiError, apiSuccess } from "@/server/http/response";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const identity = await requireAuthenticatedUser();
    requireGlobalRole(identity, ["TRAINER"]);
    const { organizationId } = await resolveActiveOrganization(identity.userId);
    const trainerProfile = await prisma.trainerProfile.findUniqueOrThrow({
      where: { userId: identity.userId },
    });
    const { id } = await params;

    const feedback = await getTrainerWorkoutFeedback(id, {
      organizationId,
      trainerProfileId: trainerProfile.id,
    });

    return apiSuccess({ feedback });
  } catch (error) {
    return apiError(error);
  }
}
