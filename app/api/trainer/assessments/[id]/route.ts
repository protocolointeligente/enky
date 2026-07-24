import type { NextRequest } from "next/server";
import { prisma } from "@/infrastructure/database/prisma";
import { createAssessmentInputSchema } from "@/modules/assessments/assessment-schema";
import { getAssessment, updateAssessmentDraft } from "@/modules/assessments/assessment-service";
import {
  requireAuthenticatedUser,
  requireGlobalRole,
  resolveActiveOrganization,
} from "@/server/auth/guards";
import { parseJsonBody } from "@/server/http/parse-body";
import { apiError, apiSuccess } from "@/server/http/response";
import { assertTrustedOrigin } from "@/server/security/csrf";
import { getClientIp } from "@/server/security/ip";
import { assessmentWriteRateLimiter, enforceRateLimit } from "@/server/security/rate-limit";

export const dynamic = "force-dynamic";

async function trainerActor(userId: string) {
  const { organizationId } = await resolveActiveOrganization(userId);
  const trainerProfile = await prisma.trainerProfile.findUniqueOrThrow({ where: { userId } });
  return { organizationId, trainerProfileId: trainerProfile.id };
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const identity = await requireAuthenticatedUser();
    requireGlobalRole(identity, ["TRAINER"]);
    const { organizationId, trainerProfileId } = await trainerActor(identity.userId);
    const { id } = await params;
    const assessment = await getAssessment(id, {
      userId: identity.userId,
      organizationId,
      trainerProfileId,
    });
    return apiSuccess({ assessment });
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertTrustedOrigin(request);
    const identity = await requireAuthenticatedUser();
    requireGlobalRole(identity, ["TRAINER"]);
    await enforceRateLimit(assessmentWriteRateLimiter, `assessment-write:${identity.userId}`);

    const { organizationId, trainerProfileId } = await trainerActor(identity.userId);
    const { id } = await params;
    const input = await parseJsonBody(request, createAssessmentInputSchema);
    const assessment = await updateAssessmentDraft(id, input, {
      userId: identity.userId,
      organizationId,
      trainerProfileId,
      ipAddress: getClientIp(request),
      userAgent: request.headers.get("user-agent") ?? undefined,
    });
    return apiSuccess({ assessment });
  } catch (error) {
    return apiError(error);
  }
}
