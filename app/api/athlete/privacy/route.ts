import type { NextRequest } from "next/server";
import { z } from "zod";
import { requestAccountDeletion, requestDataExport } from "@/modules/profile/profile-service";
import { requireAuthenticatedUser, requireGlobalRole } from "@/server/auth/guards";
import { parseJsonBody } from "@/server/http/parse-body";
import { apiError, apiSuccess } from "@/server/http/response";
import { assertTrustedOrigin } from "@/server/security/csrf";
import { getClientIp } from "@/server/security/ip";
import { enforceRateLimit, passwordResetRateLimiter } from "@/server/security/rate-limit";

export const dynamic = "force-dynamic";

// Uma rota, duas solicitações LGPD (§12): export (kind=EXPORT) e exclusão
// (kind=DELETE, exige confirm:true). Ambas são REGISTRADAS e processadas fora de
// banda pelo operador — nada é apagado aqui. Rate limit conservador (destrutivo).
const bodySchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("EXPORT") }),
  z.object({
    kind: z.literal("DELETE"),
    confirm: z.literal(true),
    reason: z.string().trim().max(500).optional(),
  }),
]);

export async function POST(request: NextRequest) {
  try {
    assertTrustedOrigin(request);
    const identity = await requireAuthenticatedUser();
    requireGlobalRole(identity, ["ATHLETE"]);
    await enforceRateLimit(passwordResetRateLimiter, `privacy-request:${identity.userId}`);

    const body = await parseJsonBody(request, bodySchema);
    const actor = {
      userId: identity.userId,
      ipAddress: getClientIp(request),
      userAgent: request.headers.get("user-agent") ?? undefined,
    };

    if (body.kind === "EXPORT") {
      await requestDataExport(actor);
    } else {
      await requestAccountDeletion(actor);
    }
    return apiSuccess({ requested: body.kind });
  } catch (error) {
    return apiError(error);
  }
}
