import type { NextRequest } from "next/server";
import { prisma } from "@/infrastructure/database/prisma";
import { messagePageSchema, sendMessageSchema } from "@/modules/messaging/message-schema";
import { getTrainerConversation, listMessages, sendMessage } from "@/modules/messaging/message-service";
import {
  requireAuthenticatedUser,
  requireGlobalRole,
  requireTrainerAccessToAthlete,
  resolveActiveOrganization,
} from "@/server/auth/guards";
import { parseJsonBody } from "@/server/http/parse-body";
import { apiError, apiSuccess } from "@/server/http/response";
import { assertTrustedOrigin } from "@/server/security/csrf";
import { enforceRateLimit, reportWriteRateLimiter } from "@/server/security/rate-limit";

export const dynamic = "force-dynamic";

async function trainerActor(userId: string) {
  const { organizationId } = await resolveActiveOrganization(userId);
  const trainerProfile = await prisma.trainerProfile.findUniqueOrThrow({ where: { userId } });
  return { organizationId, trainerProfileId: trainerProfile.id };
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ athleteId: string }> }) {
  try {
    const identity = await requireAuthenticatedUser();
    requireGlobalRole(identity, ["TRAINER"]);
    const { organizationId, trainerProfileId } = await trainerActor(identity.userId);
    const { athleteId } = await params;
    await requireTrainerAccessToAthlete(organizationId, trainerProfileId, athleteId);

    const conversation = await getTrainerConversation(organizationId, trainerProfileId, athleteId);
    const page = messagePageSchema.parse({
      before: new URL(request.url).searchParams.get("before") ?? undefined,
      limit: new URL(request.url).searchParams.get("limit") ?? undefined,
    });
    const { messages, hasMore } = await listMessages(
      conversation.id,
      organizationId,
      "TRAINER",
      { trainerProfileId },
      page,
    );
    return apiSuccess({ conversation, messages, hasMore });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ athleteId: string }> }) {
  try {
    assertTrustedOrigin(request);
    const identity = await requireAuthenticatedUser();
    requireGlobalRole(identity, ["TRAINER"]);
    await enforceRateLimit(reportWriteRateLimiter, `message-send:${identity.userId}`);

    const { organizationId, trainerProfileId } = await trainerActor(identity.userId);
    const { athleteId } = await params;
    await requireTrainerAccessToAthlete(organizationId, trainerProfileId, athleteId);

    const { body } = await parseJsonBody(request, sendMessageSchema);
    const message = await sendMessage({
      organizationId,
      trainerProfileId,
      athleteProfileId: athleteId,
      senderRole: "TRAINER",
      senderUserId: identity.userId,
      body,
    });
    return apiSuccess({ message });
  } catch (error) {
    return apiError(error);
  }
}
