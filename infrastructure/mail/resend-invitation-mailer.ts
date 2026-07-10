import { Resend } from "resend";
import { ExternalServiceError } from "@/domain/errors";
import { logger } from "@/server/observability/logger";
import type { InvitationEmailPayload, InvitationMailer } from "./invitation-mailer";

// Real transactional mailer (Resend). Never logs the activation URL — it
// carries the raw invitation token, which is a bearer credential; only the
// recipient's inbox may hold it. On any provider failure it throws
// ExternalServiceError so the caller (route) surfaces a real error instead
// of a convite silently "sent" to nowhere (§5).
export class ResendInvitationMailer implements InvitationMailer {
  private readonly client: Resend;

  constructor(
    apiKey: string,
    private readonly from: string,
  ) {
    this.client = new Resend(apiKey);
  }

  async sendInvitation(payload: InvitationEmailPayload): Promise<void> {
    const greetingName = payload.athleteName?.trim() ? payload.athleteName.trim() : "atleta";
    const expiresLabel = payload.expiresAt.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

    const { data, error } = await this.client.emails.send({
      from: this.from,
      to: payload.to,
      subject: `${payload.trainerName} convidou você para treinar na ENKY`,
      html: renderInvitationHtml({ ...payload, greetingName, expiresLabel }),
    });

    if (error) {
      // Log the provider error metadata (code/status) but NEVER the payload
      // or activation URL — the token must not leak into logs.
      logger.error(
        { provider: "resend", code: error.name, statusCode: error.statusCode, to: payload.to },
        "falha ao enviar convite de atleta",
      );
      throw new ExternalServiceError(`Falha ao enviar o convite por e-mail (${error.name}).`);
    }

    logger.info(
      { provider: "resend", messageId: data?.id, to: payload.to },
      "convite de atleta enviado",
    );
  }
}

function renderInvitationHtml(params: {
  greetingName: string;
  trainerName: string;
  activationUrl: string;
  expiresLabel: string;
}): string {
  return `<!doctype html>
<html lang="pt-BR">
  <body style="margin:0;background:#0a0f1c;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;background:#111827;border-radius:16px;padding:32px;">
            <tr><td style="font-size:24px;font-weight:800;color:#00e6c3;padding-bottom:8px;">ENKY</td></tr>
            <tr><td style="font-size:16px;color:#e2e8f0;padding-bottom:16px;">Olá, ${escapeHtml(params.greetingName)}!</td></tr>
            <tr><td style="font-size:15px;line-height:1.6;color:#cbd5e1;padding-bottom:24px;">
              <strong>${escapeHtml(params.trainerName)}</strong> convidou você para treinar na plataforma ENKY.
              Crie sua conta para ver seus treinos e enviar feedback.
            </td></tr>
            <tr><td align="center" style="padding-bottom:24px;">
              <a href="${escapeHtml(params.activationUrl)}" style="display:inline-block;background:linear-gradient(90deg,#00e6c3,#0066ff);color:#0a0f1c;font-weight:700;text-decoration:none;padding:12px 28px;border-radius:10px;">
                Ativar minha conta
              </a>
            </td></tr>
            <tr><td style="font-size:13px;color:#94a3b8;line-height:1.6;">
              Este convite expira em <strong>${escapeHtml(params.expiresLabel)}</strong>.
              Se você não esperava este e-mail, pode ignorá-lo com segurança.
            </td></tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
