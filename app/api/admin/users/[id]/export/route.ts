import type { NextRequest } from "next/server";
import { requireAdminActor } from "@/modules/admin/admin-actor";
import { exportUserData } from "@/modules/admin/lgpd-service";
import { apiError, apiSuccess } from "@/server/http/response";

export const dynamic = "force-dynamic";

// LGPD — exportação dos dados do titular (portabilidade/acesso). GET auditado
// no serviço. Leitura, mas restrita a ADMIN/SUPERADMIN (dado pessoal de outrem).
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireAdminActor(request);
    const { id } = await params;
    const data = await exportUserData(actor, id);
    return apiSuccess({ export: data });
  } catch (error) {
    return apiError(error);
  }
}
