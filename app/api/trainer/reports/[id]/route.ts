import type { NextRequest } from "next/server";
import { prisma } from "@/infrastructure/database/prisma";
import { getTrainerReport, getTrainerReportDocument } from "@/modules/reports/report-service";
import {
  requireAuthenticatedUser,
  requireGlobalRole,
  resolveActiveOrganization,
} from "@/server/auth/guards";
import { apiError, apiSuccess } from "@/server/http/response";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const identity = await requireAuthenticatedUser();
    requireGlobalRole(identity, ["TRAINER"]);
    const { organizationId } = await resolveActiveOrganization(identity.userId);
    const trainerProfile = await prisma.trainerProfile.findUniqueOrThrow({
      where: { userId: identity.userId },
    });
    const { id } = await params;

    const actor = {
      userId: identity.userId,
      organizationId,
      trainerProfileId: trainerProfile.id,
    };
    const report = await getTrainerReport(id, actor);
    const document = await getTrainerReportDocument(id, actor);
    return apiSuccess({ report, document });
  } catch (error) {
    return apiError(error);
  }
}
