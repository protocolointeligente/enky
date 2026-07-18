import type { NextRequest } from "next/server";
import { prisma } from "@/infrastructure/database/prisma";
import { proposeMacrocycle } from "@/modules/periodization-engine/periodization-engine-service";
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

// PREVIEW do motor estratégico: calcula o macrociclo e devolve a estrutura + o
// porquê SEM gravar nada. Alimenta o "simular antes de salvar" — o treinador vê
// e decide. É uma leitura (não persiste), mas mantém CSRF+rate-limit por ser
// POST e para não abrir um caminho de abuso barato.
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
    const result = await proposeMacrocycle(athleteId, input, {
      userId: identity.userId,
      organizationId,
      trainerProfileId,
    });

    return apiSuccess({
      macrocycle: result.macrocycle,
      mesocycles: result.mesocycles,
      weeks: result.weeks,
      confidence: result.confidence,
      rationale: result.rationale,
    });
  } catch (error) {
    return apiError(error);
  }
}
