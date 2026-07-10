import type { NextRequest } from "next/server";
import { DevInvitationMailer } from "@/infrastructure/mail/dev-invitation-mailer";
import { prisma } from "@/infrastructure/database/prisma";
import { env } from "@/lib/env";
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
    const activationUrl = `${env.APP_URL}/convite/ativar?token=${result.rawToken}`;
    await new DevInvitationMailer().sendInvitation({
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
