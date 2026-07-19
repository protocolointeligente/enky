import type { NextRequest } from "next/server";
import { addMembers, GROUP_WRITE_ROLES } from "@/modules/coach-groups/group-service";
import { addMembersSchema } from "@/modules/coach-groups/group-schemas";
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

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertTrustedOrigin(request);
    const identity = await requireAuthenticatedUser();
    requireGlobalRole(identity, ["TRAINER"]);
    const active = await resolveActiveOrganization(identity.userId);
    requireOrgRole(active, GROUP_WRITE_ROLES);
    await enforceRateLimit(crmWriteRateLimiter, `crm-write:${identity.userId}`);

    const { id } = await params;
    const input = await parseJsonBody(request, addMembersSchema);
    const result = await addMembers(id, input, {
      userId: identity.userId,
      organizationId: active.organizationId,
    });
    return apiSuccess(result, 201);
  } catch (error) {
    return apiError(error);
  }
}
