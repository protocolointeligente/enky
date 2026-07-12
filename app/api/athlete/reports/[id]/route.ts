import type { NextRequest } from "next/server";
import { getAthleteReport } from "@/modules/reports/report-service";
import {
  requireAuthenticatedUser,
  requireGlobalRole,
  resolveAthleteOrganization,
} from "@/server/auth/guards";
import { apiError, apiSuccess } from "@/server/http/response";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const identity = await requireAuthenticatedUser();
    requireGlobalRole(identity, ["ATHLETE"]);
    const { organizationId, athleteProfileId } = await resolveAthleteOrganization(identity.userId);
    const { id } = await params;

    const report = await getAthleteReport(id, organizationId, athleteProfileId);
    return apiSuccess({ report });
  } catch (error) {
    return apiError(error);
  }
}
