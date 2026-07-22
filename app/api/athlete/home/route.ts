import { getAthleteHome } from "@/modules/athletes/get-athlete-home";
import {
  requireAuthenticatedUser,
  requireGlobalRole,
  resolveAthleteOrganization,
} from "@/server/auth/guards";
import { apiError, apiSuccess } from "@/server/http/response";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const identity = await requireAuthenticatedUser();
    requireGlobalRole(identity, ["ATHLETE"]);
    const { organizationId, athleteProfileId } = await resolveAthleteOrganization(identity.userId);

    const home = await getAthleteHome({ organizationId, athleteProfileId });

    return apiSuccess({ home });
  } catch (error) {
    return apiError(error);
  }
}
