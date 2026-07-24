import type { NextRequest } from "next/server";
import { prisma } from "@/infrastructure/database/prisma";
import { recordTestResultSchema } from "@/modules/assessments/assessment-schema";
import { listAthleteTestResults, recordTestResult } from "@/modules/assessments/assessment-service";
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

async function trainerActor(userId: string) {
  const { organizationId } = await resolveActiveOrganization(userId);
  const trainerProfile = await prisma.trainerProfile.findUniqueOrThrow({ where: { userId } });
  return { organizationId, trainerProfileId: trainerProfile.id };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ athleteId: string }> },
) {
  try {
    const identity = await requireAuthenticatedUser();
    requireGlobalRole(identity, ["TRAINER"]);
    const { organizationId, trainerProfileId } = await trainerActor(identity.userId);
    const { athleteId } = await params;
    await requireTrainerAccessToAthlete(organizationId, trainerProfileId, athleteId);

    const assessments = await listAthleteTestResults(organizationId, athleteId);
    return apiSuccess({ assessments });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ athleteId: string }> },
) {
  try {
    assertTrustedOrigin(request);
    const identity = await requireAuthenticatedUser();
    requireGlobalRole(identity, ["TRAINER"]);
    await enforceRateLimit(reportWriteRateLimiter, `assessment-write:${identity.userId}`);

    const { organizationId, trainerProfileId } = await trainerActor(identity.userId);
    const { athleteId } = await params;
    await requireTrainerAccessToAthlete(organizationId, trainerProfileId, athleteId);

    const input = await parseJsonBody(request, recordTestResultSchema);
    const assessment = await recordTestResult(athleteId, input, {
      organizationId,
      trainerProfileId,
      userId: identity.userId,
      ipAddress: getClientIp(request),
      userAgent: request.headers.get("user-agent") ?? undefined,
    });
    return apiSuccess({ assessment });
  } catch (error) {
    return apiError(error);
  }
}
