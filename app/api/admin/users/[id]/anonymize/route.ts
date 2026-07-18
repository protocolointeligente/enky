import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdminActor } from "@/modules/admin/admin-actor";
import { anonymizeUserData } from "@/modules/admin/lgpd-service";
import { parseJsonBody } from "@/server/http/parse-body";
import { apiError, apiSuccess } from "@/server/http/response";
import { assertTrustedOrigin } from "@/server/security/csrf";
import { adminWriteRateLimiter, enforceRateLimit } from "@/server/security/rate-limit";

export const dynamic = "force-dynamic";

const anonymizeSchema = z.object({
  reason: z.string().trim().min(3, "Informe a justificativa do pedido.").max(500),
});

// LGPD — direito ao esquecimento. Irreversível na prática (pseudonimiza +
// apaga saúde/biometria), por isso exige justificativa e é auditado.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertTrustedOrigin(request);
    const actor = await requireAdminActor(request);
    await enforceRateLimit(adminWriteRateLimiter, `admin-write:${actor.userId}`);

    const { id } = await params;
    const input = await parseJsonBody(request, anonymizeSchema);
    const result = await anonymizeUserData(actor, id, input);
    return apiSuccess({ result });
  } catch (error) {
    return apiError(error);
  }
}
