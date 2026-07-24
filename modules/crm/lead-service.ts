import type { LeadStatus } from "@prisma/client";
import { NotFoundError, ValidationError } from "@/domain/errors";
import { prisma } from "@/infrastructure/database/prisma";
import type {
  ChangeLeadStatusInput,
  CreateLeadInput,
  CreateLeadInteractionInput,
  ListLeadsQuery,
  UpdateLeadInput,
} from "./lead-schemas";

// CRM de leads (§5–7). Todo acesso é escopado por `organizationId` (tenant
// isolation, §28): um lead de outra organização é NotFound, nunca vaza sua
// existência. A conversão em cliente (§7) ainda NÃO mora aqui — depende de
// Client/CoachServicePlan/Contract; até lá, WON só marca o desfecho do funil.

export interface CrmActor {
  userId: string;
  organizationId: string;
}

// Papéis org autorizados nas rotas de Lead (docs/ENKY_CRM_PERMISSIONS.md).
// OWNER passa sozinho no requireOrgRole, por isso não aparece aqui.
export const LEAD_READ_ROLES = ["MANAGER", "HEAD_COACH", "SUPPORT", "VIEWER"] as const;
export const LEAD_WRITE_ROLES = ["MANAGER", "SUPPORT"] as const;

// Efeito colateral da mudança de etapa, isolado como função PURA para teste:
// os timestamps derivam do status-alvo e ficam sempre consistentes com ele
// (reabrir um lead perdido limpa lostAt/lostReason; sair de WON limpa
// convertedAt). `now` é injetado para determinismo.
export function resolveStatusFields(
  status: LeadStatus,
  lostReason: string | null | undefined,
  existing: { convertedAt: Date | null; lostAt: Date | null },
  now: Date,
): { convertedAt: Date | null; lostAt: Date | null; lostReason: string | null } {
  return {
    convertedAt: status === "WON" ? (existing.convertedAt ?? now) : null,
    lostAt: status === "LOST" ? (existing.lostAt ?? now) : null,
    lostReason: status === "LOST" ? (lostReason ?? null) : null,
  };
}

async function getOwnedLead(leadId: string, organizationId: string) {
  const lead = await prisma.lead.findFirst({ where: { id: leadId, organizationId } });
  if (!lead) throw new NotFoundError("Lead não encontrado.");
  return lead;
}

async function assertAssigneeIsMember(userId: string, organizationId: string): Promise<void> {
  const membership = await prisma.organizationMembership.findUnique({
    where: { userId_organizationId: { userId, organizationId } },
  });
  if (!membership) throw new ValidationError("Responsável não é membro da organização.");
}

export async function createLead(input: CreateLeadInput, actor: CrmActor) {
  if (input.assignedToUserId) await assertAssigneeIsMember(input.assignedToUserId, actor.organizationId);
  return prisma.lead.create({
    data: {
      organizationId: actor.organizationId,
      name: input.name,
      email: input.email ?? null,
      phone: input.phone ?? null,
      source: input.source,
      interestedModality: input.interestedModality ?? null,
      assignedToUserId: input.assignedToUserId ?? null,
      estimatedValue: input.estimatedValue ?? null,
      notes: input.notes ?? null,
      nextActionAt: input.nextActionAt ?? null,
    },
  });
}

export async function updateLead(leadId: string, input: UpdateLeadInput, actor: CrmActor) {
  await getOwnedLead(leadId, actor.organizationId);
  if (input.assignedToUserId) await assertAssigneeIsMember(input.assignedToUserId, actor.organizationId);
  // undefined = não altera; null = limpa (semântica Prisma). Status não entra
  // aqui — tem endpoint próprio.
  return prisma.lead.update({
    where: { id: leadId },
    data: {
      name: input.name,
      email: input.email,
      phone: input.phone,
      source: input.source,
      interestedModality: input.interestedModality,
      assignedToUserId: input.assignedToUserId,
      estimatedValue: input.estimatedValue,
      notes: input.notes,
      nextActionAt: input.nextActionAt,
    },
  });
}

export async function changeLeadStatus(
  leadId: string,
  input: ChangeLeadStatusInput,
  actor: CrmActor,
) {
  const lead = await getOwnedLead(leadId, actor.organizationId);
  const fields = resolveStatusFields(input.status, input.lostReason, lead, new Date());
  const summary =
    `Etapa: ${lead.status} → ${input.status}` +
    (input.status === "LOST" && input.lostReason ? ` — ${input.lostReason}` : "");

  return prisma.$transaction(async (tx) => {
    const updated = await tx.lead.update({
      where: { id: leadId },
      data: { status: input.status, ...fields },
    });
    await tx.leadInteraction.create({
      data: {
        organizationId: actor.organizationId,
        leadId,
        actorUserId: actor.userId,
        type: "STATUS_CHANGE",
        channel: "SYSTEM",
        summary,
      },
    });
    return updated;
  });
}

export async function addLeadInteraction(
  leadId: string,
  input: CreateLeadInteractionInput,
  actor: CrmActor,
) {
  await getOwnedLead(leadId, actor.organizationId);
  return prisma.$transaction(async (tx) => {
    const interaction = await tx.leadInteraction.create({
      data: {
        organizationId: actor.organizationId,
        leadId,
        actorUserId: actor.userId,
        type: input.type,
        channel: input.channel ?? "SYSTEM",
        summary: input.summary,
        occurredAt: input.occurredAt,
        nextActionAt: input.nextActionAt ?? null,
      },
    });
    // "Agendar próxima ação" (§5): registrar a interação com um nextActionAt
    // também move o ponteiro do lead, que é o que a lista/pipeline ordena.
    if (input.nextActionAt) {
      await tx.lead.update({ where: { id: leadId }, data: { nextActionAt: input.nextActionAt } });
    }
    return interaction;
  });
}

export async function getLead(leadId: string, actor: CrmActor) {
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, organizationId: actor.organizationId },
    include: {
      assignedTo: { select: { id: true, name: true } },
      interactions: { orderBy: { occurredAt: "desc" }, take: 100 },
    },
  });
  if (!lead) throw new NotFoundError("Lead não encontrado.");
  return lead;
}

export async function listLeads(filters: ListLeadsQuery, actor: CrmActor) {
  const take = filters.take ?? 50;
  const where = {
    organizationId: actor.organizationId,
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.source ? { source: filters.source } : {}),
    ...(filters.assignedToUserId ? { assignedToUserId: filters.assignedToUserId } : {}),
    ...(filters.q
      ? {
          OR: [
            { name: { contains: filters.q, mode: "insensitive" as const } },
            { email: { contains: filters.q, mode: "insensitive" as const } },
            { phone: { contains: filters.q } },
          ],
        }
      : {}),
  };

  // Paginação por cursor (§30): estável mesmo com createdAt empatado, porque
  // `id` é o desempate e o cursor. Pede-se take+1 para saber se há próxima.
  const rows = await prisma.lead.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: take + 1,
    ...(filters.cursor ? { cursor: { id: filters.cursor }, skip: 1 } : {}),
    include: { assignedTo: { select: { id: true, name: true } } },
  });

  const hasMore = rows.length > take;
  const leads = hasMore ? rows.slice(0, take) : rows;
  return { leads, nextCursor: hasMore ? leads[leads.length - 1]!.id : null };
}
