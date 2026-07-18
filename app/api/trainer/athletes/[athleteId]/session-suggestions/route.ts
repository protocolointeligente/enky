import type { NextRequest } from "next/server";
import { prisma } from "@/infrastructure/database/prisma";
import { suggestSessionsForWeek } from "@/modules/session-generator/suggestion-service";
import { suggestionInputSchema } from "@/modules/session-generator/suggestion-schema";
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

// Motor de sugestão (Fase 3) — PREVIEW enriquecido de uma semana: quais sessões,
// e para cada uma o porquê, o objetivo, o sistema energético, a adaptação, a
// carga prevista, o risco (contraindicações), a confiança e as referências. NÃO
// grava — é a etapa em que o treinador vê antes de gerar/publicar.
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

    const input = await parseJsonBody(request, suggestionInputSchema);
    const suggestion = await suggestSessionsForWeek(athleteId, input, {
      userId: identity.userId,
      organizationId,
      trainerProfileId,
    });

    return apiSuccess(suggestion);
  } catch (error) {
    return apiError(error);
  }
}
