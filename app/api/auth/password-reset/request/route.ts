import type { NextRequest } from "next/server";
import { z } from "zod";
import { sendPasswordResetEmail } from "@/infrastructure/mail/password-reset-mailer";
import { getPublicBaseUrl } from "@/lib/env";
import { requestPasswordReset } from "@/modules/identity/request-password-reset";
import { apiError, apiSuccess } from "@/server/http/response";
import { parseJsonBody } from "@/server/http/parse-body";
import { logger } from "@/server/observability/logger";
import { assertTrustedOrigin } from "@/server/security/csrf";
import { getClientIp } from "@/server/security/ip";
import { enforceRateLimit, passwordResetRateLimiter } from "@/server/security/rate-limit";

export const dynamic = "force-dynamic";

const requestSchema = z.object({ email: z.string().email("E-mail inválido.") });

export async function POST(request: NextRequest) {
  try {
    assertTrustedOrigin(request);
    await enforceRateLimit(passwordResetRateLimiter, `pwreset:${getClientIp(request)}`);

    const { email } = await parseJsonBody(request, requestSchema);
    const result = await requestPasswordReset(email, Date.now());

    if (result) {
      const resetUrl = `${getPublicBaseUrl()}/redefinir-senha?token=${result.token}`;
      try {
        await sendPasswordResetEmail({
          to: result.email,
          userName: result.userName,
          resetUrl,
          expiresAt: result.expiresAt,
        });
      } catch (mailError) {
        // Never leak account existence or mailer state to the caller: log and
        // still answer generically below.
        logger.error(
          { err: mailError instanceof Error ? mailError.message : "unknown" },
          "falha ao enviar e-mail de redefinição de senha",
        );
      }
    }

    // Same response whether or not the e-mail exists (anti-enumeration).
    return apiSuccess({ requested: true });
  } catch (error) {
    return apiError(error);
  }
}
