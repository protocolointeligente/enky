import { listAthleteReportDocuments } from "@/modules/reports/report-service";
import {
  requireAuthenticatedUser,
  requireGlobalRole,
  resolveAthleteOrganization,
} from "@/server/auth/guards";
import { apiError, apiSuccess } from "@/server/http/response";

export const dynamic = "force-dynamic";

// Atleta lista os relatórios que o treinador compartilhou com ele — só
// PUBLISHED. Revogado desaparece daqui na mesma hora.
export async function GET() {
  try {
    const identity = await requireAuthenticatedUser();
    requireGlobalRole(identity, ["ATHLETE"]);
    const { organizationId, athleteProfileId } = await resolveAthleteOrganization(identity.userId);

    const reports = await listAthleteReportDocuments(organizationId, athleteProfileId);
    return apiSuccess({ reports });
  } catch (error) {
    return apiError(error);
  }
}
