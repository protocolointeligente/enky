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

// Visão 360º do atleta para o treinador: identidade, plano contratado, plano de
// treino vigente, vínculo e métricas de carga/prontidão/aderência/dor vivas —
// sem exigir gerar relatório. Leitura; guardas de auth/papel/tenant/acesso ao
// atleta antes de qualquer consulta. Consultas escopadas a UM atleta (sem N+1).
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
      select: { id: true, user: { select: { name: true } } },
    });
    const { athleteId } = await params;
    await requireTrainerAccessToAthlete(organizationId, trainerProfile.id, athleteId);

    const now = new Date();

    const [profile, relationship, latestPlan, subscription, metrics] = await Promise.all([
      prisma.athleteProfile.findUniqueOrThrow({
        where: { id: athleteId },
        select: {
          birthDate: true,
          gender: true,
          weightKg: true,
          heightCm: true,
          user: { select: { name: true, email: true } },
        },
      }),
      prisma.coachAthleteRelationship.findFirst({
        where: { organizationId, trainerId: trainerProfile.id, athleteId },
        orderBy: { startedAt: "desc" },
        select: { isActive: true, startedAt: true },
      }),
      prisma.periodization.findFirst({
        where: { organizationId, athleteId, trainerId: trainerProfile.id },
        orderBy: { startDate: "desc" },
        select: { modality: true, goal: true, targetEvent: true, title: true },
      }),
      prisma.subscription.findFirst({
        where: { organizationId },
        orderBy: { createdAt: "desc" },
        select: { status: true, plan: { select: { name: true } } },
      }),
      getAthleteContextMetrics(organizationId, athleteId, now),
    ]);

    return apiSuccess({
      athlete: {
        athleteProfileId: athleteId,
        name: profile.user?.name ?? null,
        email: profile.user?.email ?? null,
        age: ageFromBirthDate(profile.birthDate, now),
        gender: profile.gender,
        weightKg: profile.weightKg != null ? Number(profile.weightKg) : null,
        heightCm: profile.heightCm != null ? Number(profile.heightCm) : null,
      },
      trainer: { name: trainerProfile.user?.name ?? null },
      relationship: relationship
        ? { active: relationship.isActive, startedAt: relationship.startedAt.toISOString() }
        : null,
      plan: latestPlan
        ? {
            modality: latestPlan.modality,
            goal: latestPlan.goal || null,
            targetEvent: latestPlan.targetEvent,
            title: latestPlan.title,
          }
        : null,
      subscription: subscription
        ? { plan: subscription.plan.name, status: subscription.status }
        : null,
      metrics,
    });
  } catch (error) {
    return apiError(error);
  }
}
