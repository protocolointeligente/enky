import type { NextRequest } from "next/server";
import {
  createLead,
  LEAD_READ_ROLES,
  LEAD_WRITE_ROLES,
  listLeads,
} from "@/modules/crm/lead-service";
import { createLeadSchema, listLeadsQuerySchema } from "@/modules/crm/lead-schemas";
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
    requireOrgRole(active, LEAD_READ_ROLES);

    const params = Object.fromEntries(request.nextUrl.searchParams);
    const filters = listLeadsQuerySchema.parse(params);
    const result = await listLeads(filters, {
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
    requireOrgRole(active, LEAD_WRITE_ROLES);
    await enforceRateLimit(crmWriteRateLimiter, `crm-write:${identity.userId}`);

    const input = await parseJsonBody(request, createLeadSchema);
    const lead = await createLead(input, {
      userId: identity.userId,
      organizationId: active.organizationId,
    });
    return apiSuccess({ lead }, 201);
  } catch (error) {
    return apiError(error);
  }
}
