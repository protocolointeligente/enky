import { after, type NextRequest } from "next/server";
import { prisma } from "@/infrastructure/database/prisma";
import {
  processCycleGeneration,
  startCycleGeneration,
} from "@/modules/periodization/generate-cycle-async";
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

// Geração do CICLO em segundo plano (Fase 9): cria o batch PENDING, devolve o
// batchId na hora (202) e processa DEPOIS da resposta com `after`. O cliente
// acompanha em GET .../batches/[batchId]. Não publica nada — DRAFTs, como o
// caminho síncrono.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertTrustedOrigin(request);
    const identity = await requireAuthenticatedUser();
    requireGlobalRole(identity, ["TRAINER"]);
    await enforceRateLimit(periodizationWriteRateLimiter, `periodization-write:${identity.userId}`);

    const { organizationId, trainerProfileId } = await trainerActor(identity.userId);
    const { id } = await params;
    const input = await parseJsonBody(request, generateInputSchema);

    const actor = {
      userId: identity.userId,
      organizationId,
      trainerProfileId,
      ipAddress: getClientIp(request),
      userAgent: request.headers.get("user-agent") ?? undefined,
    };

    // Falha cedo (acesso, plano sem semanas) ANTES de responder 202 — só
    // enfileira um job que tem o que processar.
    const { batchId } = await startCycleGeneration(id, input, actor);

    // Processa depois da resposta: a UI não espera a persistência do ciclo.
    after(async () => {
      await processCycleGeneration(id, batchId, input, actor);
    });

    return apiSuccess({ batchId }, 202);
  } catch (error) {
    return apiError(error);
  }
}
