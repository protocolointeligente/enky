import type { NextRequest } from "next/server";
import { prisma } from "@/infrastructure/database/prisma";
import { generateCycleDrafts } from "@/modules/periodization/generate-week";
import { generateInputSchema } from "@/modules/periodization/generation-schema";
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

// Gera os rascunhos do CICLO INTEIRO (scope FULL_CYCLE) — todas as semanas do
// plano de uma vez. Como a rota de semana, não publica nada: devolve DRAFTs.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertTrustedOrigin(request);
    const identity = await requireAuthenticatedUser();
    requireGlobalRole(identity, ["TRAINER"]);
    await enforceRateLimit(periodizationWriteRateLimiter, `periodization-write:${identity.userId}`);

    const { organizationId, trainerProfileId } = await trainerActor(identity.userId);
    const { id } = await params;

    const input = await parseJsonBody(request, generateInputSchema);
    const result = await generateCycleDrafts(id, input, {
      userId: identity.userId,
      organizationId,
      trainerProfileId,
      ipAddress: getClientIp(request),
      userAgent: request.headers.get("user-agent") ?? undefined,
    });

    return apiSuccess(result, 201);
  } catch (error) {
    return apiError(error);
  }
}
