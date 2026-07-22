import type { NextRequest } from "next/server";
import { requireAdminActor } from "@/modules/admin/admin-actor";
import { setOrganizationStatusInputSchema } from "@/modules/admin/admin-schema";
import { setOrganizationActive } from "@/modules/admin/admin-service";
import { parseJsonBody } from "@/server/http/parse-body";
import { apiError, apiSuccess } from "@/server/http/response";
import { assertTrustedOrigin } from "@/server/security/csrf";
import { adminWriteRateLimiter, enforceRateLimit } from "@/server/security/rate-limit";

export const dynamic = "force-dynamic";

// Suspender/reativar: flag reversível, nunca delete. A suspensão passa a valer
// na requisição seguinte do tenant (aplicada em server/auth/guards.ts).
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertTrustedOrigin(request);
    const actor = await requireAdminActor(request);
    await enforceRateLimit(adminWriteRateLimiter, `admin-write:${actor.userId}`);

    const { id } = await params;
    const input = await parseJsonBody(request, setOrganizationStatusInputSchema);
    const organization = await setOrganizationActive(actor, id, input);

    return apiSuccess({ organization });
  } catch (error) {
    return apiError(error);
  }
}
