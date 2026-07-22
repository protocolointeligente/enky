import type { NextRequest } from "next/server";
import { createProductSchema } from "@/modules/marketplace-seller/seller-schema";
import { createSellerProduct } from "@/modules/marketplace-seller/seller-service";
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

export async function POST(request: NextRequest) {
  try {
    assertTrustedOrigin(request);
    const identity = await requireAuthenticatedUser();
    requireGlobalRole(identity, ["TRAINER"]);
    await enforceRateLimit(libraryWriteRateLimiter, `marketplace-seller:${identity.userId}`);

    const { organizationId } = await resolveActiveOrganization(identity.userId);
    const input = await parseJsonBody(request, createProductSchema);
    const product = await createSellerProduct({ organizationId, userId: identity.userId }, input);

    return apiSuccess({ product: { id: product.id, slug: product.slug, status: product.status } });
  } catch (error) {
    return apiError(error);
  }
}
