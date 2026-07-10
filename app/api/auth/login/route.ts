import type { NextRequest } from "next/server";
import { login, loginInputSchema } from "@/modules/identity/login";
import { getSessionCookieOptions, SESSION_COOKIE_NAME } from "@/server/auth/session";
import { apiError, apiSuccess } from "@/server/http/response";
import { parseJsonBody } from "@/server/http/parse-body";
import { assertTrustedOrigin } from "@/server/security/csrf";
import { getClientIp } from "@/server/security/ip";
import { enforceRateLimit, loginRateLimiter } from "@/server/security/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    assertTrustedOrigin(request);
    const input = await parseJsonBody(request, loginInputSchema);
    await enforceRateLimit(loginRateLimiter, `login:${input.email.trim().toLowerCase()}`);

    const result = await login(input, {
      ipAddress: getClientIp(request),
      userAgent: request.headers.get("user-agent") ?? undefined,
    });

    const response = apiSuccess({ userId: result.userId });
    response.cookies.set(SESSION_COOKIE_NAME, result.sessionToken, {
      ...getSessionCookieOptions(),
      expires: result.sessionExpiresAt,
    });
    return response;
  } catch (error) {
    return apiError(error);
  }
}
