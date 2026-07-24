import type { NextRequest } from "next/server";
import { requireAdminActor } from "@/modules/admin/admin-actor";
import { getCommercialDashboard } from "@/modules/admin/marketplace-dashboard";
import { apiError, apiSuccess } from "@/server/http/response";

export const dynamic = "force-dynamic";

const ALLOWED_DAYS = new Set([7, 30, 90, 365]);

export async function GET(request: NextRequest) {
  try {
    await requireAdminActor(request);
    const raw = Number(new URL(request.url).searchParams.get("days"));
    const days = ALLOWED_DAYS.has(raw) ? raw : 30;
    const dashboard = await getCommercialDashboard(days);
    return apiSuccess({ dashboard });
  } catch (error) {
    return apiError(error);
  }
}
