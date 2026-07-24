import { prisma } from "@/infrastructure/database/prisma";
import { listTrainerConversations } from "@/modules/messaging/message-service";
import {
  requireAuthenticatedUser,
  requireGlobalRole,
  resolveActiveOrganization,
} from "@/server/auth/guards";
import { apiError, apiSuccess } from "@/server/http/response";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const identity = await requireAuthenticatedUser();
    requireGlobalRole(identity, ["TRAINER"]);
    const { organizationId } = await resolveActiveOrganization(identity.userId);
    const trainerProfile = await prisma.trainerProfile.findUniqueOrThrow({
      where: { userId: identity.userId },
    });
    const conversations = await listTrainerConversations(organizationId, trainerProfile.id);
    return apiSuccess({ conversations });
  } catch (error) {
    return apiError(error);
  }
}
