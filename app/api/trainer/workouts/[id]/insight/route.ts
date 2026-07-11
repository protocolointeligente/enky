import type { NextRequest } from "next/server";
import { prisma } from "@/infrastructure/database/prisma";
import { analyzeWorkoutFeedback } from "@/modules/intelligence/analyze-workout";
import {
  requireAuthenticatedUser,
  requireGlobalRole,
  resolveActiveOrganization,
} from "@/server/auth/guards";
import { apiError, apiSuccess } from "@/server/http/response";

export const dynamic = "force-dynamic";

// ENKY Intelligence — interpretação do feedback de um treino (somente leitura).
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const identity = await requireAuthenticatedUser();
    requireGlobalRole(identity, ["TRAINER"]);
    const { organizationId } = await resolveActiveOrganization(identity.userId);
    const trainerProfile = await prisma.trainerProfile.findUniqueOrThrow({
      where: { userId: identity.userId },
    });

    const { id } = await params;
    const insight = await analyzeWorkoutFeedback(id, {
      organizationId,
      trainerProfileId: trainerProfile.id,
    });

    return apiSuccess({ insight });
  } catch (error) {
    return apiError(error);
  }
}
