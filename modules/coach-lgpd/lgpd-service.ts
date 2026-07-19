import { recordAuditLog } from "@/domain/audit";
import { NotFoundError } from "@/domain/errors";
import { prisma } from "@/infrastructure/database/prisma";

// LGPD do lado comercial (§29). Duas operações sobre o titular Cliente:
// - EXPORTAR os dados comerciais dele (portabilidade / acesso).
// - ANONIMIZAR: apaga a PII do cliente, MAS preserva os registros financeiros
//   (contratos/faturas) — não se apaga dado financeiro sem checar retenção legal
//   (§29). Ambas auditadas (§32).
// Separação de domínios (§29): aqui só dado COMERCIAL — nada de saúde/fisiológico.

export interface LgpdActor {
  userId: string;
  organizationId: string;
  ipAddress?: string;
}

// Operação sensível: só MANAGER (OWNER passa sozinho).
export const LGPD_ROLES = ["MANAGER"] as const;

async function getOwnedClient(clientId: string, organizationId: string) {
  const client = await prisma.client.findFirst({ where: { id: clientId, organizationId } });
  if (!client) throw new NotFoundError("Cliente não encontrado.");
  return client;
}

export async function exportClientData(clientId: string, actor: LgpdActor) {
  const client = await prisma.client.findFirst({
    where: { id: clientId, organizationId: actor.organizationId },
    include: {
      contractsAsClient: {
        select: {
          servicePlan: { select: { name: true } },
          status: true,
          finalPrice: true,
          startDate: true,
          endDate: true,
        },
      },
    },
  });
  if (!client) throw new NotFoundError("Cliente não encontrado.");

  const [invoices, communications] = await Promise.all([
    prisma.coachInvoice.findMany({
      where: { organizationId: actor.organizationId, clientId },
      select: { referencePeriod: true, dueDate: true, finalAmount: true, status: true },
      orderBy: { dueDate: "desc" },
    }),
    prisma.communicationLog.findMany({
      where: { organizationId: actor.organizationId, recipientType: "CLIENT", recipientId: clientId },
      select: { channel: true, subject: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  // Auditar o ACESSO ao dado (§29/§32): quem exportou o dado de qual titular.
  await prisma.$transaction(async (tx) => {
    await recordAuditLog(tx, {
      action: "EXPORT_CLIENT_DATA",
      entityName: "Client",
      entityId: clientId,
      userId: actor.userId,
      organizationId: actor.organizationId,
      ipAddress: actor.ipAddress,
    });
  });

  return {
    client: {
      id: client.id,
      name: client.name,
      email: client.email,
      phone: client.phone,
      document: client.document,
      status: client.status,
      createdAt: client.createdAt,
    },
    contracts: client.contractsAsClient,
    invoices,
    communications,
  };
}

export async function anonymizeClient(clientId: string, actor: LgpdActor) {
  await getOwnedClient(clientId, actor.organizationId);
  return prisma.$transaction(async (tx) => {
    const updated = await tx.client.update({
      where: { id: clientId },
      data: {
        name: "Cliente anonimizado",
        email: null,
        phone: null,
        document: null,
        birthDate: null,
        notes: null,
        userId: null,
        status: "ARCHIVED",
      },
    });
    // Contratos/faturas NÃO são apagados (retenção financeira, §29). A ligação
    // permanece por id; a PII nominal do cliente é que some.
    await recordAuditLog(tx, {
      action: "ANONYMIZE_CLIENT",
      entityName: "Client",
      entityId: clientId,
      userId: actor.userId,
      organizationId: actor.organizationId,
      ipAddress: actor.ipAddress,
      reason: "LGPD anonymization",
    });
    return { id: updated.id };
  });
}
