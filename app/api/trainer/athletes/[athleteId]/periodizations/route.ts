import type { NextRequest } from "next/server";
import { prisma } from "@/infrastructure/database/prisma";
import { createPeriodizationInputSchema } from "@/modules/periodization/periodization-schema";
import {
  createPeriodization,
  listTrainerPeriodizations,
} from "@/modules/periodization/periodization-service";
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
import { enforceRateLimit, periodizationWriteRateLimiter } from "@/server/security/rate-limit";

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

    const periodizations = await listTrainerPeriodizations(athleteId, {
      userId: identity.userId,
      organizationId,
      trainerProfileId,
    });
    return apiSuccess({ periodizations });
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
    await enforceRateLimit(periodizationWriteRateLimiter, `periodization-write:${identity.userId}`);

    const { organizationId, trainerProfileId } = await trainerActor(identity.userId);
    const { athleteId } = await params;
    await requireTrainerAccessToAthlete(organizationId, trainerProfileId, athleteId);

    const input = await parseJsonBody(request, createPeriodizationInputSchema);
    const periodization = await createPeriodization(athleteId, input, {
      userId: identity.userId,
      organizationId,
      trainerProfileId,
      ipAddress: getClientIp(request),
      userAgent: request.headers.get("user-agent") ?? undefined,
    });
    return apiSuccess({ periodization }, 201);
  } catch (error) {
    return apiError(error);
  }
}
