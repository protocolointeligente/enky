import type { NextRequest } from "next/server";
import {
  CLIENT_READ_ROLES,
  CLIENT_WRITE_ROLES,
  createClient,
  listClients,
} from "@/modules/clients/client-service";
import { createClientSchema, listClientsQuerySchema } from "@/modules/clients/client-schemas";
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

export async function GET(request: NextRequest) {
  try {
    const identity = await requireAuthenticatedUser();
    requireGlobalRole(identity, ["TRAINER"]);
    const active = await resolveActiveOrganization(identity.userId);
    requireOrgRole(active, CLIENT_READ_ROLES);

    const params = Object.fromEntries(request.nextUrl.searchParams);
    const filters = listClientsQuerySchema.parse(params);
    const result = await listClients(filters, {
      userId: identity.userId,
      organizationId: active.organizationId,
    });
    return apiSuccess(result);
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    assertTrustedOrigin(request);
    const identity = await requireAuthenticatedUser();
    requireGlobalRole(identity, ["TRAINER"]);
    const active = await resolveActiveOrganization(identity.userId);
    requireOrgRole(active, CLIENT_WRITE_ROLES);
    await enforceRateLimit(crmWriteRateLimiter, `crm-write:${identity.userId}`);

    const input = await parseJsonBody(request, createClientSchema);
    const client = await createClient(input, {
      userId: identity.userId,
      organizationId: active.organizationId,
    });
    return apiSuccess({ client }, 201);
  } catch (error) {
    return apiError(error);
  }
}
