import type { NextRequest } from "next/server";
import { prisma } from "@/infrastructure/database/prisma";
import { analyzeTrainingWeek } from "@/modules/adaptation-engine/analyze-training-week";
import {
  requireAuthenticatedUser,
  requireGlobalRole,
  resolveActiveOrganization,
} from "@/server/auth/guards";
import { apiError, apiSuccess } from "@/server/http/response";

export const dynamic = "force-dynamic";

async function trainerActor(userId: string) {
  const { organizationId } = await resolveActiveOrganization(userId);
  const trainerProfile = await prisma.trainerProfile.findUniqueOrThrow({ where: { userId } });
  return { organizationId, trainerProfileId: trainerProfile.id };
}

// Recálculo da semana (Fase 4) sobre os treinos REAIS já agendados nela — o
// treinador edita/gera treinos e reconfere carga, polarização e alertas da
// semana. Só leitura; escopo org+treinador via periodização.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; weekId: string }> },
) {
  try {
    const identity = await requireAuthenticatedUser();
    requireGlobalRole(identity, ["TRAINER"]);
    const { organizationId, trainerProfileId } = await trainerActor(identity.userId);
    const { id, weekId } = await params;

    const result = await analyzeTrainingWeek(id, weekId, {
      userId: identity.userId,
      organizationId,
      trainerProfileId,
    });

    return apiSuccess(result);
  } catch (error) {
    return apiError(error);
  }
}
