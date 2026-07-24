import type { NextRequest } from "next/server";
import { z } from "zod";
import { anonymizeClient, exportClientData, LGPD_ROLES } from "@/modules/coach-lgpd/lgpd-service";
import { ValidationError } from "@/domain/errors";
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

// GET = exportar dados comerciais do titular (§29). Auditado no serviço.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const identity = await requireAuthenticatedUser();
    requireGlobalRole(identity, ["TRAINER"]);
    const active = await resolveActiveOrganization(identity.userId);
    requireOrgRole(active, LGPD_ROLES);

    const { id } = await params;
    const data = await exportClientData(id, { userId: identity.userId, organizationId: active.organizationId });
    return apiSuccess(data);
  } catch (error) {
    return apiError(error);
  }
}

// POST { action: "anonymize" } = anonimizar o cliente (preserva o financeiro).
const schema = z.object({ action: z.literal("anonymize") });

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertTrustedOrigin(request);
    const identity = await requireAuthenticatedUser();
    requireGlobalRole(identity, ["TRAINER"]);
    const active = await resolveActiveOrganization(identity.userId);
    requireOrgRole(active, LGPD_ROLES);
    await enforceRateLimit(crmWriteRateLimiter, `crm-write:${identity.userId}`);

    const { action } = await parseJsonBody(request, schema);
    if (action !== "anonymize") throw new ValidationError("Ação inválida.");

    const { id } = await params;
    const result = await anonymizeClient(id, {
      userId: identity.userId,
      organizationId: active.organizationId,
      ipAddress: getClientIp(request),
    });
    return apiSuccess(result);
  } catch (error) {
    return apiError(error);
  }
}
