import { recordAuditLog } from "@/domain/audit";
import { ConflictError, NotFoundError } from "@/domain/errors";
import { prisma } from "@/infrastructure/database/prisma";

export interface RevokeInvitationActor {
  userId: string;
  organizationId: string;
  ipAddress?: string;
  userAgent?: string;
}

export async function revokeInvitation(
  invitationId: string,
  actor: RevokeInvitationActor,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const current = await tx.athleteInvitation.findUnique({ where: { id: invitationId } });
    if (!current || current.organizationId !== actor.organizationId) {
      throw new NotFoundError("Convite não encontrado.");
    }
    if (current.isConsumed) {
      throw new ConflictError("Este convite já foi utilizado e não pode ser revogado.");
    }
    if (current.isRevoked) {
      return; // idempotente
    }

    await tx.athleteInvitation.update({
      where: { id: current.id },
      data: { isRevoked: true, revokedAt: new Date() },
    });

    await recordAuditLog(tx, {
      action: "REVOKE_INVITATION",
      entityName: "AthleteInvitation",
      entityId: current.id,
      userId: actor.userId,
      organizationId: actor.organizationId,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });
  });
}
