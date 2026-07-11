import { prisma } from "@/infrastructure/database/prisma";
import { analyzeRosterAttention } from "@/modules/intelligence/attention";
import {
  requireAuthenticatedUser,
  requireGlobalRole,
  resolveActiveOrganization,
} from "@/server/auth/guards";
import { apiError, apiSuccess } from "@/server/http/response";

export const dynamic = "force-dynamic";

// ENKY Intelligence — atenção da carteira. Somente leitura, escopo por
// organização + treinador. As recomendações vivem em memória (Fase I sem
// migration): calculadas sob demanda a partir de workouts + feedback.
export async function GET() {
  try {
    const identity = await requireAuthenticatedUser();
    requireGlobalRole(identity, ["TRAINER"]);
    const { organizationId } = await resolveActiveOrganization(identity.userId);
    const trainerProfile = await prisma.trainerProfile.findUniqueOrThrow({
      where: { userId: identity.userId },
    });

    const insights = await analyzeRosterAttention(
      { organizationId, trainerProfileId: trainerProfile.id },
      new Date(),
    );

    return apiSuccess({ insights });
  } catch (error) {
    return apiError(error);
  }
}
