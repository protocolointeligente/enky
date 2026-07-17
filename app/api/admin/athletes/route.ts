import type { NextRequest } from "next/server";
import { requireAdminActor } from "@/modules/admin/admin-actor";
import { parsePositiveInt } from "@/modules/admin/admin-schema";
import { listAthletes } from "@/modules/admin/admin-service";
import { apiError, apiSuccess } from "@/server/http/response";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const actor = await requireAdminActor(request);
    const sp = request.nextUrl.searchParams;

    const result = await listAthletes(actor, {
      search: sp.get("search") ?? undefined,
      limit: parsePositiveInt(sp.get("limit")),
      offset: parsePositiveInt(sp.get("offset")),
    });

    return apiSuccess(result);
  } catch (error) {
    return apiError(error);
  }
}
