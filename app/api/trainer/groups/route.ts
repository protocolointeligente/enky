import type { NextRequest } from "next/server";
import {
  createGroup,
  GROUP_READ_ROLES,
  GROUP_WRITE_ROLES,
  listGroups,
} from "@/modules/coach-groups/group-service";
import { createGroupSchema, listGroupsQuerySchema } from "@/modules/coach-groups/group-schemas";
import {
  requireAuthenticatedUser,
  requireGlobalRole,
  requireOrgRole,
  resolveActiveOrganization,
} from "@/server/auth/guards";
import { parseJsonBody } from "@/server/http/parse-body";
import { apiError, apiSuccess } from "@/server/http/response";
import { assertTrustedOrigin } from "@/server/security/csrf";
import { crmWriteRateLimiter, enforceRateLimit } from "@/server/security/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const identity = await requireAuthenticatedUser();
    requireGlobalRole(identity, ["TRAINER"]);
    const active = await resolveActiveOrganization(identity.userId);
    requireOrgRole(active, GROUP_READ_ROLES);

    const filters = listGroupsQuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams));
    const result = await listGroups(filters, {
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
    requireOrgRole(active, GROUP_WRITE_ROLES);
    await enforceRateLimit(crmWriteRateLimiter, `crm-write:${identity.userId}`);

    const input = await parseJsonBody(request, createGroupSchema);
    const group = await createGroup(input, {
      userId: identity.userId,
      organizationId: active.organizationId,
    });
    return apiSuccess({ group }, 201);
  } catch (error) {
    return apiError(error);
  }
}
