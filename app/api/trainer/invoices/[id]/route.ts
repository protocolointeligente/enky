import type { NextRequest } from "next/server";
import {
  getInvoice,
  INVOICE_READ_ROLES,
  INVOICE_WRITE_ROLES,
  updateInvoice,
} from "@/modules/coach-billing/invoice-service";
import { updateInvoiceSchema } from "@/modules/coach-billing/invoice-schemas";
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

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const identity = await requireAuthenticatedUser();
    requireGlobalRole(identity, ["TRAINER"]);
    const active = await resolveActiveOrganization(identity.userId);
    requireOrgRole(active, INVOICE_READ_ROLES);

    const { id } = await params;
    const invoice = await getInvoice(id, {
      userId: identity.userId,
      organizationId: active.organizationId,
    });
    return apiSuccess({ invoice });
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertTrustedOrigin(request);
    const identity = await requireAuthenticatedUser();
    requireGlobalRole(identity, ["TRAINER"]);
    const active = await resolveActiveOrganization(identity.userId);
    requireOrgRole(active, INVOICE_WRITE_ROLES);
    await enforceRateLimit(crmWriteRateLimiter, `crm-write:${identity.userId}`);

    const { id } = await params;
    const input = await parseJsonBody(request, updateInvoiceSchema);
    const invoice = await updateInvoice(id, input, {
      userId: identity.userId,
      organizationId: active.organizationId,
      ipAddress: getClientIp(request),
    });
    return apiSuccess({ invoice });
  } catch (error) {
    return apiError(error);
  }
}
