import type { NextRequest } from "next/server";
import { NotFoundError } from "@/domain/errors";
import { prisma } from "@/infrastructure/database/prisma";
import { ConnectionUnusableError } from "@/modules/integrations/external-connection";
import { getActivityProvider } from "@/modules/integrations/get-activity-provider";
import { importRecentActivities } from "@/modules/integrations/import-activities";
import {
  requireAuthenticatedUser,
  requireGlobalRole,
  resolveAthleteOrganization,
} from "@/server/auth/guards";
import { apiError, apiSuccess } from "@/server/http/response";
import { assertTrustedOrigin } from "@/server/security/csrf";
import { enforceRateLimit, activityImportRateLimiter } from "@/server/security/rate-limit";

export const dynamic = "force-dynamic";

// Importação manual das atividades recentes (item 6). O atleta puxa; não
// esperamos o webhook.
export async function POST(request: NextRequest) {
  try {
    assertTrustedOrigin(request);
    const identity = await requireAuthenticatedUser();
    requireGlobalRole(identity, ["ATHLETE"]);

    await enforceRateLimit(activityImportRateLimiter, `strava-import:${identity.userId}`);

    const { organizationId, athleteProfileId } = await resolveAthleteOrganization(identity.userId);

    const connection = await prisma.externalConnection.findUnique({
      where: { athleteId_provider: { athleteId: athleteProfileId, provider: "STRAVA" } },
      select: { id: true, status: true, providerAthleteId: true },
    });

    if (!connection || connection.status !== "ACTIVE") {
      throw new NotFoundError("Nenhuma conexão ativa com o Strava.");
    }

    const summary = await importRecentActivities(getActivityProvider(), {
      connectionId: connection.id,
      organizationId,
      athleteProfileId,
      providerAthleteId: connection.providerAthleteId,
    });

    return apiSuccess({ summary });
  } catch (error) {
    if (error instanceof ConnectionUnusableError) {
      // A conexão já foi marcada REVOKED pelo módulo. 404 com instrução, e não
      // 502: não há nada quebrado a investigar — o atleta precisa reconectar.
      return apiError(new NotFoundError("Conexão com o Strava expirou. Conecte novamente."));
    }
    return apiError(error);
  }
}
