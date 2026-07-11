import type { NextRequest } from "next/server";
import { prisma } from "@/infrastructure/database/prisma";
import { saveWorkoutAsTemplateInputSchema } from "@/modules/templates/template-schema";
import { saveWorkoutAsTemplate } from "@/modules/templates/template-service";
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

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertTrustedOrigin(request);
    const identity = await requireAuthenticatedUser();
    requireGlobalRole(identity, ["TRAINER"]);
    const { organizationId } = await resolveActiveOrganization(identity.userId);

    await enforceRateLimit(libraryWriteRateLimiter, `library-write:${identity.userId}`);

    const { id } = await params;
    const input = await parseJsonBody(request, saveWorkoutAsTemplateInputSchema);
    const trainerProfile = await prisma.trainerProfile.findUniqueOrThrow({
      where: { userId: identity.userId },
    });

    const template = await saveWorkoutAsTemplate(id, input, {
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
