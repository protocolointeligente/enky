import type { NextRequest } from "next/server";
import { requireAdminActor } from "@/modules/admin/admin-actor";
import { getPlatformStats } from "@/modules/admin/admin-service";
import { apiError, apiSuccess } from "@/server/http/response";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const stats = await getPlatformStats(await requireAdminActor(request));
    return apiSuccess({ stats });
  } catch (error) {
    return apiError(error);
  }
}
