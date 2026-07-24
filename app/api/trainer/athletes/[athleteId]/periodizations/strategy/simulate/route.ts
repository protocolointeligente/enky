import type { NextRequest } from "next/server";
import { prisma } from "@/infrastructure/database/prisma";
import { simulateStrategyLoad } from "@/modules/load-simulation/load-simulation-service";
import { strategyInputSchema } from "@/modules/periodization-engine/strategy-input-schema";
import {
  requireAuthenticatedUser,
  requireGlobalRole,
  resolveActiveOrganization,
} from "@/server/auth/guards";
import { parseJsonBody } from "@/server/http/parse-body";
import { apiError, apiSuccess } from "@/server/http/response";
import { assertTrustedOrigin } from "@/server/security/csrf";
import { enforceRateLimit, periodizationWriteRateLimiter } from "@/server/security/rate-limit";

export const dynamic = "force-dynamic";

async function trainerActor(userId: string) {
  const { organizationId } = await resolveActiveOrganization(userId);
  const trainerProfile = await prisma.trainerProfile.findUniqueOrThrow({ where: { userId } });
  return { organizationId, trainerProfileId: trainerProfile.id };
}

// SIMULAÇÃO (Fase 6) — projeta CTL/ATL/TSB/volume do plano proposto por cima do
// histórico real do atleta, ANTES de salvar. Preview: não grava nada.
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
    const result = await simulateStrategyLoad(
      athleteId,
      input,
      { userId: identity.userId, organizationId, trainerProfileId },
      new Date(),
    );

    return apiSuccess(result);
  } catch (error) {
    return apiError(error);
  }
}
