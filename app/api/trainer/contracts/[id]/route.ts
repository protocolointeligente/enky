import type { NextRequest } from "next/server";
import {
  CONTRACT_READ_ROLES,
  CONTRACT_WRITE_ROLES,
  getContract,
  updateContract,
} from "@/modules/contracts/contract-service";
import { updateContractSchema } from "@/modules/contracts/contract-schemas";
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

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const identity = await requireAuthenticatedUser();
    requireGlobalRole(identity, ["TRAINER"]);
    const active = await resolveActiveOrganization(identity.userId);
    requireOrgRole(active, CONTRACT_READ_ROLES);

    const { id } = await params;
    const contract = await getContract(id, {
      userId: identity.userId,
      organizationId: active.organizationId,
    });
    return apiSuccess({ contract });
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertTrustedOrigin(request);
    const identity = await requireAuthenticatedUser();
    requireGlobalRole(identity, ["TRAINER"]);
    const active = await resolveActiveOrganization(identity.userId);
    requireOrgRole(active, CONTRACT_WRITE_ROLES);
    await enforceRateLimit(crmWriteRateLimiter, `crm-write:${identity.userId}`);

    const { id } = await params;
    const input = await parseJsonBody(request, updateContractSchema);
    const contract = await updateContract(id, input, {
      userId: identity.userId,
      organizationId: active.organizationId,
      ipAddress: getClientIp(request),
    });
    return apiSuccess({ contract });
  } catch (error) {
    return apiError(error);
  }
}
