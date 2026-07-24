import type { NextRequest } from "next/server";
import { updateProfileSchema } from "@/modules/profile/profile-schema";
import { getAthleteProfile, updateAthleteProfile } from "@/modules/profile/profile-service";
import {
  requireAuthenticatedUser,
  requireGlobalRole,
  resolveAthleteOrganization,
} from "@/server/auth/guards";
import { parseJsonBody } from "@/server/http/parse-body";
import { apiError, apiSuccess } from "@/server/http/response";
import { assertTrustedOrigin } from "@/server/security/csrf";
import { enforceRateLimit, feedbackWriteRateLimiter } from "@/server/security/rate-limit";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const identity = await requireAuthenticatedUser();
    requireGlobalRole(identity, ["ATHLETE"]);
    // Garante que é um atleta de organização ativa antes de servir o perfil.
    await resolveAthleteOrganization(identity.userId);
    const profile = await getAthleteProfile(identity.userId);
    return apiSuccess({ profile });
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    assertTrustedOrigin(request);
    const identity = await requireAuthenticatedUser();
    requireGlobalRole(identity, ["ATHLETE"]);
    await enforceRateLimit(feedbackWriteRateLimiter, `profile-write:${identity.userId}`);
    await resolveAthleteOrganization(identity.userId);

    const input = await parseJsonBody(request, updateProfileSchema);
    const profile = await updateAthleteProfile(identity.userId, input);
    return apiSuccess({ profile });
  } catch (error) {
    return apiError(error);
  }
}
