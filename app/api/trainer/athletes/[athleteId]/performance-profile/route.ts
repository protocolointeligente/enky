import type { NextRequest } from "next/server";
import { prisma } from "@/infrastructure/database/prisma";
import { getCurrentAthletePerformanceProfile } from "@/modules/assessments/performance-profile";
import {
  requireAuthenticatedUser,
  requireGlobalRole,
  requireTrainerAccessToAthlete,
  resolveActiveOrganization,
} from "@/server/auth/guards";
import { apiError, apiSuccess } from "@/server/http/response";

export const dynamic = "force-dynamic";

// Perfil fisiológico consolidado do atleta (fatia B). Leitura → sem CSRF/rate-limit;
// guardas de auth/papel/tenant/acesso ao atleta antes de qualquer consulta.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ athleteId: string }> },
) {
  try {
    const identity = await requireAuthenticatedUser();
    requireGlobalRole(identity, ["TRAINER"]);
    const { organizationId } = await resolveActiveOrganization(identity.userId);
    const trainerProfile = await prisma.trainerProfile.findUniqueOrThrow({
      where: { userId: identity.userId },
    });
    const { athleteId } = await params;
    await requireTrainerAccessToAthlete(organizationId, trainerProfile.id, athleteId);

    const profile = await getCurrentAthletePerformanceProfile(athleteId, {
      userId: identity.userId,
      organizationId,
      trainerProfileId: trainerProfile.id,
    });
    return apiSuccess({ profile });
  } catch (error) {
    return apiError(error);
  }
}
