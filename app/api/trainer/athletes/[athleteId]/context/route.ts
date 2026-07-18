import { prisma } from "@/infrastructure/database/prisma";
import { ageFromBirthDate, getAthleteContextMetrics } from "@/modules/intelligence/athlete-context";
import {
  requireAuthenticatedUser,
  requireGlobalRole,
  requireTrainerAccessToAthlete,
  resolveActiveOrganization,
} from "@/server/auth/guards";
import { apiError, apiSuccess } from "@/server/http/response";

export const dynamic = "force-dynamic";

// Contexto 360º do atleta (cabeçalho do calendário / página do atleta):
// identidade + plano vigente + métricas de carga/prontidão vivas. Leitura,
// então sem CSRF/rate-limit; guardas de auth/papel/tenant/acesso ao atleta
// aplicadas antes de qualquer consulta.
export async function GET(
  _request: Request,
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

    const now = new Date();

    const profile = await prisma.athleteProfile.findUniqueOrThrow({
      where: { id: athleteId },
      select: {
        birthDate: true,
        user: { select: { name: true, email: true } },
      },
    });

    // Modalidade/objetivo/prova-alvo vêm do plano mais recente do atleta.
    const latestPlan = await prisma.periodization.findFirst({
      where: { organizationId, athleteId, trainerId: trainerProfile.id },
      orderBy: { startDate: "desc" },
      select: { modality: true, goal: true, targetEvent: true, title: true },
    });

    const metrics = await getAthleteContextMetrics(organizationId, athleteId, now);

    return apiSuccess({
      athlete: {
        athleteProfileId: athleteId,
        name: profile.user?.name ?? null,
        email: profile.user?.email ?? null,
        age: ageFromBirthDate(profile.birthDate, now),
      },
      plan: latestPlan
        ? {
            modality: latestPlan.modality,
            goal: latestPlan.goal || null,
            targetEvent: latestPlan.targetEvent,
            title: latestPlan.title,
          }
        : null,
      metrics,
    });
  } catch (error) {
    return apiError(error);
  }
}
