import type { NextRequest } from "next/server";
import { z } from "zod";
import { resetPassword } from "@/modules/identity/reset-password";
import { apiError, apiSuccess } from "@/server/http/response";
import { parseJsonBody } from "@/server/http/parse-body";
import { assertTrustedOrigin } from "@/server/security/csrf";
import { getClientIp } from "@/server/security/ip";
import { enforceRateLimit, passwordResetRateLimiter } from "@/server/security/rate-limit";

export const dynamic = "force-dynamic";

const confirmSchema = z.object({
  token: z.string().min(1, "Token ausente."),
  password: z.string().min(1, "Informe a nova senha."),
});

export async function POST(request: NextRequest) {
  try {
    assertTrustedOrigin(request);
    await enforceRateLimit(passwordResetRateLimiter, `pwreset-confirm:${getClientIp(request)}`);

    const { token, password } = await parseJsonBody(request, confirmSchema);
    await resetPassword(token, password, Date.now());

    return apiSuccess({ reset: true });
  } catch (error) {
    return apiError(error);
  }
}
