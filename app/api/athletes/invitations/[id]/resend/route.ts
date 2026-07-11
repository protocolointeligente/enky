import type { NextRequest } from "next/server";
import { getInvitationMailer } from "@/infrastructure/mail/get-invitation-mailer";
import { prisma } from "@/infrastructure/database/prisma";
import { getPublicBaseUrl } from "@/lib/env";
import { resendInvitation } from "@/modules/athletes/resend-invitation";
import {
  requireAuthenticatedUser,
  requireGlobalRole,
  resolveActiveOrganization,
} from "@/server/auth/guards";
import { apiError, apiSuccess } from "@/server/http/response";
import { assertTrustedOrigin } from "@/server/security/csrf";
import { getClientIp } from "@/server/security/ip";
import { enforceRateLimit, resendInvitationRateLimiter } from "@/server/security/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertTrustedOrigin(request);
    const identity = await requireAuthenticatedUser();
    requireGlobalRole(identity, ["TRAINER"]);
    const { organizationId } = await resolveActiveOrganization(identity.userId);
    const { id } = await params;

    await enforceRateLimit(resendInvitationRateLimiter, `resend:${id}`);

    const result = await resendInvitation(id, {
      userId: identity.userId,
      organizationId,
      ipAddress: getClientIp(request),
      userAgent: request.headers.get("user-agent") ?? undefined,
    });

    const invitation = await prisma.athleteInvitation.findUniqueOrThrow({ where: { id } });
    const activationUrl = `${getPublicBaseUrl()}/convite/ativar?token=${result.rawToken}`;
    await getInvitationMailer().sendInvitation({
      to: invitation.email,
      trainerName: identity.name,
      activationUrl,
      expiresAt: result.expiresAt,
    });

    return apiSuccess({ invitationId: result.invitationId, expiresAt: result.expiresAt });
  } catch (error) {
    return apiError(error);
  }
}
