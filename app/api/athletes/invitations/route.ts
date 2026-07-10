import type { NextRequest } from "next/server";
import { DevInvitationMailer } from "@/infrastructure/mail/dev-invitation-mailer";
import { prisma } from "@/infrastructure/database/prisma";
import { env } from "@/lib/env";
import { inviteAthlete, inviteAthleteInputSchema } from "@/modules/athletes/invite-athlete";
import {
  requireAuthenticatedUser,
  requireGlobalRole,
  resolveActiveOrganization,
} from "@/server/auth/guards";
import { apiError, apiSuccess } from "@/server/http/response";
import { parseJsonBody } from "@/server/http/parse-body";
import { assertTrustedOrigin } from "@/server/security/csrf";
import { getClientIp } from "@/server/security/ip";
import { enforceRateLimit, inviteRateLimiter } from "@/server/security/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    assertTrustedOrigin(request);
    const identity = await requireAuthenticatedUser();
    requireGlobalRole(identity, ["TRAINER"]);
    const { organizationId } = await resolveActiveOrganization(identity.userId);

    await enforceRateLimit(inviteRateLimiter, `invite:${identity.userId}`);

    const input = await parseJsonBody(request, inviteAthleteInputSchema);
    const trainerProfile = await prisma.trainerProfile.findUniqueOrThrow({
      where: { userId: identity.userId },
    });

    const result = await inviteAthlete(input, {
      userId: identity.userId,
      trainerProfileId: trainerProfile.id,
      organizationId,
      ipAddress: getClientIp(request),
      userAgent: request.headers.get("user-agent") ?? undefined,
    });

    const activationUrl = `${env.APP_URL}/convite/ativar?token=${result.rawToken}`;
    await new DevInvitationMailer().sendInvitation({
      to: input.email,
      athleteName: input.athleteName ?? null,
      trainerName: identity.name,
      activationUrl,
      expiresAt: result.expiresAt,
    });

    return apiSuccess(
      {
        invitationId: result.invitationId,
        athleteProfileId: result.athleteProfileId,
        expiresAt: result.expiresAt,
      },
      201,
    );
  } catch (error) {
    return apiError(error);
  }
}
