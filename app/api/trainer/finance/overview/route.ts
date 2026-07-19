import { computeIndicators, INDICATORS_ROLES } from "@/modules/coach-finance/finance-service";
import {
  requireAuthenticatedUser,
  requireGlobalRole,
  requireOrgRole,
  resolveActiveOrganization,
} from "@/server/auth/guards";
import { apiError, apiSuccess } from "@/server/http/response";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const identity = await requireAuthenticatedUser();
    requireGlobalRole(identity, ["TRAINER"]);
    const active = await resolveActiveOrganization(identity.userId);
    requireOrgRole(active, INDICATORS_ROLES);

    const indicators = await computeIndicators({
      userId: identity.userId,
      organizationId: active.organizationId,
    });
    return apiSuccess({ indicators });
  } catch (error) {
    return apiError(error);
  }
}
