import type { NextRequest } from "next/server";
import { ValidationError } from "@/domain/errors";
import { prisma } from "@/infrastructure/database/prisma";
import { getPlannedVsActual } from "@/modules/integrations/planned-vs-actual";
import {
  requireAuthenticatedUser,
  requireGlobalRole,
  requireTrainerAccessToAthlete,
  resolveActiveOrganization,
} from "@/server/auth/guards";
import { apiError, apiSuccess } from "@/server/http/response";

export const dynamic = "force-dynamic";

const DEFAULT_WINDOW_DAYS = 28;

// "YYYY-MM-DD" → Date em UTC meia-noite, para comparar com colunas DATE
// (`Workout.plannedDate`, `ExternalActivity.localDate`), que não têm fuso.
function parseDateParam(value: string | null, fallback: Date): Date {
  if (!value) return fallback;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new ValidationError("Data inválida — use o formato AAAA-MM-DD.");
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw new ValidationError("Data inválida.");
  }
  return parsed;
}

// Planejado × Realizado de um atleta — o critério de aceite da Fase 11.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ athleteId: string }> },
) {
  try {
    const identity = await requireAuthenticatedUser();
    requireGlobalRole(identity, ["TRAINER"]);

    const { athleteId } = await params;
    const { organizationId } = await resolveActiveOrganization(identity.userId);

    const trainerProfile = await prisma.trainerProfile.findUnique({
      where: { userId: identity.userId },
      select: { id: true },
    });
    if (!trainerProfile) {
      throw new ValidationError("Usuário não possui perfil de treinador.");
    }

    // A fronteira de autorização: treinador só lê atleta com vínculo ATIVO na
    // sua organização. O módulo de leitura não a repete — ela é aqui.
    await requireTrainerAccessToAthlete(organizationId, trainerProfile.id, athleteId);

    const to = parseDateParam(request.nextUrl.searchParams.get("to"), new Date());
    const from = parseDateParam(
      request.nextUrl.searchParams.get("from"),
      new Date(to.getTime() - DEFAULT_WINDOW_DAYS * 24 * 60 * 60 * 1000),
    );
    if (from > to) {
      throw new ValidationError("A data inicial não pode ser posterior à final.");
    }

    const view = await getPlannedVsActual(organizationId, athleteId, from, to);
    return apiSuccess(view);
  } catch (error) {
    return apiError(error);
  }
}
