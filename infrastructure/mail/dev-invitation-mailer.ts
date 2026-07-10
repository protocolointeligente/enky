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
    // Decisão 02D.1 #4: este mailer só pode existir em NODE_ENV=development.
    // Recusa-se a instanciar em produção (um convite jamais pode "suceder"
    // apenas logando o link) E em teste (os testes usam FakeInvitationMailer,
    // nunca este). Na Vercel, Preview e Production rodam ambos com
    // NODE_ENV=production, então ambos caem nesta recusa.
    if (env.NODE_ENV !== "development") {
      throw new Error(
        "DevInvitationMailer só pode ser usado em desenvolvimento — configure um InvitationMailer real.",
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
