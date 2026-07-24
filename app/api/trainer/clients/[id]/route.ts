import type { NextRequest } from "next/server";
import {
  CLIENT_READ_ROLES,
  CLIENT_WRITE_ROLES,
  getClient,
  updateClient,
} from "@/modules/clients/client-service";
import { updateClientSchema } from "@/modules/clients/client-schemas";
import {
  requireAuthenticatedUser,
  requireGlobalRole,
  requireOrgRole,
  resolveActiveOrganization,
} from "@/server/auth/guards";
import { parseJsonBody } from "@/server/http/parse-body";
import { apiError, apiSuccess } from "@/server/http/response";
import { assertTrustedOrigin } from "@/server/security/csrf";
import { crmWriteRateLimiter, enforceRateLimit } from "@/server/security/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const identity = await requireAuthenticatedUser();
    requireGlobalRole(identity, ["TRAINER"]);
    const active = await resolveActiveOrganization(identity.userId);
    requireOrgRole(active, CLIENT_READ_ROLES);

    const { id } = await params;
    const client = await getClient(id, {
      userId: identity.userId,
      organizationId: active.organizationId,
    });
    return apiSuccess({ client });
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertTrustedOrigin(request);
    const identity = await requireAuthenticatedUser();
    requireGlobalRole(identity, ["TRAINER"]);
    const active = await resolveActiveOrganization(identity.userId);
    requireOrgRole(active, CLIENT_WRITE_ROLES);
    await enforceRateLimit(crmWriteRateLimiter, `crm-write:${identity.userId}`);

    const { id } = await params;
    const input = await parseJsonBody(request, updateClientSchema);
    const client = await updateClient(id, input, {
      userId: identity.userId,
      organizationId: active.organizationId,
    });
    return apiSuccess({ client });
  } catch (error) {
    return apiError(error);
  }
}
