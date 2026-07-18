import type { NextRequest } from "next/server";
import { requireAdminActor } from "@/modules/admin/admin-actor";
import { listFeatureFlags } from "@/modules/admin/feature-flag-service";
import { apiError, apiSuccess } from "@/server/http/response";

export const dynamic = "force-dynamic";

// Lista as feature flags. O serviço exige SUPERADMIN (a rota deixa ADMIN chegar
// ao serviço, e é o serviço que recusa — fronteira única de autorização).
export async function GET(request: NextRequest) {
  try {
    const actor = await requireAdminActor(request);
    const flags = await listFeatureFlags(actor);
    return apiSuccess({ flags });
  } catch (error) {
    return apiError(error);
  }
}
