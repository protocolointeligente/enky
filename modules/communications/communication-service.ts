import { ValidationError } from "@/domain/errors";
import { prisma } from "@/infrastructure/database/prisma";
import type { LogCommunicationInput, ListCommunicationsQuery } from "./communication-schemas";

// Comunicação interna registrada (§22). Livro-razão: registra que a comunicação
// aconteceu. Disparo real de e-mail para mensagem avulsa é fatia futura (sem
// mailer geral) — por ora status LOGGED. Escopado por organizationId.

export interface CommunicationActor {
  userId: string;
  organizationId: string;
}

// Matriz (docs/ENKY_CRM_PERMISSIONS.md): MANAGER/HEAD_COACH/SUPPORT registram
// (OWNER passa sozinho); leitura ampla.
export const COMM_READ_ROLES = ["MANAGER", "HEAD_COACH", "COACH", "ASSISTANT_COACH", "FINANCE", "SUPPORT", "VIEWER"] as const;
export const COMM_WRITE_ROLES = ["MANAGER", "HEAD_COACH", "SUPPORT"] as const;

// `recipientId` é referência solta — o destinatário precisa existir na org do
// tipo declarado (evita registrar comunicação para um id de outro tenant).
async function assertRecipientInOrg(
  type: LogCommunicationInput["recipientType"],
  recipientId: string,
  organizationId: string,
): Promise<void> {
  let exists = false;
  if (type === "CLIENT") {
    exists = !!(await prisma.client.findFirst({ where: { id: recipientId, organizationId }, select: { id: true } }));
  } else if (type === "LEAD") {
    exists = !!(await prisma.lead.findFirst({ where: { id: recipientId, organizationId }, select: { id: true } }));
  } else {
    exists = !!(await prisma.coachAthleteRelationship.findFirst({
      where: { athleteId: recipientId, organizationId },
      select: { id: true },
    }));
  }
  if (!exists) throw new ValidationError("Destinatário não pertence à organização.");
}

export async function logCommunication(input: LogCommunicationInput, actor: CommunicationActor) {
  await assertRecipientInOrg(input.recipientType, input.recipientId, actor.organizationId);
  return prisma.communicationLog.create({
    data: {
      organizationId: actor.organizationId,
      recipientType: input.recipientType,
      recipientId: input.recipientId,
      channel: input.channel ?? "MANUAL",
      subject: input.subject ?? null,
      body: input.body ?? null,
      templateCode: input.templateCode ?? null,
      status: "LOGGED",
      createdByUserId: actor.userId,
    },
  });
}

export async function listCommunications(filters: ListCommunicationsQuery, actor: CommunicationActor) {
  const take = filters.take ?? 50;
  const rows = await prisma.communicationLog.findMany({
    where: {
      organizationId: actor.organizationId,
      ...(filters.recipientType ? { recipientType: filters.recipientType } : {}),
      ...(filters.recipientId ? { recipientId: filters.recipientId } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: take + 1,
    ...(filters.cursor ? { cursor: { id: filters.cursor }, skip: 1 } : {}),
    include: { createdBy: { select: { name: true } } },
  });
  const hasMore = rows.length > take;
  const communications = hasMore ? rows.slice(0, take) : rows;
  return { communications, nextCursor: hasMore ? communications[communications.length - 1]!.id : null };
}
