import type { NextRequest } from "next/server";
import { createOrderInputSchema } from "@/modules/marketplace-checkout/checkout-schema";
import { createMarketplaceOrder } from "@/modules/marketplace-checkout/checkout-service";
import { requireAuthenticatedUser } from "@/server/auth/guards";
import { parseJsonBody } from "@/server/http/parse-body";
import { apiError, apiSuccess } from "@/server/http/response";
import { assertTrustedOrigin } from "@/server/security/csrf";
import { billingWriteRateLimiter, enforceRateLimit } from "@/server/security/rate-limit";

export const dynamic = "force-dynamic";

// Cria o pedido e abre o checkout. Qualquer usuário autenticado pode comprar
// (comprador = User qualquer, §8) — sem requireGlobalRole.
export async function POST(request: NextRequest) {
  try {
    assertTrustedOrigin(request);
    const identity = await requireAuthenticatedUser();
    await enforceRateLimit(billingWriteRateLimiter, `marketplace-checkout:${identity.userId}`);

    const input = await parseJsonBody(request, createOrderInputSchema);
    const order = await createMarketplaceOrder({
      buyerUserId: identity.userId,
      buyerName: identity.name,
      buyerEmail: identity.email,
      productSlug: input.productSlug,
      idempotencyKey: input.idempotencyKey,
      method: input.method,
    });

    return apiSuccess({ order });
  } catch (error) {
    return apiError(error);
  }
}
