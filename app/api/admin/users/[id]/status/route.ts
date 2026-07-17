import type { NextRequest } from "next/server";
import { requireAdminActor } from "@/modules/admin/admin-actor";
import { setUserStatusInputSchema } from "@/modules/admin/admin-schema";
import { setUserActive } from "@/modules/admin/admin-service";
import { parseJsonBody } from "@/server/http/parse-body";
import { apiError, apiSuccess } from "@/server/http/response";
import { assertTrustedOrigin } from "@/server/security/csrf";
import { adminWriteRateLimiter, enforceRateLimit } from "@/server/security/rate-limit";

export const dynamic = "force-dynamic";

// PATCH (não DELETE): bloquear é uma mudança de estado reversível, não uma
// remoção. Desbloquear é o mesmo endpoint com `isActive: true`.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertTrustedOrigin(request);
    const actor = await requireAdminActor(request);
    await enforceRateLimit(adminWriteRateLimiter, `admin-write:${actor.userId}`);

    const { id } = await params;
    const input = await parseJsonBody(request, setUserStatusInputSchema);
    const user = await setUserActive(actor, id, input);

    return apiSuccess({ user });
  } catch (error) {
    return apiError(error);
  }
}
