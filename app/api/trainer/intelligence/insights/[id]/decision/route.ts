import type { NextRequest } from "next/server";
import { prisma } from "@/infrastructure/database/prisma";
import { resolveInsightInputSchema } from "@/modules/intelligence/insight-decision-schema";
import { resolveInsight } from "@/modules/intelligence/insight-store";
import {
  requireAuthenticatedUser,
  requireGlobalRole,
  resolveActiveOrganization,
} from "@/server/auth/guards";
import { parseJsonBody } from "@/server/http/parse-body";
import { apiError, apiSuccess } from "@/server/http/response";
import { assertTrustedOrigin } from "@/server/security/csrf";
import { getClientIp } from "@/server/security/ip";
import { enforceRateLimit, intelligenceWriteRateLimiter } from "@/server/security/rate-limit";

export const dynamic = "force-dynamic";

// Treinador aceita/ignora um Insight e/ou registra o resultado (02H). Escopo
// org+treinador validado no serviço — só o dono da carteira decide.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertTrustedOrigin(request);
    const identity = await requireAuthenticatedUser();
    requireGlobalRole(identity, ["TRAINER"]);
    const { organizationId } = await resolveActiveOrganization(identity.userId);

    await enforceRateLimit(intelligenceWriteRateLimiter, `intelligence-write:${identity.userId}`);

    const { id } = await params;
    const input = await parseJsonBody(request, resolveInsightInputSchema);
    const trainerProfile = await prisma.trainerProfile.findUniqueOrThrow({
      where: { userId: identity.userId },
    });

    const insight = await resolveInsight(
      id,
      {
        userId: identity.userId,
        organizationId,
        trainerProfileId: trainerProfile.id,
        ipAddress: getClientIp(request),
        userAgent: request.headers.get("user-agent") ?? undefined,
      },
      input,
      new Date(),
    );

    return apiSuccess({ insight });
  } catch (error) {
    return apiError(error);
  }
}
