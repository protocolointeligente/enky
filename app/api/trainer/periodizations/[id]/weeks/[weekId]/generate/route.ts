import type { NextRequest } from "next/server";
import { prisma } from "@/infrastructure/database/prisma";
import { generateWeekDrafts } from "@/modules/periodization/generate-week";
import { generateWeekInputSchema } from "@/modules/periodization/generation-schema";
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

// Gera os rascunhos de UMA semana da periodização. Nunca publica: a resposta
// devolve os ids em DRAFT para o treinador revisar, editar e publicar pelos
// endpoints de treino já existentes.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; weekId: string }> },
) {
  try {
    assertTrustedOrigin(request);
    const identity = await requireAuthenticatedUser();
    requireGlobalRole(identity, ["TRAINER"]);
    await enforceRateLimit(periodizationWriteRateLimiter, `periodization-write:${identity.userId}`);

    const { organizationId, trainerProfileId } = await trainerActor(identity.userId);
    const { id, weekId } = await params;

    const input = await parseJsonBody(request, generateWeekInputSchema);
    const result = await generateWeekDrafts({ periodizationId: id, weekId }, input, {
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
