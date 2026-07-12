import type { NextRequest } from "next/server";
import { submitReadinessInputSchema } from "@/modules/intelligence/readiness-schema";
import {
  getMyReadiness,
  submitReadinessCheckIn,
} from "@/modules/intelligence/readiness-checkin";
import {
  requireAuthenticatedUser,
  requireGlobalRole,
  resolveAthleteOrganization,
} from "@/server/auth/guards";
import { parseJsonBody } from "@/server/http/parse-body";
import { apiError, apiSuccess } from "@/server/http/response";
import { assertTrustedOrigin } from "@/server/security/csrf";
import { getClientIp } from "@/server/security/ip";
import { enforceRateLimit, readinessWriteRateLimiter } from "@/server/security/rate-limit";

export const dynamic = "force-dynamic";

// Questionário de prontidão — o atleta consulta e envia o check-in do dia.
export async function GET() {
  try {
    const identity = await requireAuthenticatedUser();
    requireGlobalRole(identity, ["ATHLETE"]);
    const { athleteProfileId } = await resolveAthleteOrganization(identity.userId);

    const checkIns = await getMyReadiness(athleteProfileId);
    return apiSuccess({ checkIns });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    assertTrustedOrigin(request);
    const identity = await requireAuthenticatedUser();
    requireGlobalRole(identity, ["ATHLETE"]);

    await enforceRateLimit(readinessWriteRateLimiter, `readiness-write:${identity.userId}`);

    const input = await parseJsonBody(request, submitReadinessInputSchema);
    const { organizationId, athleteProfileId } = await resolveAthleteOrganization(identity.userId);

    const checkIn = await submitReadinessCheckIn(
      input,
      {
        userId: identity.userId,
        organizationId,
        athleteProfileId,
        ipAddress: getClientIp(request),
        userAgent: request.headers.get("user-agent") ?? undefined,
      },
      new Date(),
    );

    return apiSuccess({ checkIn }, 201);
  } catch (error) {
    return apiError(error);
  }
}
