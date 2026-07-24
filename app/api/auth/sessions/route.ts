import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { listUserSessions, revokeOtherSessions } from "@/modules/profile/profile-service";
import { requireAuthenticatedUser } from "@/server/auth/guards";
import { SESSION_COOKIE_NAME, hashSessionToken } from "@/server/auth/session";
import { apiError, apiSuccess } from "@/server/http/response";
import { assertTrustedOrigin } from "@/server/security/csrf";
import { AuthorizationError } from "@/domain/errors";
import { getClientIp } from "@/server/security/ip";

export const dynamic = "force-dynamic";

async function currentTokenHash(): Promise<string> {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token) throw new AuthorizationError("Sessão não encontrada.");
  return hashSessionToken(token);
}

export async function GET() {
  try {
    const identity = await requireAuthenticatedUser();
    const sessions = await listUserSessions(identity.userId, await currentTokenHash());
    return apiSuccess({ sessions });
  } catch (error) {
    return apiError(error);
  }
}

// Encerra todas as sessões exceto a atual ("sair dos outros dispositivos").
export async function DELETE(request: NextRequest) {
  try {
    assertTrustedOrigin(request);
    const identity = await requireAuthenticatedUser();
    const revoked = await revokeOtherSessions(await currentTokenHash(), {
      userId: identity.userId,
      ipAddress: getClientIp(request),
      userAgent: request.headers.get("user-agent") ?? undefined,
    });
    return apiSuccess({ revoked });
  } catch (error) {
    return apiError(error);
  }
}
