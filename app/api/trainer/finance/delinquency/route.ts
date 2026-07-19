import { DELINQUENCY_ROLES, listDelinquency } from "@/modules/coach-finance/finance-service";
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
    requireOrgRole(active, DELINQUENCY_ROLES);

    const delinquency = await listDelinquency({
      userId: identity.userId,
      organizationId: active.organizationId,
    });
    return apiSuccess(delinquency);
  } catch (error) {
    return apiError(error);
  }
}
