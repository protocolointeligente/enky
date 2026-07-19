import type { NextRequest } from "next/server";
import { changeLeadStatus, LEAD_WRITE_ROLES } from "@/modules/crm/lead-service";
import { changeLeadStatusSchema } from "@/modules/crm/lead-schemas";
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

// Mudança de etapa (inclui marcar WON/LOST/ARCHIVED): efeito colateral nos
// timestamps + rastro STATUS_CHANGE. Por isso é endpoint próprio, não um PATCH.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertTrustedOrigin(request);
    const identity = await requireAuthenticatedUser();
    requireGlobalRole(identity, ["TRAINER"]);
    const active = await resolveActiveOrganization(identity.userId);
    requireOrgRole(active, LEAD_WRITE_ROLES);
    await enforceRateLimit(crmWriteRateLimiter, `crm-write:${identity.userId}`);

    const { id } = await params;
    const input = await parseJsonBody(request, changeLeadStatusSchema);
    const lead = await changeLeadStatus(id, input, {
      userId: identity.userId,
      organizationId: active.organizationId,
    });
    return apiSuccess({ lead });
  } catch (error) {
    return apiError(error);
  }
}
