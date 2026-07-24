import type { NextRequest } from "next/server";
import { prisma } from "@/infrastructure/database/prisma";
import { goalCommentSchema } from "@/modules/goals/goal-schema";
import { addTrainerComment } from "@/modules/goals/goal-service";
import {
  requireAuthenticatedUser,
  requireGlobalRole,
  requireTrainerAccessToAthlete,
  resolveActiveOrganization,
} from "@/server/auth/guards";
import { parseJsonBody } from "@/server/http/parse-body";
import { apiError, apiSuccess } from "@/server/http/response";
import { assertTrustedOrigin } from "@/server/security/csrf";
import { getClientIp } from "@/server/security/ip";
import { enforceRateLimit, reportWriteRateLimiter } from "@/server/security/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ athleteId: string; goalId: string }> },
) {
  try {
    assertTrustedOrigin(request);
    const identity = await requireAuthenticatedUser();
    requireGlobalRole(identity, ["TRAINER"]);
    await enforceRateLimit(reportWriteRateLimiter, `goal-comment:${identity.userId}`);

    const { organizationId } = await resolveActiveOrganization(identity.userId);
    const trainerProfile = await prisma.trainerProfile.findUniqueOrThrow({
      where: { userId: identity.userId },
    });
    const { athleteId, goalId } = await params;
    await requireTrainerAccessToAthlete(organizationId, trainerProfile.id, athleteId);

    const { note } = await parseJsonBody(request, goalCommentSchema);
    const goal = await addTrainerComment(goalId, note, {
      organizationId,
      athleteProfileId: athleteId,
      userId: identity.userId,
      ipAddress: getClientIp(request),
      userAgent: request.headers.get("user-agent") ?? undefined,
    });
    return apiSuccess({ goal });
  } catch (error) {
    return apiError(error);
  }
}
