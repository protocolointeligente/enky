import type { NextRequest } from "next/server";
import {
  getGroup,
  GROUP_READ_ROLES,
  GROUP_WRITE_ROLES,
  updateGroup,
} from "@/modules/coach-groups/group-service";
import { updateGroupSchema } from "@/modules/coach-groups/group-schemas";
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

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const identity = await requireAuthenticatedUser();
    requireGlobalRole(identity, ["TRAINER"]);
    const active = await resolveActiveOrganization(identity.userId);
    requireOrgRole(active, GROUP_READ_ROLES);

    const { id } = await params;
    const group = await getGroup(id, { userId: identity.userId, organizationId: active.organizationId });
    return apiSuccess({ group });
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
    requireOrgRole(active, GROUP_WRITE_ROLES);
    await enforceRateLimit(crmWriteRateLimiter, `crm-write:${identity.userId}`);

    const { id } = await params;
    const input = await parseJsonBody(request, updateGroupSchema);
    const group = await updateGroup(id, input, {
      userId: identity.userId,
      organizationId: active.organizationId,
    });
    return apiSuccess({ group });
  } catch (error) {
    return apiError(error);
  }
}
