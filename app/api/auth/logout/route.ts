import type { NextRequest } from "next/server";
import { logout } from "@/modules/identity/logout";
import { getCurrentSession } from "@/server/auth/guards";
import { getSessionCookieOptions, SESSION_COOKIE_NAME } from "@/server/auth/session";
import { apiError, apiSuccess } from "@/server/http/response";
import { assertTrustedOrigin } from "@/server/security/csrf";
import { getClientIp } from "@/server/security/ip";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    assertTrustedOrigin(request);

    const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
    const identity = await getCurrentSession();

    if (token) {
      await logout(token, {
        userId: identity?.userId,
        ipAddress: getClientIp(request),
        userAgent: request.headers.get("user-agent") ?? undefined,
      });
    }

    const response = apiSuccess({ loggedOut: true });
    response.cookies.set(SESSION_COOKIE_NAME, "", {
      ...getSessionCookieOptions(),
      expires: new Date(0),
    });
    return response;
  } catch (error) {
    return apiError(error);
  }
}
