import type { NextRequest } from "next/server";
import { z } from "zod";
import { commitClientsImport, IMPORT_ROLES, previewClientsImport } from "@/modules/coach-import/import-service";
import {
  requireAuthenticatedUser,
  requireGlobalRole,
  requireOrgRole,
  resolveActiveOrganization,
} from "@/server/auth/guards";
import { parseJsonBody } from "@/server/http/parse-body";
import { apiError, apiSuccess } from "@/server/http/response";
import { assertTrustedOrigin } from "@/server/security/csrf";
import { getClientIp } from "@/server/security/ip";
import { crmWriteRateLimiter, enforceRateLimit } from "@/server/security/rate-limit";

export const dynamic = "force-dynamic";

// `preview: true` valida sem escrever; caso contrário, importa as linhas válidas.
const schema = z.object({ csv: z.string().min(1).max(2_000_000), preview: z.boolean().optional() });

export async function POST(request: NextRequest) {
  try {
    assertTrustedOrigin(request);
    const identity = await requireAuthenticatedUser();
    requireGlobalRole(identity, ["TRAINER"]);
    const active = await resolveActiveOrganization(identity.userId);
    requireOrgRole(active, IMPORT_ROLES);
    await enforceRateLimit(crmWriteRateLimiter, `crm-write:${identity.userId}`);

    const { csv, preview } = await parseJsonBody(request, schema);
    if (preview) {
      return apiSuccess(previewClientsImport(csv));
    }
    const result = await commitClientsImport(csv, {
      userId: identity.userId,
      organizationId: active.organizationId,
      ipAddress: getClientIp(request),
    });
    return apiSuccess(result, 201);
  } catch (error) {
    return apiError(error);
  }
}
