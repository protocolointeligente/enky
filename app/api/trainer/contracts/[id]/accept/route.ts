import type { NextRequest } from "next/server";
import { acceptContract, CONTRACT_WRITE_ROLES } from "@/modules/contracts/contract-service";
import { acceptContractSchema } from "@/modules/contracts/contract-schemas";
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

// Registra o aceite manual do contrato (§11) e o ativa.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertTrustedOrigin(request);
    const identity = await requireAuthenticatedUser();
    requireGlobalRole(identity, ["TRAINER"]);
    const active = await resolveActiveOrganization(identity.userId);
    requireOrgRole(active, CONTRACT_WRITE_ROLES);
    await enforceRateLimit(crmWriteRateLimiter, `crm-write:${identity.userId}`);

    const { id } = await params;
    const input = await parseJsonBody(request, acceptContractSchema);
    const contract = await acceptContract(id, input, {
      userId: identity.userId,
      organizationId: active.organizationId,
      ipAddress: getClientIp(request),
    });
    return apiSuccess({ contract });
  } catch (error) {
    return apiError(error);
  }
}
