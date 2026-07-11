import type { NextRequest } from "next/server";
import { createExerciseInputSchema } from "@/modules/exercises/exercise-schema";
import { createExercise, listExercises } from "@/modules/exercises/exercise-service";
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

export async function GET(request: NextRequest) {
  try {
    const identity = await requireAuthenticatedUser();
    requireGlobalRole(identity, ["TRAINER"]);
    const { organizationId } = await resolveActiveOrganization(identity.userId);

    const sp = request.nextUrl.searchParams;
    const exercises = await listExercises(
      { organizationId },
      {
        search: sp.get("search") ?? undefined,
        category: sp.get("category") ?? undefined,
        includeInactive: sp.get("includeInactive") === "true",
      },
    );

    return apiSuccess({ exercises });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    assertTrustedOrigin(request);
    const identity = await requireAuthenticatedUser();
    requireGlobalRole(identity, ["TRAINER"]);
    const { organizationId } = await resolveActiveOrganization(identity.userId);

    await enforceRateLimit(libraryWriteRateLimiter, `library-write:${identity.userId}`);

    const input = await parseJsonBody(request, createExerciseInputSchema);
    const exercise = await createExercise(input, {
      userId: identity.userId,
      organizationId,
      ipAddress: getClientIp(request),
      userAgent: request.headers.get("user-agent") ?? undefined,
    });

    return apiSuccess({ exerciseId: exercise.id }, 201);
  } catch (error) {
    return apiError(error);
  }
}
