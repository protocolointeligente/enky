import { z } from "zod";
import { ClientStatus } from "@prisma/client";
import { recordAuditLog } from "@/domain/audit";
import { prisma } from "@/infrastructure/database/prisma";

// Ações em massa (§21). Nesta fatia: mudança de status de clientes em lote
// (inclui arquivar). Tenant isolation via updateMany escopado; cap de ids para
// não processar lote gigante; UMA linha de auditoria por lote (com a contagem).
// Confirmação de ação sensível é responsabilidade da UI.

export interface BulkActor {
  userId: string;
  organizationId: string;
  ipAddress?: string;
}

// Mesma escrita de cliente (MANAGER/SUPPORT; OWNER passa sozinho).
export const BULK_CLIENT_ROLES = ["MANAGER", "SUPPORT"] as const;

export const bulkClientStatusSchema = z.object({
  clientIds: z.array(z.string().uuid()).min(1).max(500),
  status: z.nativeEnum(ClientStatus),
});
export type BulkClientStatusInput = z.infer<typeof bulkClientStatusSchema>;

export async function bulkSetClientStatus(input: BulkClientStatusInput, actor: BulkActor) {
  return prisma.$transaction(async (tx) => {
    const res = await tx.client.updateMany({
      where: { id: { in: input.clientIds }, organizationId: actor.organizationId },
      data: { status: input.status },
    });
    await recordAuditLog(tx, {
      action: "BULK_UPDATE_CLIENTS",
      entityName: "Client",
      userId: actor.userId,
      organizationId: actor.organizationId,
      ipAddress: actor.ipAddress,
      changedFields: ["status"],
      reason: `status=${input.status} count=${res.count}`,
    });
    return { updated: res.count };
  });
}
