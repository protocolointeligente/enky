import type { NextRequest } from "next/server";
import { requireAdminActor } from "@/modules/admin/admin-actor";
import {
  parsePositiveInt,
  parseRoleFilter,
  parseUserStatusFilter,
} from "@/modules/admin/admin-schema";
import { listUsers } from "@/modules/admin/admin-service";
import { apiError, apiSuccess } from "@/server/http/response";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const actor = await requireAdminActor(request);
    const sp = request.nextUrl.searchParams;

    const result = await listUsers(actor, {
      search: sp.get("search") ?? undefined,
      role: parseRoleFilter(sp.get("role")),
      status: parseUserStatusFilter(sp.get("status")),
      limit: parsePositiveInt(sp.get("limit")),
      offset: parsePositiveInt(sp.get("offset")),
    });

    return apiSuccess(result);
  } catch (error) {
    return apiError(error);
  }
}
