import type { NextRequest } from "next/server";
import { prisma } from "@/infrastructure/database/prisma";
import { createWorkoutDraft } from "@/modules/workouts/create-workout-draft";
import { listTrainerAthleteWorkouts } from "@/modules/workouts/get-trainer-workout";
import { createWorkoutDraftInputSchema } from "@/modules/workouts/prescription-schema";
import { requireAuthenticatedUser, requireGlobalRole, resolveActiveOrganization } from "@/server/auth/guards";
import { parseJsonBody } from "@/server/http/parse-body";
import { apiError, apiSuccess } from "@/server/http/response";
import { assertTrustedOrigin } from "@/server/security/csrf";
import { getClientIp } from "@/server/security/ip";
import { enforceRateLimit, workoutWriteRateLimiter } from "@/server/security/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    assertTrustedOrigin(request);
    const identity = await requireAuthenticatedUser();
    requireGlobalRole(identity, ["TRAINER"]);
    const { organizationId } = await resolveActiveOrganization(identity.userId);

    await enforceRateLimit(workoutWriteRateLimiter, `workout-write:${identity.userId}`);

    const input = await parseJsonBody(request, createWorkoutDraftInputSchema);
    const trainerProfile = await prisma.trainerProfile.findUniqueOrThrow({
      where: { userId: identity.userId },
    });

    const workout = await createWorkoutDraft(input, {
      userId: identity.userId,
      trainerProfileId: trainerProfile.id,
      organizationId,
      ipAddress: getClientIp(request),
      userAgent: request.headers.get("user-agent") ?? undefined,
    });

    return apiSuccess({ workoutId: workout.id }, 201);
  } catch (error) {
    return apiError(error);
  }
}

export async function GET(request: NextRequest) {
  try {
    const identity = await requireAuthenticatedUser();
    requireGlobalRole(identity, ["TRAINER"]);
    const { organizationId } = await resolveActiveOrganization(identity.userId);
    const trainerProfile = await prisma.trainerProfile.findUniqueOrThrow({
      where: { userId: identity.userId },
    });

    const athleteId = request.nextUrl.searchParams.get("athleteId") ?? undefined;

    const workouts = await listTrainerAthleteWorkouts(
      { organizationId, trainerProfileId: trainerProfile.id },
      { athleteId },
    );

    return apiSuccess({ workouts });
  } catch (error) {
    return apiError(error);
  }
}
