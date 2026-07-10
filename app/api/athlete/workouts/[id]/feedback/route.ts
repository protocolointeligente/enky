import type { NextRequest } from "next/server";
import {
  submitWorkoutFeedback,
  updateWorkoutFeedback,
} from "@/modules/feedback/submit-workout-feedback";
import {
  submitWorkoutFeedbackInputSchema,
  updateWorkoutFeedbackInputSchema,
} from "@/modules/feedback/feedback-schema";
import { requireAuthenticatedUser, requireGlobalRole, resolveAthleteOrganization } from "@/server/auth/guards";
import { parseJsonBody } from "@/server/http/parse-body";
import { apiError, apiSuccess } from "@/server/http/response";
import { assertTrustedOrigin } from "@/server/security/csrf";
import { getClientIp } from "@/server/security/ip";
import { enforceRateLimit, feedbackWriteRateLimiter } from "@/server/security/rate-limit";

export const dynamic = "force-dynamic";

async function resolveAthleteActor(identity: { userId: string }, request: NextRequest) {
  const { organizationId, athleteProfileId } = await resolveAthleteOrganization(identity.userId);
  return {
    userId: identity.userId,
    athleteProfileId,
    organizationId,
    ipAddress: getClientIp(request),
    userAgent: request.headers.get("user-agent") ?? undefined,
  };
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertTrustedOrigin(request);
    const identity = await requireAuthenticatedUser();
    requireGlobalRole(identity, ["ATHLETE"]);

    await enforceRateLimit(feedbackWriteRateLimiter, `feedback-write:${identity.userId}`);

    const { id } = await params;
    const input = await parseJsonBody(request, submitWorkoutFeedbackInputSchema);
    const actor = await resolveAthleteActor(identity, request);

    const feedback = await submitWorkoutFeedback(id, input, actor);

    return apiSuccess({ feedback }, 201);
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertTrustedOrigin(request);
    const identity = await requireAuthenticatedUser();
    requireGlobalRole(identity, ["ATHLETE"]);

    await enforceRateLimit(feedbackWriteRateLimiter, `feedback-write:${identity.userId}`);

    const { id } = await params;
    const input = await parseJsonBody(request, updateWorkoutFeedbackInputSchema);
    const actor = await resolveAthleteActor(identity, request);

    const feedback = await updateWorkoutFeedback(id, input, actor);

    return apiSuccess({ feedback });
  } catch (error) {
    return apiError(error);
  }
}
