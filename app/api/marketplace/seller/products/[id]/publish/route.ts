import type { NextRequest } from "next/server";
import { publishSellerProduct } from "@/modules/marketplace-seller/seller-service";
import {
  requireAuthenticatedUser,
  requireGlobalRole,
  resolveActiveOrganization,
} from "@/server/auth/guards";
import { apiError, apiSuccess } from "@/server/http/response";
import { assertTrustedOrigin } from "@/server/security/csrf";
import { enforceRateLimit, libraryWriteRateLimiter } from "@/server/security/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertTrustedOrigin(request);
    const identity = await requireAuthenticatedUser();
    requireGlobalRole(identity, ["TRAINER"]);
    await enforceRateLimit(libraryWriteRateLimiter, `marketplace-seller:${identity.userId}`);

    const { organizationId } = await resolveActiveOrganization(identity.userId);
    const { id } = await params;
    const result = await publishSellerProduct(id, { organizationId, userId: identity.userId });

    return apiSuccess({ published: result });
  } catch (error) {
    return apiError(error);
  }
}
