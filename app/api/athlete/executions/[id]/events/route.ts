import type { NextRequest } from "next/server";
import { appendEventsInputSchema } from "@/modules/workout-execution/execution-schema";
import { appendExecutionEvents } from "@/modules/workout-execution/append-events";
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

// Endpoint único de eventos: START já veio de /execution/start; aqui chegam
// PAUSE/RESUME/STEP_COMPLETED/COMPLETE/ABANDON etc. O status é derivado do fluxo,
// então não há rotas separadas de pause/resume/complete/abandon (§10).
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertTrustedOrigin(request);
    const identity = await requireAuthenticatedUser();
    requireGlobalRole(identity, ["ATHLETE"]);

    await enforceRateLimit(executionWriteRateLimiter, `execution-write:${identity.userId}`);

    const { id } = await params;
    const input = await parseJsonBody(request, appendEventsInputSchema);
    const { organizationId, athleteProfileId } = await resolveAthleteOrganization(identity.userId);

    const execution = await appendExecutionEvents(
      id,
      input,
      {
        userId: identity.userId,
        athleteProfileId,
        organizationId,
        ipAddress: getClientIp(request),
        userAgent: request.headers.get("user-agent") ?? undefined,
      },
      Date.now(),
    );

    return apiSuccess({ execution });
  } catch (error) {
    return apiError(error);
  }
}
