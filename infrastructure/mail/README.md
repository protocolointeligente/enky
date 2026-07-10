# infrastructure/mail

**Responsabilidade:** envio de e-mails transacionais. Hoje, só o convite de atleta (`InvitationMailer`).

**Status (Fase 02D):** provedor real implementado — **Resend** (`resend-invitation-mailer.ts`).

**Seleção de adapter — `getInvitationMailer()` (`get-invitation-mailer.ts`) é o único ponto de decisão.** Toda rota que envia convite usa essa factory, nunca instancia um mailer diretamente. Regras:

- `EMAIL_PROVIDER_API_KEY` + `EMAIL_FROM` definidos → `ResendInvitationMailer` (em qualquer ambiente).
- Sem provedor configurado, **apenas em `development`** → `DevInvitationMailer` (loga o link no console).
- Sem provedor configurado, em `production`, **Preview** ou `test` → **lança erro operacional explícito**. Na Vercel, Preview e Production rodam ambos com `NODE_ENV=production`, então ambos caem nesta recusa. Nunca há fallback silencioso para o mailer que só escreve no log; um convite real nunca "sucede" sem sair.

**`ResendInvitationMailer`:** template HTML em pt-BR, com marca ENKY e data de expiração. Nunca loga a `activationUrl` (o token é credencial bearer — só a caixa de entrada do destinatário deve tê-lo); em falha do provedor, lança `ExternalServiceError` (502) com apenas o código/status do erro no log.

**`DevInvitationMailer`:** só `NODE_ENV=development` — loga a URL de ativação e **recusa-se a instanciar em qualquer outro ambiente** (lança no construtor, decisão 02D.1 #4). Uma segunda camada de proteção além da factory.

**Testes:** `tests/mocks/fake-invitation-mailer.ts` (`FakeInvitationMailer`) captura os convites em memória em vez de enviá-los, expondo `lastActivationUrl` para asserções.

**Configuração:** `EMAIL_PROVIDER_API_KEY` (Resend API key, `re_...`) e `EMAIL_FROM` (remetente verificado na Resend) — ver `.env.example`. Devem ser definidos também nas variáveis de ambiente da Vercel (Preview + Production) para o convite real funcionar em deploy.
