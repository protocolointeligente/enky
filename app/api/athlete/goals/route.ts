import type { NextRequest } from "next/server";
import { createGoalSchema } from "@/modules/goals/goal-schema";
import { createGoal, listAthleteGoals } from "@/modules/goals/goal-service";
import {
  requireAuthenticatedUser,
  requireGlobalRole,
  resolveAthleteOrganization,
} from "@/server/auth/guards";
import { parseJsonBody } from "@/server/http/parse-body";
import { apiError, apiSuccess } from "@/server/http/response";
import { assertTrustedOrigin } from "@/server/security/csrf";
import { enforceRateLimit, feedbackWriteRateLimiter } from "@/server/security/rate-limit";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const identity = await requireAuthenticatedUser();
    requireGlobalRole(identity, ["ATHLETE"]);
    const { organizationId, athleteProfileId } = await resolveAthleteOrganization(identity.userId);
    const goals = await listAthleteGoals(organizationId, athleteProfileId);
    return apiSuccess({ goals });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    assertTrustedOrigin(request);
    const identity = await requireAuthenticatedUser();
    requireGlobalRole(identity, ["ATHLETE"]);
    await enforceRateLimit(feedbackWriteRateLimiter, `goal-write:${identity.userId}`);

    const { organizationId, athleteProfileId } = await resolveAthleteOrganization(identity.userId);
    const input = await parseJsonBody(request, createGoalSchema);
    const goal = await createGoal(input, {
      organizationId,
      athleteProfileId,
      userId: identity.userId,
    });
    return apiSuccess({ goal });
  } catch (error) {
    return apiError(error);
  }
}
