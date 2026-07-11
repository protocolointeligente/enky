import { Resend } from "resend";
import { ExternalServiceError } from "@/domain/errors";
import { env } from "@/lib/env";
import { logger } from "@/server/observability/logger";

export interface PasswordResetEmailPayload {
  to: string;
  userName: string;
  resetUrl: string;
  expiresAt: Date;
}

// Sends the password-reset link. Same provider decision as the invitation
// mailer: Resend when configured (any environment), dev log-only fallback ONLY
// in development, hard error otherwise. The reset URL carries a bearer token —
// never logged in Preview/Production.
export async function sendPasswordResetEmail(payload: PasswordResetEmailPayload): Promise<void> {
  const apiKey = env.EMAIL_PROVIDER_API_KEY;
  const from = env.EMAIL_FROM;

  if (!apiKey || !from) {
    if (env.NODE_ENV !== "development") {
      throw new Error(
        "Provedor de e-mail não configurado: defina EMAIL_PROVIDER_API_KEY e EMAIL_FROM.",
      );
    }
    logger.info({ to: payload.to }, `[dev] redefinição de senha — link: ${payload.resetUrl}`);
    return;
  }

  const client = new Resend(apiKey);
  const expiresLabel = payload.expiresAt.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const { data, error } = await client.emails.send({
    from,
    to: payload.to,
    subject: "Redefinir sua senha ENKY",
    html: renderHtml({ ...payload, expiresLabel }),
  });

  if (error) {
    logger.error(
      { provider: "resend", code: error.name, statusCode: error.statusCode, to: payload.to },
      "falha ao enviar redefinição de senha",
    );
    throw new ExternalServiceError(`Falha ao enviar o e-mail de redefinição (${error.name}).`);
  }

  logger.info(
    { provider: "resend", messageId: data?.id, to: payload.to },
    "redefinição de senha enviada",
  );
}

function renderHtml(params: { userName: string; resetUrl: string; expiresLabel: string }): string {
  return `<!doctype html>
<html lang="pt-BR">
  <body style="margin:0;background:#04202b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;background:#062a38;border-radius:16px;padding:32px;">
            <tr><td style="font-size:24px;font-weight:800;color:#ffffff;padding-bottom:8px;">ENKY</td></tr>
            <tr><td style="font-size:16px;color:#f2f6f8;padding-bottom:16px;">Olá, ${escapeHtml(params.userName)}!</td></tr>
            <tr><td style="font-size:15px;line-height:1.6;color:#a2b7c1;padding-bottom:24px;">
              Recebemos um pedido para redefinir a senha da sua conta ENKY. Clique no botão abaixo para escolher uma nova senha.
            </td></tr>
            <tr><td align="center" style="padding-bottom:24px;">
              <a href="${escapeHtml(params.resetUrl)}" style="display:inline-block;background:#ff6500;color:#04202b;font-weight:700;text-decoration:none;padding:12px 28px;border-radius:10px;">
                Redefinir minha senha
              </a>
            </td></tr>
            <tr><td style="font-size:13px;color:#6f8b98;line-height:1.6;">
              Este link expira às <strong>${escapeHtml(params.expiresLabel)}</strong> (1 hora).
              Se você não pediu isto, ignore este e-mail — sua senha continua a mesma.
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
