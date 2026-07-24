import { recordAuditLog } from "@/domain/audit";
import { ValidationError } from "@/domain/errors";
import { prisma } from "@/infrastructure/database/prisma";
import { parseCsv, validateClientImport } from "./csv-parse";

// Importação de clientes por CSV (§26). Fluxo em dois passos: PREVIEW (só valida,
// não escreve) e COMMIT (insere só as linhas válidas). Nunca sobrescreve —
// importar cria clientes novos (status PROSPECT); dedup por documento/e-mail é
// refinamento futuro. Mapeamento de colunas é fixo por cabeçalho nesta fatia.

export interface ImportActor {
  userId: string;
  organizationId: string;
  ipAddress?: string;
}

// Mesma escrita de cliente.
export const IMPORT_ROLES = ["MANAGER", "SUPPORT"] as const;

export function previewClientsImport(csv: string) {
  const { headerError, rows } = validateClientImport(parseCsv(csv));
  const valid = rows.filter((r) => !r.error).length;
  return { headerError, rows, summary: { total: rows.length, valid, invalid: rows.length - valid } };
}

export async function commitClientsImport(csv: string, actor: ImportActor) {
  const { headerError, rows } = validateClientImport(parseCsv(csv));
  if (headerError) throw new ValidationError(headerError);
  const valid = rows.filter((r) => !r.error);
  if (valid.length === 0) return { imported: 0, skipped: rows.length };

  const result = await prisma.$transaction(async (tx) => {
    const r = await tx.client.createMany({
      data: valid.map((v) => ({
        organizationId: actor.organizationId,
        name: v.data.name,
        email: v.data.email,
        phone: v.data.phone,
        document: v.data.document,
        status: "PROSPECT" as const,
      })),
    });
    await recordAuditLog(tx, {
      action: "IMPORT_CLIENTS",
      entityName: "Client",
      userId: actor.userId,
      organizationId: actor.organizationId,
      ipAddress: actor.ipAddress,
      reason: `imported=${r.count} skipped=${rows.length - valid.length}`,
    });
    return r;
  });
  return { imported: result.count, skipped: rows.length - valid.length };
}
