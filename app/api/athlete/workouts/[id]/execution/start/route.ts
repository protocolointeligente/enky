import type { NextRequest } from "next/server";
import { startExecutionInputSchema } from "@/modules/workout-execution/execution-schema";
import { startWorkoutExecution } from "@/modules/workout-execution/start-execution";
import {
  requireAuthenticatedUser,
  requireGlobalRole,
  resolveAthleteOrganization,
} from "@/server/auth/guards";
import { parseJsonBody } from "@/server/http/parse-body";
import { apiError, apiSuccess } from "@/server/http/response";
import { assertTrustedOrigin } from "@/server/security/csrf";
import { getClientIp } from "@/server/security/ip";
import { enforceRateLimit, executionWriteRateLimiter } from "@/server/security/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertTrustedOrigin(request);
    const identity = await requireAuthenticatedUser();
    requireGlobalRole(identity, ["ATHLETE"]);

    await enforceRateLimit(executionWriteRateLimiter, `execution-write:${identity.userId}`);

    const { id } = await params;
    const input = await parseJsonBody(request, startExecutionInputSchema);
    const { organizationId, athleteProfileId } = await resolveAthleteOrganization(identity.userId);

    const execution = await startWorkoutExecution(id, input, {
      userId: identity.userId,
      athleteProfileId,
      organizationId,
      ipAddress: getClientIp(request),
      userAgent: request.headers.get("user-agent") ?? undefined,
    });

    return apiSuccess({ execution }, 201);
  } catch (error) {
    return apiError(error);
  }
}
