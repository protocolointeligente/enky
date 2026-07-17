import type { NextRequest } from "next/server";
import { requireAdminActor } from "@/modules/admin/admin-actor";
import { getOrganizationDetail } from "@/modules/admin/admin-service";
import { apiError, apiSuccess } from "@/server/http/response";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireAdminActor(request);
    const { id } = await params;

    // Esta leitura grava ADMIN_VIEW_ORGANIZATION na trilha — ver
    // modules/admin/README.md.
    return apiSuccess(await getOrganizationDetail(actor, id));
  } catch (error) {
    return apiError(error);
  }
}
