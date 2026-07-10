import type { NextRequest } from "next/server";
import {
  activateAthleteInvitation,
  activateInvitationInputSchema,
} from "@/modules/athletes/activate-invitation";
import { getSessionCookieOptions, SESSION_COOKIE_NAME } from "@/server/auth/session";
import { apiError, apiSuccess } from "@/server/http/response";
import { parseJsonBody } from "@/server/http/parse-body";
import { assertTrustedOrigin } from "@/server/security/csrf";
import { getClientIp } from "@/server/security/ip";
import { activateInvitationRateLimiter, enforceRateLimit } from "@/server/security/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    assertTrustedOrigin(request);
    const ipAddress = getClientIp(request);
    await enforceRateLimit(activateInvitationRateLimiter, `activate:${ipAddress}`);

    const input = await parseJsonBody(request, activateInvitationInputSchema);
    const result = await activateAthleteInvitation(input, {
      ipAddress,
      userAgent: request.headers.get("user-agent") ?? undefined,
    });

    const response = apiSuccess(
      { userId: result.userId, athleteProfileId: result.athleteProfileId },
      201,
    );
    response.cookies.set(SESSION_COOKIE_NAME, result.sessionToken, {
      ...getSessionCookieOptions(),
      expires: result.sessionExpiresAt,
    });
    return response;
  } catch (error) {
    return apiError(error);
  }
}
