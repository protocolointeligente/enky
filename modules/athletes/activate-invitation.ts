import { Prisma } from "@prisma/client";
import { z } from "zod";
import { recordAuditLog } from "@/domain/audit";
import { ConflictError, NotFoundError } from "@/domain/errors";
import { prisma } from "@/infrastructure/database/prisma";
import { passwordSchema } from "@/modules/identity/password-policy";
import { hashPassword } from "@/server/auth/password";
import { createSession } from "@/server/auth/session";
import { hashInvitationToken } from "./invitation-token";

export const activateInvitationInputSchema = z.object({
  token: z.string().min(1),
  name: z.string().trim().min(2).max(200),
  password: passwordSchema,
});

export type ActivateInvitationInput = z.infer<typeof activateInvitationInputSchema>;

export interface ActivateInvitationContext {
  ipAddress?: string;
  userAgent?: string;
}

export interface ActivateInvitationResult {
  userId: string;
  athleteProfileId: string;
  sessionToken: string;
  sessionExpiresAt: Date;
}

export async function activateAthleteInvitation(
  input: ActivateInvitationInput,
  context: ActivateInvitationContext = {},
): Promise<ActivateInvitationResult> {
  const tokenHash = hashInvitationToken(input.token);

  const invitation = await prisma.athleteInvitation.findUnique({ where: { tokenHash } });
  if (!invitation) {
    throw new NotFoundError("Convite não encontrado ou inválido.");
  }
  if (invitation.isRevoked) {
    throw new ConflictError("Este convite foi revogado.");
  }
  if (invitation.isConsumed) {
    throw new ConflictError("Este convite já foi utilizado.");
  }
  if (invitation.expiresAt < new Date()) {
    throw new ConflictError("Este convite expirou.");
  }

  const passwordHash = await hashPassword(input.password);

  let createdUser: { id: string };

  try {
    createdUser = await prisma.$transaction(async (tx) => {
      const current = await tx.athleteInvitation.findUnique({ where: { tokenHash } });
      if (!current) {
        throw new NotFoundError("Convite não encontrado ou inválido.");
      }

      const existingUser = await tx.user.findFirst({
        where: { email: { equals: current.email, mode: "insensitive" } },
      });
      if (existingUser) {
        throw new ConflictError("Já existe uma conta com este e-mail.");
      }

      const user = await tx.user.create({
        data: { email: current.email, name: input.name, passwordHash, globalRole: "ATHLETE" },
      });

      // Atomic compare-and-swap: only succeeds if the invitation is still
      // pending at the moment of the write. Postgres's row lock on the
      // UPDATE closes the race window between two concurrent activations
      // of the same token — the loser's WHERE clause matches zero rows.
      const consumed = await tx.athleteInvitation.updateMany({
        where: {
          id: current.id,
          isConsumed: false,
          isRevoked: false,
          expiresAt: { gt: new Date() },
        },
        data: { isConsumed: true, consumedAt: new Date() },
      });

      if (consumed.count === 0) {
        throw new ConflictError("Este convite não está mais disponível.");
      }

      await tx.athleteProfile.update({
        where: { id: current.athleteId },
        data: { userId: user.id },
      });

      await recordAuditLog(tx, {
        action: "ACTIVATE_INVITATION",
        entityName: "AthleteInvitation",
        entityId: current.id,
        userId: user.id,
        organizationId: current.organizationId,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      });

      return user;
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new ConflictError("Já existe uma conta com este e-mail.");
    }
    throw error;
  }

  const session = await createSession({
    userId: createdUser.id,
    userAgent: context.userAgent,
    ipAddress: context.ipAddress,
  });

  return {
    userId: createdUser.id,
    athleteProfileId: invitation.athleteId,
    sessionToken: session.token,
    sessionExpiresAt: session.expiresAt,
  };
}
