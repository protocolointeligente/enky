import type { NextRequest } from "next/server";
import { globalSearch, SEARCH_ROLES } from "@/modules/coach-search/search-service";
import {
  requireAuthenticatedUser,
  requireGlobalRole,
  requireOrgRole,
  resolveActiveOrganization,
} from "@/server/auth/guards";
import { apiError, apiSuccess } from "@/server/http/response";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const identity = await requireAuthenticatedUser();
    requireGlobalRole(identity, ["TRAINER"]);
    const active = await resolveActiveOrganization(identity.userId);
    requireOrgRole(active, SEARCH_ROLES);

    const q = request.nextUrl.searchParams.get("q") ?? "";
    const results = await globalSearch(q, {
      userId: identity.userId,
      organizationId: active.organizationId,
    });
    return apiSuccess(results);
  } catch (error) {
    return apiError(error);
  }
}
