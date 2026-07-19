import type { NextRequest } from "next/server";
import { INVOICE_WRITE_ROLES, registerPayment } from "@/modules/coach-billing/invoice-service";
import { registerPaymentSchema } from "@/modules/coach-billing/invoice-schemas";
import {
  requireAuthenticatedUser,
  requireGlobalRole,
  requireOrgRole,
  resolveActiveOrganization,
} from "@/server/auth/guards";
import { parseJsonBody } from "@/server/http/parse-body";
import { apiError, apiSuccess } from "@/server/http/response";
import { assertTrustedOrigin } from "@/server/security/csrf";
import { getClientIp } from "@/server/security/ip";
import { crmWriteRateLimiter, enforceRateLimit } from "@/server/security/rate-limit";

export const dynamic = "force-dynamic";

// Registra uma baixa (parcial ou total). Recalcula o status da fatura.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertTrustedOrigin(request);
    const identity = await requireAuthenticatedUser();
    requireGlobalRole(identity, ["TRAINER"]);
    const active = await resolveActiveOrganization(identity.userId);
    requireOrgRole(active, INVOICE_WRITE_ROLES);
    await enforceRateLimit(crmWriteRateLimiter, `crm-write:${identity.userId}`);

    const { id } = await params;
    const input = await parseJsonBody(request, registerPaymentSchema);
    const invoice = await registerPayment(id, input, {
      userId: identity.userId,
      organizationId: active.organizationId,
      ipAddress: getClientIp(request),
    });
    return apiSuccess({ invoice }, 201);
  } catch (error) {
    return apiError(error);
  }
}
