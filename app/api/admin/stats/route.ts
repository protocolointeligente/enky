import { getPlatformStats } from "@/modules/audit/audit-service";
import { requireAuthenticatedUser, requireGlobalRole } from "@/server/auth/guards";
import { apiError, apiSuccess } from "@/server/http/response";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const identity = await requireAuthenticatedUser();
    requireGlobalRole(identity, ["ADMIN", "SUPERADMIN"]);
    const stats = await getPlatformStats();
    return apiSuccess({ stats });
  } catch (error) {
    return apiError(error);
  }
}
