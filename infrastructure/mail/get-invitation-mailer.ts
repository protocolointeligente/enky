import { env } from "@/lib/env";
import { DevInvitationMailer } from "./dev-invitation-mailer";
import type { InvitationMailer } from "./invitation-mailer";
import { ResendInvitationMailer } from "./resend-invitation-mailer";

// Single decision point for which mailer a route uses (decisões 02D.1 #4/#5):
//   - Provedor configurado (EMAIL_PROVIDER_API_KEY + EMAIL_FROM) → Resend,
//     em QUALQUER ambiente.
//   - Sem provedor configurado: só há fallback (DevInvitationMailer, que
//     apenas loga a URL) em desenvolvimento. Em produção E em Preview —
//     ambos rodam com NODE_ENV=production na Vercel — e em teste, a ausência
//     de configuração é um ERRO OPERACIONAL EXPLÍCITO. Nunca há fallback
//     silencioso para o mailer log-only fora de development, e o token/URL
//     nunca é logado em Preview/Production.
export function getInvitationMailer(): InvitationMailer {
  const apiKey = env.EMAIL_PROVIDER_API_KEY;
  const from = env.EMAIL_FROM;

  if (apiKey && from) {
    return new ResendInvitationMailer(apiKey, from);
  }

  if (env.NODE_ENV !== "development") {
    throw new Error(
      "Provedor de e-mail não configurado: defina EMAIL_PROVIDER_API_KEY e EMAIL_FROM.",
    );
  }

  return new DevInvitationMailer();
}
