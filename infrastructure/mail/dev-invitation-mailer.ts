import { env } from "@/lib/env";
import { logger } from "@/server/observability/logger";
import type { InvitationEmailPayload, InvitationMailer } from "./invitation-mailer";

// No real e-mail provider is connected yet (EMAIL_PROVIDER_API_KEY in
// .env.example is reserved for it — see Fase 03+). This adapter only logs
// the activation URL to the local console so a developer can copy it
// during manual testing. It refuses to run in production so a real
// invitation can never silently "succeed" by just being logged nowhere.
export class DevInvitationMailer implements InvitationMailer {
  constructor() {
    if (env.NODE_ENV === "production") {
      throw new Error(
        "DevInvitationMailer não pode ser usado em produção — configure um InvitationMailer real.",
      );
    }
  }

  async sendInvitation(payload: InvitationEmailPayload): Promise<void> {
    logger.info(
      { to: payload.to, expiresAt: payload.expiresAt.toISOString() },
      `[dev] convite de atleta — ative em: ${payload.activationUrl}`,
    );
  }
}
