import type { NextRequest } from "next/server";
import { listAuditLogs } from "@/modules/audit/audit-service";
import { requireAuthenticatedUser, requireGlobalRole } from "@/server/auth/guards";
import { apiError, apiSuccess } from "@/server/http/response";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const identity = await requireAuthenticatedUser();
    requireGlobalRole(identity, ["ADMIN", "SUPERADMIN"]);

    const action = request.nextUrl.searchParams.get("action") ?? undefined;
    const limitParam = request.nextUrl.searchParams.get("limit");
    const limit = limitParam ? Number(limitParam) : undefined;

    const result = await listAuditLogs({
      action: action || undefined,
      limit: Number.isFinite(limit) ? limit : undefined,
    });
    return apiSuccess(result);
  } catch (error) {
    return apiError(error);
  }
}
