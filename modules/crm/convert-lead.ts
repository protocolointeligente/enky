import { z } from "zod";
import { recordAuditLog } from "@/domain/audit";
import { ConflictError, NotFoundError, ValidationError } from "@/domain/errors";
import { prisma } from "@/infrastructure/database/prisma";
import {
  generateInvitationToken,
  hashInvitationToken,
  INVITATION_TTL_MS,
} from "@/modules/athletes/invitation-token";
import { computeBillingPeriods } from "@/modules/coach-billing/invoice-math";
import { computeFinalPrice } from "@/modules/contracts/contract-service";
import { normalizeEmail } from "@/modules/identity/normalize-email";
import { assertCanAddAthlete } from "@/modules/subscriptions/entitlements";
import type { CrmActor } from "./lead-service";

// Conversão lead → cliente (§7). Fluxo transacional e IDEMPOTENTE: cria Client
// (com sourceLeadId), opcionalmente Atleta+vínculo+convite, o Contrato (ACTIVE,
// preço congelado do plano) e a 1ª mensalidade; marca o lead WON SEM apagá-lo.
// A idempotência é o Client.sourceLeadId: reconverter o mesmo lead devolve o
// cliente existente e não duplica nada. É a orquestração cross-domínio que só
// faz sentido depois que todas as peças (§8–14) existem.

export const convertLeadSchema = z.object({
  servicePlanId: z.string().uuid(),
  startDate: z.coerce.date().optional(),
  billingDay: z.number().int().min(1).max(31).optional(),
  price: z.number().nonnegative().max(9_999_999_999.99).nullish(),
  discount: z.number().nonnegative().max(9_999_999_999.99).optional(),
  autoRenew: z.boolean().optional(),
  // Se enviado, cria perfil de atleta + vínculo + convite ao portal. Ausente =
  // cliente sem atleta (pai pagante, empresa, avaliação avulsa — §7/§8).
  athleteEmail: z.string().trim().email().nullish(),
  athleteName: z.string().trim().min(1).max(200).nullish(),
  generateFirstInvoice: z.boolean().optional(),
});
export type ConvertLeadInput = z.infer<typeof convertLeadSchema>;

export interface ConvertLeadResult {
  clientId: string;
  contractId: string | null;
  athleteProfileId: string | null;
  invoiceCreated: boolean;
  alreadyConverted: boolean;
  // Devolvido só para o envio do e-mail pós-commit (nunca persistido em claro).
  invitation: { rawToken: string; email: string; athleteName: string | null; expiresAt: Date } | null;
}

export async function convertLead(
  leadId: string,
  input: ConvertLeadInput,
  actor: CrmActor & { ipAddress?: string; userAgent?: string },
): Promise<ConvertLeadResult> {
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, organizationId: actor.organizationId },
  });
  if (!lead) throw new NotFoundError("Lead não encontrado.");

  // Idempotência: já convertido? Devolve o cliente existente sem recriar nada.
  const existing = await prisma.client.findFirst({
    where: { organizationId: actor.organizationId, sourceLeadId: leadId },
    select: { id: true },
  });
  if (existing) {
    return {
      clientId: existing.id,
      contractId: null,
      athleteProfileId: null,
      invoiceCreated: false,
      alreadyConverted: true,
      invitation: null,
    };
  }

  const plan = await prisma.coachServicePlan.findFirst({
    where: { id: input.servicePlanId, organizationId: actor.organizationId },
  });
  if (!plan) throw new ValidationError("Plano não pertence à organização.");

  // Efeitos que precisam acontecer ANTES da transação (checagem de limite e
  // resolução do treinador), como no fluxo de convite de atleta.
  let trainerProfileId: string | null = null;
  if (input.athleteEmail) {
    await assertCanAddAthlete(actor.organizationId);
    const tp = await prisma.trainerProfile.findUnique({ where: { userId: actor.userId } });
    if (!tp) throw new ConflictError("Usuário não possui perfil de treinador para vincular um atleta.");
    trainerProfileId = tp.id;
  }

  const price = input.price ?? Number(plan.price);
  const discount = input.discount ?? 0;
  if (discount > price) throw new ValidationError("Desconto não pode ser maior que o preço.");
  const finalPrice = computeFinalPrice(price, discount);

  const now = new Date();
  const startDate =
    input.startDate ?? new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const billingDay = input.billingDay ?? 1;

  const rawToken = input.athleteEmail ? generateInvitationToken() : null;
  const expiresAt = new Date(Date.now() + INVITATION_TTL_MS);

  const result = await prisma.$transaction(async (tx) => {
    const client = await tx.client.create({
      data: {
        organizationId: actor.organizationId,
        name: lead.name,
        email: lead.email,
        phone: lead.phone,
        sourceLeadId: leadId,
        status: "ACTIVE",
      },
    });

    let athleteProfileId: string | null = null;
    if (input.athleteEmail && trainerProfileId && rawToken) {
      const athlete = await tx.athleteProfile.create({ data: {} });
      await tx.coachAthleteRelationship.create({
        data: { organizationId: actor.organizationId, trainerId: trainerProfileId, athleteId: athlete.id },
      });
      await tx.athleteInvitation.create({
        data: {
          organizationId: actor.organizationId,
          trainerId: trainerProfileId,
          athleteId: athlete.id,
          email: normalizeEmail(input.athleteEmail),
          tokenHash: hashInvitationToken(rawToken),
          expiresAt,
        },
      });
      athleteProfileId = athlete.id;
    }

    const contract = await tx.coachClientContract.create({
      data: {
        organizationId: actor.organizationId,
        clientId: client.id,
        athleteId: athleteProfileId,
        servicePlanId: plan.id,
        payerClientId: client.id,
        status: "ACTIVE",
        startDate,
        billingDay,
        price,
        discount,
        finalPrice,
        currency: plan.currency,
        autoRenew: input.autoRenew ?? false,
        templateCode: "standard",
        templateVersion: 1,
      },
    });

    let invoiceCreated = false;
    if (input.generateFirstInvoice) {
      const [period] = computeBillingPeriods({
        billingDay,
        start: startDate,
        end: null,
        from: startDate,
        to: startDate,
      });
      if (period) {
        await tx.coachInvoice.create({
          data: {
            organizationId: actor.organizationId,
            contractId: contract.id,
            clientId: client.id,
            payerClientId: client.id,
            referencePeriod: period.referencePeriod,
            dueDate: period.dueDate,
            amount: finalPrice,
            finalAmount: finalPrice,
            currency: plan.currency,
            status: "PENDING",
          },
        });
        invoiceCreated = true;
      }
    }

    // Lead vira WON — nunca é apagado (§7).
    await tx.lead.update({ where: { id: leadId }, data: { status: "WON", convertedAt: now } });
    await tx.leadInteraction.create({
      data: {
        organizationId: actor.organizationId,
        leadId,
        actorUserId: actor.userId,
        type: "STATUS_CHANGE",
        channel: "SYSTEM",
        summary: "Convertido em cliente",
      },
    });

    await recordAuditLog(tx, {
      action: "CONVERT_LEAD",
      entityName: "Lead",
      entityId: leadId,
      userId: actor.userId,
      organizationId: actor.organizationId,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });

    return { clientId: client.id, contractId: contract.id, athleteProfileId, invoiceCreated };
  });

  return {
    ...result,
    alreadyConverted: false,
    invitation:
      rawToken && input.athleteEmail
        ? { rawToken, email: input.athleteEmail, athleteName: input.athleteName ?? null, expiresAt }
        : null,
  };
}
