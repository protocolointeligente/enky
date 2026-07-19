import type { NextRequest } from "next/server";
import {
  createPlan,
  listPlans,
  PLAN_READ_ROLES,
  PLAN_WRITE_ROLES,
} from "@/modules/coach-services/plan-service";
import { createPlanSchema, listPlansQuerySchema } from "@/modules/coach-services/plan-schemas";
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
    requireOrgRole(active, PLAN_READ_ROLES);

    const params = Object.fromEntries(request.nextUrl.searchParams);
    const filters = listPlansQuerySchema.parse(params);
    const result = await listPlans(filters, {
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
    requireOrgRole(active, PLAN_WRITE_ROLES);
    await enforceRateLimit(crmWriteRateLimiter, `crm-write:${identity.userId}`);

    const input = await parseJsonBody(request, createPlanSchema);
    const plan = await createPlan(input, {
      userId: identity.userId,
      organizationId: active.organizationId,
    });
    return apiSuccess({ plan }, 201);
  } catch (error) {
    return apiError(error);
  }
}
