import type { NextRequest } from "next/server";
import { messagePageSchema, sendMessageSchema } from "@/modules/messaging/message-schema";
import {
  getAthleteConversation,
  listMessages,
  resolveAthleteTrainer,
  sendMessage,
} from "@/modules/messaging/message-service";
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

export async function GET(request: NextRequest) {
  try {
    const identity = await requireAuthenticatedUser();
    requireGlobalRole(identity, ["ATHLETE"]);
    const { organizationId, athleteProfileId } = await resolveAthleteOrganization(identity.userId);
    const trainerProfileId = await resolveAthleteTrainer(organizationId, athleteProfileId);

    const conversation = await getAthleteConversation(organizationId, athleteProfileId, trainerProfileId);
    const page = messagePageSchema.parse({
      before: new URL(request.url).searchParams.get("before") ?? undefined,
      limit: new URL(request.url).searchParams.get("limit") ?? undefined,
    });
    const { messages, hasMore } = await listMessages(
      conversation.id,
      organizationId,
      "ATHLETE",
      { athleteProfileId },
      page,
    );
    return apiSuccess({ conversation, messages, hasMore });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    assertTrustedOrigin(request);
    const identity = await requireAuthenticatedUser();
    requireGlobalRole(identity, ["ATHLETE"]);
    await enforceRateLimit(feedbackWriteRateLimiter, `message-send:${identity.userId}`);

    const { organizationId, athleteProfileId } = await resolveAthleteOrganization(identity.userId);
    const trainerProfileId = await resolveAthleteTrainer(organizationId, athleteProfileId);
    const { body } = await parseJsonBody(request, sendMessageSchema);
    const message = await sendMessage({
      organizationId,
      trainerProfileId,
      athleteProfileId,
      senderRole: "ATHLETE",
      senderUserId: identity.userId,
      body,
    });
    return apiSuccess({ message });
  } catch (error) {
    return apiError(error);
  }
}
