import type { NextRequest } from "next/server";
import {
  CONTRACT_READ_ROLES,
  CONTRACT_WRITE_ROLES,
  createContract,
  listContracts,
} from "@/modules/contracts/contract-service";
import { createContractSchema, listContractsQuerySchema } from "@/modules/contracts/contract-schemas";
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

export async function GET(request: NextRequest) {
  try {
    const identity = await requireAuthenticatedUser();
    requireGlobalRole(identity, ["TRAINER"]);
    const active = await resolveActiveOrganization(identity.userId);
    requireOrgRole(active, CONTRACT_READ_ROLES);

    const params = Object.fromEntries(request.nextUrl.searchParams);
    const filters = listContractsQuerySchema.parse(params);
    const result = await listContracts(filters, {
      userId: identity.userId,
      organizationId: active.organizationId,
    });
    return apiSuccess(result);
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    assertTrustedOrigin(request);
    const identity = await requireAuthenticatedUser();
    requireGlobalRole(identity, ["TRAINER"]);
    const active = await resolveActiveOrganization(identity.userId);
    requireOrgRole(active, CONTRACT_WRITE_ROLES);
    await enforceRateLimit(crmWriteRateLimiter, `crm-write:${identity.userId}`);

    const input = await parseJsonBody(request, createContractSchema);
    const contract = await createContract(input, {
      userId: identity.userId,
      organizationId: active.organizationId,
      ipAddress: getClientIp(request),
      userAgent: request.headers.get("user-agent") ?? undefined,
    });
    return apiSuccess({ contract }, 201);
  } catch (error) {
    return apiError(error);
  }
}
