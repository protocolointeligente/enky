import type { NextRequest } from "next/server";
import { z } from "zod";
import { NotFoundError } from "@/domain/errors";
import { requireAdminActor } from "@/modules/admin/admin-actor";
import {
  FEATURE_FLAGS,
  setFeatureFlag,
  type FeatureFlagKey,
} from "@/modules/admin/feature-flag-service";
import { parseJsonBody } from "@/server/http/parse-body";
import { apiError, apiSuccess } from "@/server/http/response";
import { assertTrustedOrigin } from "@/server/security/csrf";
import { adminWriteRateLimiter, enforceRateLimit } from "@/server/security/rate-limit";

export const dynamic = "force-dynamic";

const setFlagSchema = z.object({
  enabled: z.boolean(),
  enabledOrganizationIds: z.array(z.string().uuid()).max(500).optional(),
});

// Liga/desliga uma flag (SUPERADMIN, checado no serviço). `key` validada contra
// o catálogo fechado — um slug desconhecido é 404-equivalente, não cria linha.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  try {
    assertTrustedOrigin(request);
    const actor = await requireAdminActor(request);
    await enforceRateLimit(adminWriteRateLimiter, `admin-write:${actor.userId}`);

    const { key } = await params;
    if (!(key in FEATURE_FLAGS)) {
      throw new NotFoundError("Feature flag desconhecida.");
    }
    const input = await parseJsonBody(request, setFlagSchema);
    const flag = await setFeatureFlag(actor, key as FeatureFlagKey, input);
    return apiSuccess({ flag });
  } catch (error) {
    return apiError(error);
  }
}
