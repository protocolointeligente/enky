import { listAthleteTestResults } from "@/modules/assessments/assessment-service";
import { requireAuthenticatedUser, requireGlobalRole, resolveAthleteOrganization } from "@/server/auth/guards";
import { apiError, apiSuccess } from "@/server/http/response";

export const dynamic = "force-dynamic";

// Atleta vê as próprias avaliações (§28). Escopo pela identidade autenticada.
export async function GET() {
  try {
    const identity = await requireAuthenticatedUser();
    requireGlobalRole(identity, ["ATHLETE"]);
    const { organizationId, athleteProfileId } = await resolveAthleteOrganization(identity.userId);

    const assessments = await listAthleteTestResults(organizationId, athleteProfileId);
    return apiSuccess({ assessments });
  } catch (error) {
    return apiError(error);
  }
}
