import type { NextRequest } from "next/server";
import { prisma } from "@/infrastructure/database/prisma";
import { createWorkoutTemplateInputSchema } from "@/modules/templates/template-schema";
import { createTemplate, listTemplates } from "@/modules/templates/template-service";
import {
  requireAuthenticatedUser,
  requireGlobalRole,
  resolveActiveOrganization,
} from "@/server/auth/guards";
import { parseJsonBody } from "@/server/http/parse-body";
import { apiError, apiSuccess } from "@/server/http/response";
import { assertTrustedOrigin } from "@/server/security/csrf";
import { getClientIp } from "@/server/security/ip";
import { enforceRateLimit, libraryWriteRateLimiter } from "@/server/security/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const identity = await requireAuthenticatedUser();
    requireGlobalRole(identity, ["TRAINER"]);
    const { organizationId } = await resolveActiveOrganization(identity.userId);
    const trainerProfile = await prisma.trainerProfile.findUniqueOrThrow({
      where: { userId: identity.userId },
    });

    const templates = await listTemplates(
      { organizationId, trainerProfileId: trainerProfile.id },
      { includeInactive: request.nextUrl.searchParams.get("includeInactive") === "true" },
    );

    return apiSuccess({ templates });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    assertTrustedOrigin(request);
    const identity = await requireAuthenticatedUser();
    requireGlobalRole(identity, ["TRAINER"]);
    const { organizationId } = await resolveActiveOrganization(identity.userId);

    await enforceRateLimit(libraryWriteRateLimiter, `library-write:${identity.userId}`);

    const input = await parseJsonBody(request, createWorkoutTemplateInputSchema);
    const trainerProfile = await prisma.trainerProfile.findUniqueOrThrow({
      where: { userId: identity.userId },
    });

    const template = await createTemplate(input, {
      userId: identity.userId,
      trainerProfileId: trainerProfile.id,
      organizationId,
      ipAddress: getClientIp(request),
      userAgent: request.headers.get("user-agent") ?? undefined,
    });

    return apiSuccess({ templateId: template.id }, 201);
  } catch (error) {
    return apiError(error);
  }
}
