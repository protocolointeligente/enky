import type { NextRequest } from "next/server";
import {
  startCheckoutInputSchema,
  startSubscriptionCheckout,
} from "@/modules/subscriptions/subscription-service";
import {
  requireAuthenticatedUser,
  requireGlobalRole,
  resolveActiveOrganization,
} from "@/server/auth/guards";
import { parseJsonBody } from "@/server/http/parse-body";
import { apiError, apiSuccess } from "@/server/http/response";
import { assertTrustedOrigin } from "@/server/security/csrf";
import { getClientIp } from "@/server/security/ip";
import { billingWriteRateLimiter, enforceRateLimit } from "@/server/security/rate-limit";

export const dynamic = "force-dynamic";

// O corpo aceito aqui é `{ planSlug, taxId }` — não existe campo de preço.
// Ver o comentário de `startCheckoutInputSchema`: o servidor lê o preço do
// catálogo, então o cliente escolhe o plano, nunca o valor.
export async function POST(request: NextRequest) {
  try {
    assertTrustedOrigin(request);
    const identity = await requireAuthenticatedUser();
    requireGlobalRole(identity, ["TRAINER"]);
    const { organizationId } = await resolveActiveOrganization(identity.userId);

    await enforceRateLimit(billingWriteRateLimiter, `billing-write:${identity.userId}`);

    const input = await parseJsonBody(request, startCheckoutInputSchema);
    const result = await startSubscriptionCheckout(input, {
      userId: identity.userId,
      organizationId,
      ipAddress: getClientIp(request),
      userAgent: request.headers.get("user-agent") ?? undefined,
    });

    return apiSuccess(result, 201);
  } catch (error) {
    return apiError(error);
  }
}
