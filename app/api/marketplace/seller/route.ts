import type { NextRequest } from "next/server";
import { ensureSellerProfileSchema } from "@/modules/marketplace-seller/seller-schema";
import { ensureSellerProfile, getSellerDashboard } from "@/modules/marketplace-seller/seller-service";
import {
  requireAuthenticatedUser,
  requireGlobalRole,
  resolveActiveOrganization,
} from "@/server/auth/guards";
import { parseJsonBody } from "@/server/http/parse-body";
import { apiError, apiSuccess } from "@/server/http/response";
import { assertTrustedOrigin } from "@/server/security/csrf";
import { enforceRateLimit, libraryWriteRateLimiter } from "@/server/security/rate-limit";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const identity = await requireAuthenticatedUser();
    requireGlobalRole(identity, ["TRAINER"]);
    const { organizationId } = await resolveActiveOrganization(identity.userId);

    const dashboard = await getSellerDashboard({ organizationId, userId: identity.userId });
    return apiSuccess({ dashboard });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    assertTrustedOrigin(request);
    const identity = await requireAuthenticatedUser();
    requireGlobalRole(identity, ["TRAINER"]);
    await enforceRateLimit(libraryWriteRateLimiter, `marketplace-seller:${identity.userId}`);

    const { organizationId } = await resolveActiveOrganization(identity.userId);
    const input = await parseJsonBody(request, ensureSellerProfileSchema);
    const profile = await ensureSellerProfile({ organizationId, userId: identity.userId }, input);

    return apiSuccess({ profile: { id: profile.id, slug: profile.slug, displayName: profile.displayName } });
  } catch (error) {
    return apiError(error);
  }
}
