import type { NextRequest } from "next/server";
import { updateGoalSchema } from "@/modules/goals/goal-schema";
import { getGoal, updateGoal } from "@/modules/goals/goal-service";
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

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const identity = await requireAuthenticatedUser();
    requireGlobalRole(identity, ["ATHLETE"]);
    const { organizationId, athleteProfileId } = await resolveAthleteOrganization(identity.userId);
    const { id } = await params;
    const goal = await getGoal(id, organizationId, athleteProfileId);
    return apiSuccess({ goal });
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertTrustedOrigin(request);
    const identity = await requireAuthenticatedUser();
    requireGlobalRole(identity, ["ATHLETE"]);
    await enforceRateLimit(feedbackWriteRateLimiter, `goal-write:${identity.userId}`);

    const { organizationId, athleteProfileId } = await resolveAthleteOrganization(identity.userId);
    const { id } = await params;
    const input = await parseJsonBody(request, updateGoalSchema);
    const goal = await updateGoal(id, input, { organizationId, athleteProfileId, userId: identity.userId });
    return apiSuccess({ goal });
  } catch (error) {
    return apiError(error);
  }
}
