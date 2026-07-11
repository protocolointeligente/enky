import type { NextRequest } from "next/server";
import { listAthleteCalendarWorkouts } from "@/modules/workouts/list-calendar-workouts";
import {
  parseCalendarRange,
  parseModalityParam,
  parseStatusParam,
} from "@/modules/workouts/schedule-schema";
import {
  requireAuthenticatedUser,
  requireGlobalRole,
  resolveAthleteOrganization,
} from "@/server/auth/guards";
import { apiError, apiSuccess } from "@/server/http/response";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const identity = await requireAuthenticatedUser();
    requireGlobalRole(identity, ["ATHLETE"]);
    const { organizationId, athleteProfileId } = await resolveAthleteOrganization(identity.userId);

    const sp = request.nextUrl.searchParams;
    const { from, to } = parseCalendarRange(sp.get("from"), sp.get("to"));

    const workouts = await listAthleteCalendarWorkouts(
      { organizationId, athleteProfileId },
      {
        from,
        to,
        modality: parseModalityParam(sp.get("modality")),
        status: parseStatusParam(sp.get("status")),
      },
    );

    return apiSuccess({ workouts });
  } catch (error) {
    return apiError(error);
  }
}
