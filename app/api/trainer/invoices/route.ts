import type { NextRequest } from "next/server";
import { INVOICE_READ_ROLES, listInvoices } from "@/modules/coach-billing/invoice-service";
import { listInvoicesQuerySchema } from "@/modules/coach-billing/invoice-schemas";
import {
  requireAuthenticatedUser,
  requireGlobalRole,
  requireOrgRole,
  resolveActiveOrganization,
} from "@/server/auth/guards";
import { apiError, apiSuccess } from "@/server/http/response";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const identity = await requireAuthenticatedUser();
    requireGlobalRole(identity, ["TRAINER"]);
    const active = await resolveActiveOrganization(identity.userId);
    requireOrgRole(active, INVOICE_READ_ROLES);

    const params = Object.fromEntries(request.nextUrl.searchParams);
    const filters = listInvoicesQuerySchema.parse(params);
    const result = await listInvoices(filters, {
      userId: identity.userId,
      organizationId: active.organizationId,
    });
    return apiSuccess(result);
  } catch (error) {
    return apiError(error);
  }
}
