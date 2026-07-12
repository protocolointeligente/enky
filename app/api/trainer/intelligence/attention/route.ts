import { prisma } from "@/infrastructure/database/prisma";
import { analyzeRosterAttention } from "@/modules/intelligence/attention";
import { upsertExposedInsights } from "@/modules/intelligence/insight-store";
import {
  requireAuthenticatedUser,
  requireGlobalRole,
  resolveActiveOrganization,
} from "@/server/auth/guards";
import { apiError, apiSuccess } from "@/server/http/response";

export const dynamic = "force-dynamic";

// ENKY Intelligence — atenção da carteira. Escopo por organização + treinador.
// As recomendações são calculadas sob demanda (workouts + feedback); a partir
// do 02H a exposição é gravada e cada Insight volta com seu estado persistido
// (id + aceito/ignorado/resultado) para o ciclo de calibração.
export async function GET() {
  try {
    const identity = await requireAuthenticatedUser();
    requireGlobalRole(identity, ["TRAINER"]);
    const { organizationId } = await resolveActiveOrganization(identity.userId);
    const trainerProfile = await prisma.trainerProfile.findUniqueOrThrow({
      where: { userId: identity.userId },
    });

    const actor = { organizationId, trainerProfileId: trainerProfile.id };
    const computed = await analyzeRosterAttention(actor, new Date());
    const insights = await upsertExposedInsights(actor, computed);

    return apiSuccess({ insights });
  } catch (error) {
    return apiError(error);
  }
}
