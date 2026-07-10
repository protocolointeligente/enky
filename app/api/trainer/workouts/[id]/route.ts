import type { NextRequest } from "next/server";
import { prisma } from "@/infrastructure/database/prisma";
import { getTrainerWorkout } from "@/modules/workouts/get-trainer-workout";
import { updateWorkoutDraftInputSchema } from "@/modules/workouts/prescription-schema";
import { updateWorkoutDraft } from "@/modules/workouts/update-workout-draft";
import { requireAuthenticatedUser, requireGlobalRole, resolveActiveOrganization } from "@/server/auth/guards";
import { parseJsonBody } from "@/server/http/parse-body";
import { apiError, apiSuccess } from "@/server/http/response";
import { assertTrustedOrigin } from "@/server/security/csrf";
import { getClientIp } from "@/server/security/ip";
import { enforceRateLimit, workoutWriteRateLimiter } from "@/server/security/rate-limit";

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

    const workout = await getTrainerWorkout(id, { organizationId, trainerProfileId: trainerProfile.id });

    return apiSuccess({ workout });
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertTrustedOrigin(request);
    const identity = await requireAuthenticatedUser();
    requireGlobalRole(identity, ["TRAINER"]);
    const { organizationId } = await resolveActiveOrganization(identity.userId);

    await enforceRateLimit(workoutWriteRateLimiter, `workout-write:${identity.userId}`);

    const { id } = await params;
    const input = await parseJsonBody(request, updateWorkoutDraftInputSchema);
    const trainerProfile = await prisma.trainerProfile.findUniqueOrThrow({
      where: { userId: identity.userId },
    });

    const workout = await updateWorkoutDraft(id, input, {
      userId: identity.userId,
      trainerProfileId: trainerProfile.id,
      organizationId,
      ipAddress: getClientIp(request),
      userAgent: request.headers.get("user-agent") ?? undefined,
    });

    return apiSuccess({ workout });
  } catch (error) {
    return apiError(error);
  }
}
