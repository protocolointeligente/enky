import type { NextRequest } from "next/server";
import { prisma } from "@/infrastructure/database/prisma";
import { duplicateWorkout } from "@/modules/workouts/duplicate-workout";
import { duplicateWorkoutInputSchema } from "@/modules/workouts/schedule-schema";
import {
  requireAuthenticatedUser,
  requireGlobalRole,
  resolveActiveOrganization,
} from "@/server/auth/guards";
import { parseJsonBody } from "@/server/http/parse-body";
import { apiError, apiSuccess } from "@/server/http/response";
import { assertTrustedOrigin } from "@/server/security/csrf";
import { getClientIp } from "@/server/security/ip";
import { enforceRateLimit, workoutWriteRateLimiter } from "@/server/security/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertTrustedOrigin(request);
    const identity = await requireAuthenticatedUser();
    requireGlobalRole(identity, ["TRAINER"]);
    const { organizationId } = await resolveActiveOrganization(identity.userId);

    await enforceRateLimit(workoutWriteRateLimiter, `workout-write:${identity.userId}`);

    const { id } = await params;
    const input = await parseJsonBody(request, duplicateWorkoutInputSchema);
    const trainerProfile = await prisma.trainerProfile.findUniqueOrThrow({
      where: { userId: identity.userId },
    });

    const workout = await duplicateWorkout(id, input, {
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
