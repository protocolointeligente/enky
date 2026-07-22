import { z } from "zod";
import { recordAuditLog } from "@/domain/audit";
import { normalizeEmail } from "@/modules/identity/normalize-email";
import { assertCanAddAthlete } from "@/modules/subscriptions/entitlements";
import { prisma } from "@/infrastructure/database/prisma";
import {
  generateInvitationToken,
  hashInvitationToken,
  INVITATION_TTL_MS,
} from "./invitation-token";

export const inviteAthleteInputSchema = z.object({
  email: z.string().trim().email(),
  athleteName: z.string().trim().min(1).max(200).optional(),
});

export type InviteAthleteInput = z.infer<typeof inviteAthleteInputSchema>;

export interface InviteAthleteActor {
  userId: string;
  trainerProfileId: string;
  organizationId: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface InviteAthleteResult {
  invitationId: string;
  athleteProfileId: string;
  // Exists only in memory for this one response — never persisted, only
  // the hash is (see AthleteInvitation.tokenHash).
  rawToken: string;
  expiresAt: Date;
}

export async function inviteAthlete(
  input: InviteAthleteInput,
  actor: InviteAthleteActor,
): Promise<InviteAthleteResult> {
  const email = normalizeEmail(input.email);
  const rawToken = generateInvitationToken();
  const expiresAt = new Date(Date.now() + INVITATION_TTL_MS);

  // Limite de atletas do plano (Fase 10). Antes de abrir a transação, e antes
  // de qualquer escrita: um convite que estoura o limite não deixa
  // AthleteProfile órfão nem vínculo pela metade.
  //
  // Fora da transação de propósito. Dentro não compraria exclusão mútua (ver
  // a nota de LIMITE SUAVE em assertCanAddAthlete: no READ COMMITTED as
  // contagens concorrentes não bloqueiam), e custaria três round-trips a mais
  // dentro de uma transação interativa que tem teto de tempo — o preço seria
  // real, a garantia não.
  await assertCanAddAthlete(actor.organizationId);

  const result = await prisma.$transaction(async (tx) => {
    const athlete = await tx.athleteProfile.create({ data: {} });

    await tx.coachAthleteRelationship.create({
      data: {
        organizationId: actor.organizationId,
        trainerId: actor.trainerProfileId,
        athleteId: athlete.id,
      },
    });

    const invitation = await tx.athleteInvitation.create({
      data: {
        organizationId: actor.organizationId,
        trainerId: actor.trainerProfileId,
        athleteId: athlete.id,
        email,
        tokenHash: hashInvitationToken(rawToken),
        expiresAt,
      },
    });

    await recordAuditLog(tx, {
      action: "INVITE_ATHLETE",
      entityName: "AthleteInvitation",
      entityId: invitation.id,
      userId: actor.userId,
      organizationId: actor.organizationId,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    return { invitation, athlete };
  });

  return {
    invitationId: result.invitation.id,
    athleteProfileId: result.athlete.id,
    rawToken,
    expiresAt,
  };
}
