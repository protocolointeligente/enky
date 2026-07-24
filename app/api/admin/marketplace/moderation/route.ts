import type { NextRequest } from "next/server";
import { requireAdminActor } from "@/modules/admin/admin-actor";
import { listModerationQueue } from "@/modules/admin/marketplace-moderation-service";
import { apiError, apiSuccess } from "@/server/http/response";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await requireAdminActor(request);
    const queue = await listModerationQueue();
    return apiSuccess({ queue });
  } catch (error) {
    return apiError(error);
  }
}
