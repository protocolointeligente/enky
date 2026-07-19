import type { NextRequest } from "next/server";
import { getInvitationMailer } from "@/infrastructure/mail/get-invitation-mailer";
import { getPublicBaseUrl } from "@/lib/env";
import { convertLead, convertLeadSchema } from "@/modules/crm/convert-lead";
import { LEAD_WRITE_ROLES } from "@/modules/crm/lead-service";
import {
  requireAuthenticatedUser,
  requireGlobalRole,
  requireOrgRole,
  resolveActiveOrganization,
} from "@/server/auth/guards";
import { parseJsonBody } from "@/server/http/parse-body";
import { apiError, apiSuccess } from "@/server/http/response";
import { assertTrustedOrigin } from "@/server/security/csrf";
import { getClientIp } from "@/server/security/ip";
import { crmWriteRateLimiter, enforceRateLimit } from "@/server/security/rate-limit";

export const dynamic = "force-dynamic";

// Converte um lead em cliente (§7): cria cliente/contrato/atleta/1ª cobrança e
// envia o convite ao portal, quando pedido. Idempotente pelo Client.sourceLeadId.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertTrustedOrigin(request);
    const identity = await requireAuthenticatedUser();
    requireGlobalRole(identity, ["TRAINER"]);
    const active = await resolveActiveOrganization(identity.userId);
    requireOrgRole(active, LEAD_WRITE_ROLES);
    await enforceRateLimit(crmWriteRateLimiter, `crm-write:${identity.userId}`);

    const { id } = await params;
    const input = await parseJsonBody(request, convertLeadSchema);
    const result = await convertLead(id, input, {
      userId: identity.userId,
      organizationId: active.organizationId,
      ipAddress: getClientIp(request),
      userAgent: request.headers.get("user-agent") ?? undefined,
    });

    // E-mail do convite fora da transação (efeito externo), como no fluxo de
    // convite de atleta. Se falhar, a conversão já está commitada; o convite
    // pode ser reenviado pela área de atletas.
    if (result.invitation) {
      const activationUrl = `${getPublicBaseUrl()}/convite/ativar?token=${result.invitation.rawToken}`;
      await getInvitationMailer()
        .sendInvitation({
          to: result.invitation.email,
          athleteName: result.invitation.athleteName,
          trainerName: identity.name,
          activationUrl,
          expiresAt: result.invitation.expiresAt,
        })
        .catch(() => undefined);
    }

    return apiSuccess(
      {
        clientId: result.clientId,
        contractId: result.contractId,
        athleteProfileId: result.athleteProfileId,
        invoiceCreated: result.invoiceCreated,
        alreadyConverted: result.alreadyConverted,
      },
      result.alreadyConverted ? 200 : 201,
    );
  } catch (error) {
    return apiError(error);
  }
}
