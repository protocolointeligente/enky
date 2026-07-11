import type { NextRequest } from "next/server";
import { prisma } from "@/infrastructure/database/prisma";
import { listTrainerCalendarWorkouts } from "@/modules/workouts/list-calendar-workouts";
import {
  parseCalendarRange,
  parseModalityParam,
  parseStatusParam,
} from "@/modules/workouts/schedule-schema";
import {
  requireAuthenticatedUser,
  requireGlobalRole,
  resolveActiveOrganization,
} from "@/server/auth/guards";
import { apiError, apiSuccess } from "@/server/http/response";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const identity = await requireAuthenticatedUser();
    requireGlobalRole(identity, ["TRAINER"]);
    const { organizationId } = await resolveActiveOrganization(identity.userId);
    const trainerProfile = await prisma.trainerProfile.findUniqueOrThrow({
      where: { userId: identity.userId },
    });

    const sp = request.nextUrl.searchParams;
    const { from, to } = parseCalendarRange(sp.get("from"), sp.get("to"));

    const workouts = await listTrainerCalendarWorkouts(
      { organizationId, trainerProfileId: trainerProfile.id },
      {
        from,
        to,
        athleteId: sp.get("athleteId") ?? undefined,
        modality: parseModalityParam(sp.get("modality")),
        status: parseStatusParam(sp.get("status")),
      },
    );

    return apiSuccess({ workouts });
  } catch (error) {
    return apiError(error);
  }
}
