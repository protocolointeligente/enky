import type { NextRequest } from "next/server";
import {
  COMM_READ_ROLES,
  COMM_WRITE_ROLES,
  listCommunications,
  logCommunication,
} from "@/modules/communications/communication-service";
import {
  listCommunicationsQuerySchema,
  logCommunicationSchema,
} from "@/modules/communications/communication-schemas";
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
    requireOrgRole(active, COMM_READ_ROLES);

    const filters = listCommunicationsQuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams));
    const result = await listCommunications(filters, {
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
    requireOrgRole(active, COMM_WRITE_ROLES);
    await enforceRateLimit(crmWriteRateLimiter, `crm-write:${identity.userId}`);

    const input = await parseJsonBody(request, logCommunicationSchema);
    const communication = await logCommunication(input, {
      userId: identity.userId,
      organizationId: active.organizationId,
    });
    return apiSuccess({ communication }, 201);
  } catch (error) {
    return apiError(error);
  }
}
