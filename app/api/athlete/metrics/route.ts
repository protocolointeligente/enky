import { getAthleteMetrics } from "@/modules/metrics/athlete-metrics";
import {
  requireAuthenticatedUser,
  requireGlobalRole,
  resolveAthleteOrganization,
} from "@/server/auth/guards";
import { apiError, apiSuccess } from "@/server/http/response";

export const dynamic = "force-dynamic";

// Janelas do PMC (§10): 4/8/12 semanas, 6 meses, 1 ano. Whitelist para a query
// ficar limitada — `days` fora do conjunto cai no default (12 semanas).
const ALLOWED_DAYS = new Set([28, 56, 84, 182, 365]);
const DEFAULT_DAYS = 84;

export async function GET(request: Request) {
  try {
    const identity = await requireAuthenticatedUser();
    requireGlobalRole(identity, ["ATHLETE"]);
    const { organizationId, athleteProfileId } = await resolveAthleteOrganization(identity.userId);

    const raw = Number(new URL(request.url).searchParams.get("days"));
    const days = ALLOWED_DAYS.has(raw) ? raw : DEFAULT_DAYS;

    const metrics = await getAthleteMetrics(organizationId, athleteProfileId, days);

    return apiSuccess({ metrics });
  } catch (error) {
    return apiError(error);
  }
}
