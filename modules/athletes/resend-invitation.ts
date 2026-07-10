import { recordAuditLog } from "@/domain/audit";
import { ConflictError, NotFoundError } from "@/domain/errors";
import { prisma } from "@/infrastructure/database/prisma";
import {
  generateInvitationToken,
  hashInvitationToken,
  INVITATION_TTL_MS,
} from "./invitation-token";

export interface ResendInvitationActor {
  userId: string;
  organizationId: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface ResendInvitationResult {
  invitationId: string;
  rawToken: string;
  expiresAt: Date;
}

export async function resendInvitation(
  invitationId: string,
  actor: ResendInvitationActor,
): Promise<ResendInvitationResult> {
  const rawToken = generateInvitationToken();
  const expiresAt = new Date(Date.now() + INVITATION_TTL_MS);

  const invitation = await prisma.$transaction(async (tx) => {
    const current = await tx.athleteInvitation.findUnique({ where: { id: invitationId } });
    if (!current || current.organizationId !== actor.organizationId) {
      throw new NotFoundError("Convite não encontrado.");
    }
    if (current.isConsumed) {
      throw new ConflictError("Este convite já foi utilizado e não pode ser reenviado.");
    }
    if (current.isRevoked) {
      throw new ConflictError("Este convite foi revogado e não pode ser reenviado.");
    }

    const updated = await tx.athleteInvitation.update({
      where: { id: current.id },
      data: {
        tokenHash: hashInvitationToken(rawToken),
        expiresAt,
        resentCount: { increment: 1 },
        lastSentAt: new Date(),
      },
    });

    await recordAuditLog(tx, {
      action: "RESEND_INVITATION",
      entityName: "AthleteInvitation",
      entityId: updated.id,
      userId: actor.userId,
      organizationId: actor.organizationId,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    return updated;
  });

  return { invitationId: invitation.id, rawToken, expiresAt };
}
