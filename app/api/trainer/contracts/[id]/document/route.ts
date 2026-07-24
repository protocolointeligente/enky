import type { NextRequest } from "next/server";
import { CONTRACT_READ_ROLES } from "@/modules/contracts/contract-service";
import { getContractDocumentHtml } from "@/modules/contracts/contract-document";
import {
  requireAuthenticatedUser,
  requireGlobalRole,
  requireOrgRole,
  resolveActiveOrganization,
} from "@/server/auth/guards";
import { apiError } from "@/server/http/response";

export const dynamic = "force-dynamic";

// Documento do contrato em HTML (§11) — resposta text/html, não o envelope JSON.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const identity = await requireAuthenticatedUser();
    requireGlobalRole(identity, ["TRAINER"]);
    const active = await resolveActiveOrganization(identity.userId);
    requireOrgRole(active, CONTRACT_READ_ROLES);

    const { id } = await params;
    const html = await getContractDocumentHtml(id, {
      userId: identity.userId,
      organizationId: active.organizationId,
    });
    return new Response(html, {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (error) {
    return apiError(error);
  }
}
