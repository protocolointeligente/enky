import type { NextRequest } from "next/server";
import { prisma } from "@/infrastructure/database/prisma";
import { getTrainerReportDocument, shareReport } from "@/modules/reports/report-service";
import {
  requireAuthenticatedUser,
  requireGlobalRole,
  resolveActiveOrganization,
} from "@/server/auth/guards";
import { apiError, apiSuccess } from "@/server/http/response";
import { assertTrustedOrigin } from "@/server/security/csrf";
import { getClientIp } from "@/server/security/ip";
import { enforceRateLimit, reportWriteRateLimiter } from "@/server/security/rate-limit";

export const dynamic = "force-dynamic";

// Treinador compartilha o relatório com o atleta (DRAFT → PUBLISHED).
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertTrustedOrigin(request);
    const identity = await requireAuthenticatedUser();
    requireGlobalRole(identity, ["TRAINER"]);
    await enforceRateLimit(reportWriteRateLimiter, `report-write:${identity.userId}`);

    const { organizationId } = await resolveActiveOrganization(identity.userId);
    const trainerProfile = await prisma.trainerProfile.findUniqueOrThrow({
      where: { userId: identity.userId },
    });
    const { id } = await params;

    const actor = {
      userId: identity.userId,
      organizationId,
      trainerProfileId: trainerProfile.id,
      ipAddress: getClientIp(request),
      userAgent: request.headers.get("user-agent") ?? undefined,
    };
    const report = await shareReport(id, actor, new Date());
    const document = await getTrainerReportDocument(id, actor);
    return apiSuccess({ report, document });
  } catch (error) {
    return apiError(error);
  }
}
