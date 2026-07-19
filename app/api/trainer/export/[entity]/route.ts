import type { NextRequest } from "next/server";
import { EXPORTS, isExportEntity } from "@/modules/coach-export/export-service";
import { NotFoundError } from "@/domain/errors";
import {
  requireAuthenticatedUser,
  requireGlobalRole,
  requireOrgRole,
  resolveActiveOrganization,
} from "@/server/auth/guards";
import { apiError } from "@/server/http/response";

export const dynamic = "force-dynamic";

// Baixa um CSV comercial (§27). Resposta text/csv com download; a permissão é a
// mesma leitura da entidade. Dados de saúde nunca entram nestes exports.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ entity: string }> }) {
  try {
    const identity = await requireAuthenticatedUser();
    requireGlobalRole(identity, ["TRAINER"]);
    const active = await resolveActiveOrganization(identity.userId);

    const { entity } = await params;
    if (!isExportEntity(entity)) throw new NotFoundError("Exportação não encontrada.");
    const spec = EXPORTS[entity];
    requireOrgRole(active, spec.roles);

    const csv = await spec.build({ userId: identity.userId, organizationId: active.organizationId });
    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${entity}.csv"`,
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
