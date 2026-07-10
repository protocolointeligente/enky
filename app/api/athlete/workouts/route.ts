import { listAthleteWorkouts } from "@/modules/workouts/get-athlete-workout";
import { requireAuthenticatedUser, requireGlobalRole, resolveAthleteOrganization } from "@/server/auth/guards";
import { apiError, apiSuccess } from "@/server/http/response";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const identity = await requireAuthenticatedUser();
    requireGlobalRole(identity, ["ATHLETE"]);
    const { organizationId, athleteProfileId } = await resolveAthleteOrganization(identity.userId);

    const workouts = await listAthleteWorkouts({ organizationId, athleteProfileId });

    return apiSuccess({ workouts });
  } catch (error) {
    return apiError(error);
  }
}
