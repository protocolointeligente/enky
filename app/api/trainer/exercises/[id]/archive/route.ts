import type { NextRequest } from "next/server";
import { archiveExercise } from "@/modules/exercises/exercise-service";
import {
  requireAuthenticatedUser,
  requireGlobalRole,
  resolveActiveOrganization,
} from "@/server/auth/guards";
import { apiError, apiSuccess } from "@/server/http/response";
import { assertTrustedOrigin } from "@/server/security/csrf";
import { getClientIp } from "@/server/security/ip";
import { enforceRateLimit, libraryWriteRateLimiter } from "@/server/security/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertTrustedOrigin(request);
    const identity = await requireAuthenticatedUser();
    requireGlobalRole(identity, ["TRAINER"]);
    const { organizationId } = await resolveActiveOrganization(identity.userId);

    await enforceRateLimit(libraryWriteRateLimiter, `library-write:${identity.userId}`);

    const { id } = await params;
    await archiveExercise(id, {
      userId: identity.userId,
      organizationId,
      ipAddress: getClientIp(request),
      userAgent: request.headers.get("user-agent") ?? undefined,
    });

    return apiSuccess({ archived: true });
  } catch (error) {
    return apiError(error);
  }
}
