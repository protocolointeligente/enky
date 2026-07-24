import { listTrainers, TEAM_READ_ROLES } from "@/modules/coach-team/team-service";
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
    requireOrgRole(active, TEAM_READ_ROLES);

    const result = await listTrainers({ userId: identity.userId, organizationId: active.organizationId });
    return apiSuccess(result);
  } catch (error) {
    return apiError(error);
  }
}
