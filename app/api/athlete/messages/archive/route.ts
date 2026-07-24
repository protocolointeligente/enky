import type { NextRequest } from "next/server";
import {
  archiveConversation,
  getAthleteConversation,
  resolveAthleteTrainer,
} from "@/modules/messaging/message-service";
import {
  requireAuthenticatedUser,
  requireGlobalRole,
  resolveAthleteOrganization,
} from "@/server/auth/guards";
import { apiError, apiSuccess } from "@/server/http/response";
import { assertTrustedOrigin } from "@/server/security/csrf";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    assertTrustedOrigin(request);
    const identity = await requireAuthenticatedUser();
    requireGlobalRole(identity, ["ATHLETE"]);
    const { organizationId, athleteProfileId } = await resolveAthleteOrganization(identity.userId);
    const trainerProfileId = await resolveAthleteTrainer(organizationId, athleteProfileId);
    const conversation = await getAthleteConversation(organizationId, athleteProfileId, trainerProfileId);
    await archiveConversation(conversation.id, organizationId, "ATHLETE", { athleteProfileId });
    return apiSuccess({ archived: true });
  } catch (error) {
    return apiError(error);
  }
}
