# infrastructure/mail

**Responsabilidade:** envio de e-mails transacionais. Hoje, só o convite de atleta (`InvitationMailer`).

**Status (Fase 02B):** nenhum provedor real conectado — `EMAIL_PROVIDER_API_KEY` (`.env.example`) está reservado para quando um for escolhido. `DevInvitationMailer` é o único adapter existente: registra a URL de ativação no logger estruturado para uso manual em desenvolvimento, e **recusa-se a instanciar em produção** (lança erro no construtor se `NODE_ENV=production`) — um convite real nunca "sucede" silenciosamente sem ser de fato entregue.

Antes de produção: implementar um `InvitationMailer` real (ex.: Resend, Postmark, SES) e trocar a instanciação em `app/api/athletes/invitations/route.ts` e `app/api/athletes/invitations/[id]/resend/route.ts`.
