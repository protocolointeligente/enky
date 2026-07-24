import type { NextRequest } from "next/server";
import { prisma } from "@/infrastructure/database/prisma";
import { saveMacrocyclePlan } from "@/modules/periodization-engine/periodization-engine-service";
import { strategyInputSchema } from "@/modules/periodization-engine/strategy-input-schema";
import {
  requireAuthenticatedUser,
  requireGlobalRole,
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

// SALVA a proposta do motor estratégico como periodização-RASCUNHO (fases +
// semanas + racionalização). Não publica treino nem ativa plano — o treinador
// revisa e depois gera as sessões (que também nascem DRAFT).
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

    const input = await parseJsonBody(request, strategyInputSchema);
    const { periodization, confidence } = await saveMacrocyclePlan(athleteId, input, {
      userId: identity.userId,
      organizationId,
      trainerProfileId,
      ipAddress: getClientIp(request),
      userAgent: request.headers.get("user-agent") ?? undefined,
    });

    return apiSuccess({ periodization: { id: periodization.id }, confidence }, 201);
  } catch (error) {
    return apiError(error);
  }
}
