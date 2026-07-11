import type { NextRequest } from "next/server";
import { updateExerciseInputSchema } from "@/modules/exercises/exercise-schema";
import { updateExercise } from "@/modules/exercises/exercise-service";
import {
  requireAuthenticatedUser,
  requireGlobalRole,
  resolveActiveOrganization,
} from "@/server/auth/guards";
import { parseJsonBody } from "@/server/http/parse-body";
import { apiError, apiSuccess } from "@/server/http/response";
import { assertTrustedOrigin } from "@/server/security/csrf";
import { getClientIp } from "@/server/security/ip";
import { enforceRateLimit, libraryWriteRateLimiter } from "@/server/security/rate-limit";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertTrustedOrigin(request);
    const identity = await requireAuthenticatedUser();
    requireGlobalRole(identity, ["TRAINER"]);
    const { organizationId } = await resolveActiveOrganization(identity.userId);

    await enforceRateLimit(libraryWriteRateLimiter, `library-write:${identity.userId}`);

    const { id } = await params;
    const input = await parseJsonBody(request, updateExerciseInputSchema);
    const exercise = await updateExercise(id, input, {
      userId: identity.userId,
      organizationId,
      ipAddress: getClientIp(request),
      userAgent: request.headers.get("user-agent") ?? undefined,
    });

    return apiSuccess({ exerciseId: exercise.id });
  } catch (error) {
    return apiError(error);
  }
}
