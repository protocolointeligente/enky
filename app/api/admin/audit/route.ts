import type { NextRequest } from "next/server";
import { requireAdminActor } from "@/modules/admin/admin-actor";
import { parseDateFilter, parsePositiveInt } from "@/modules/admin/admin-schema";
import { listAuditTrail } from "@/modules/admin/admin-service";
import { apiError, apiSuccess } from "@/server/http/response";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const actor = await requireAdminActor(request);
    const sp = request.nextUrl.searchParams;

    const result = await listAuditTrail(actor, {
      action: sp.get("action") || undefined,
      organizationId: sp.get("organizationId") || undefined,
      userId: sp.get("userId") || undefined,
      from: parseDateFilter(sp.get("from")),
      to: parseDateFilter(sp.get("to")),
      limit: parsePositiveInt(sp.get("limit")),
      offset: parsePositiveInt(sp.get("offset")),
    });

    return apiSuccess(result);
  } catch (error) {
    return apiError(error);
  }
}
