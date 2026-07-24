import type { NextRequest } from "next/server";
import { prisma } from "@/infrastructure/database/prisma";
import { archiveConversation, getTrainerConversation } from "@/modules/messaging/message-service";
import {
  requireAuthenticatedUser,
  requireGlobalRole,
  requireTrainerAccessToAthlete,
  resolveActiveOrganization,
} from "@/server/auth/guards";
import { apiError, apiSuccess } from "@/server/http/response";
import { assertTrustedOrigin } from "@/server/security/csrf";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: Promise<{ athleteId: string }> }) {
  try {
    assertTrustedOrigin(request);
    const identity = await requireAuthenticatedUser();
    requireGlobalRole(identity, ["TRAINER"]);
    const { organizationId } = await resolveActiveOrganization(identity.userId);
    const trainerProfile = await prisma.trainerProfile.findUniqueOrThrow({
      where: { userId: identity.userId },
    });
    const { athleteId } = await params;
    await requireTrainerAccessToAthlete(organizationId, trainerProfile.id, athleteId);

    const conversation = await getTrainerConversation(organizationId, trainerProfile.id, athleteId);
    await archiveConversation(conversation.id, organizationId, "TRAINER", {
      trainerProfileId: trainerProfile.id,
    });
    return apiSuccess({ archived: true });
  } catch (error) {
    return apiError(error);
  }
}
