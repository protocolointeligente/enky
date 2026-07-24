import type { NextRequest } from "next/server";
import { addLeadInteraction, LEAD_WRITE_ROLES } from "@/modules/crm/lead-service";
import { createLeadInteractionSchema } from "@/modules/crm/lead-schemas";
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

// Registrar interação (§6). A listagem vem embutida em GET /leads/[id].
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertTrustedOrigin(request);
    const identity = await requireAuthenticatedUser();
    requireGlobalRole(identity, ["TRAINER"]);
    const active = await resolveActiveOrganization(identity.userId);
    requireOrgRole(active, LEAD_WRITE_ROLES);
    await enforceRateLimit(crmWriteRateLimiter, `crm-write:${identity.userId}`);

    const { id } = await params;
    const input = await parseJsonBody(request, createLeadInteractionSchema);
    const interaction = await addLeadInteraction(id, input, {
      userId: identity.userId,
      organizationId: active.organizationId,
    });
    return apiSuccess({ interaction }, 201);
  } catch (error) {
    return apiError(error);
  }
}
