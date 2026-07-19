import type { NextRequest } from "next/server";
import { BULK_CLIENT_ROLES, bulkClientStatusSchema, bulkSetClientStatus } from "@/modules/coach-bulk/bulk-service";
import {
  requireAuthenticatedUser,
  requireGlobalRole,
  requireOrgRole,
  resolveActiveOrganization,
} from "@/server/auth/guards";
import { parseJsonBody } from "@/server/http/parse-body";
import { apiError, apiSuccess } from "@/server/http/response";
import { assertTrustedOrigin } from "@/server/security/csrf";
import { getClientIp } from "@/server/security/ip";
import { crmWriteRateLimiter, enforceRateLimit } from "@/server/security/rate-limit";

export const dynamic = "force-dynamic";

// Ação em massa: muda o status de vários clientes de uma vez (§21).
export async function POST(request: NextRequest) {
  try {
    assertTrustedOrigin(request);
    const identity = await requireAuthenticatedUser();
    requireGlobalRole(identity, ["TRAINER"]);
    const active = await resolveActiveOrganization(identity.userId);
    requireOrgRole(active, BULK_CLIENT_ROLES);
    await enforceRateLimit(crmWriteRateLimiter, `crm-write:${identity.userId}`);

    const input = await parseJsonBody(request, bulkClientStatusSchema);
    const result = await bulkSetClientStatus(input, {
      userId: identity.userId,
      organizationId: active.organizationId,
      ipAddress: getClientIp(request),
    });
    return apiSuccess(result);
  } catch (error) {
    return apiError(error);
  }
}
