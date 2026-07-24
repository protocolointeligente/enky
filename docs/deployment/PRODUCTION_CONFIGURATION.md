# Configuração de Produção — ENKY OS

Referência de variáveis de ambiente e checklist de deploy. **Nenhum segredo real
aqui** — só nomes, propósito e classificação. O contrato de runtime é validado por
`lib/env.ts` (Zod); o template local é `.env.example`.

Legenda: **Obrigatória** (app não sobe / feature morre sem ela) · **Opcional**
(periférico; ausência desliga a feature, app segue) · **Servidor** (nunca vai ao
bundle) · **Cliente** (`NEXT_PUBLIC_*`, exposta no bundle) · Ambientes:
Development / Preview / Production.

---

## 1. Núcleo (runtime — `lib/env.ts`)

| Variável | Classe | Escopo | Ambientes | Observações |
|---|---|---|---|---|
| `DATABASE_URL` | **Obrigatória** | Servidor | D/P/P | Conexão **pooled** (Neon pooler). Toda query da app. |
| `AUTH_SECRET` | **Obrigatória** | Servidor | D/P/P | ≥ 32 chars. HMAC do token de sessão (ADR-002). **Rotacionar invalida todas as sessões.** |
| `APP_URL` | **Obrigatória** (default `localhost:3000`) | Servidor | D/P/P | Base pública para links de e-mail e callbacks. Em Production = domínio real. |
| `LOG_LEVEL` | Opcional (default `info`) | Servidor | D/P/P | `fatal…silent`. Nunca logar dado de saúde/segredo (ver §5). |
| `NODE_ENV` | Automática | — | D/P/P | Definida pela plataforma/Next. |

## 2. E-mail transacional (Resend)

| Variável | Classe | Escopo | Observações |
|---|---|---|---|
| `EMAIL_PROVIDER_API_KEY` | Opcional (**obrigatória em Production**) | Servidor | Sem ela, o mailer de produção **recusa** (não cai no log-only). |
| `EMAIL_FROM` | Opcional (obrigatória com e-mail) | Servidor | `Nome <endereco@dominio>`; domínio verificado no Resend. |

## 3. Pagamentos / Marketplace (Asaas)

| Variável | Classe | Escopo | Observações |
|---|---|---|---|
| `PAYMENT_PROVIDER_SECRET_KEY` | Opcional (**obrigatória p/ checkout/marketplace**) | Servidor | API key Asaas. Prefixo `$aact_hmlg_` = sandbox. |
| `PAYMENT_PROVIDER_WEBHOOK_SECRET` | Opcional (obrigatória p/ webhook) | Servidor | Segredo do header `asaas-access-token`. **NUNCA** igual à API key. |

**Webhook:** callback aponta para `${APP_URL}/api/marketplace/webhook` (e o de assinatura). Idempotência garantida por `MarketplaceOrder.idempotencyKey` e `MarketplacePaymentEvent`. O split 90/10 vendedor/ENKY não muda com config.

## 4. Strava (Fase 11 — periférico)

| Variável | Classe | Escopo | Observações |
|---|---|---|---|
| `STRAVA_CLIENT_ID` / `STRAVA_CLIENT_SECRET` | Opcional | Servidor | App em strava.com/settings/api. |
| `STRAVA_WEBHOOK_VERIFY_TOKEN` | Opcional | Servidor | Segredo NOSSO, devolvido no handshake GET. Não autentica os POSTs de evento. |
| `STRAVA_WEBHOOK_SUBSCRIPTION_ID` | Opcional | Servidor | Uma inscrição por app: se Preview e Production compartilham app, cada um descarta o evento do outro. |

Callback OAuth: `${APP_URL}/api/athlete/integrations/strava/callback`.

## 5. Web Push / VAPID (§14 — periférico)

| Variável | Classe | Escopo | Observações |
|---|---|---|---|
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Opcional (obrigatória p/ push) | **Cliente** | Só a chave PÚBLICA no bundle. |
| `VAPID_PRIVATE_KEY` | Opcional (obrigatória p/ push) | Servidor | Par da pública. Gerar com `npx web-push generate-vapid-keys`. |
| `VAPID_SUBJECT` | Opcional (obrigatória p/ push) | Servidor | `mailto:` ou URL https. |

Sem as três, `modules/push/get-push-provider.ts` retorna null e o push é desligado (app funciona).

## 6. Rate limiting (Upstash Redis) — lido direto, fora do schema

| Variável | Classe | Escopo | Observações |
|---|---|---|---|
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Opcional | Servidor | **Deliberadamente fora de `lib/env.ts`**: um valor malformado no schema derrubaria TODA rota (aconteceu em prod). `server/security/rate-limit.ts` lê direto; sem elas, cai para limitador in-memory (por instância). |

## 7. Migrações (Neon — conexão não-pooled)

| Variável | Classe | Escopo | Observações |
|---|---|---|---|
| `DIRECT_URL` | **Obrigatória p/ `migrate deploy`** | Servidor (build) | Conexão **direta** (sem pooler) para migrações e checagens. |
| `DATABASE_URL_UNPOOLED` | Alternativa (Neon popula) | Servidor (build) | `scripts/migrate-on-deploy.cjs` usa DIRECT_URL → UNPOOLED → DATABASE_URL, nessa ordem; se nenhuma, PULA a migração. |

## 8. Plataforma (Vercel — automáticas, não definir)

`VERCEL_ENV`, `VERCEL_URL`, `VERCEL_BRANCH_URL`, `VERCEL_PROJECT_PRODUCTION_URL` — populadas pela Vercel.

## 9. Scripts operacionais (NÃO são runtime — só CLI manual)

Nunca precisam existir no ambiente do app; só ao rodar o script correspondente.

| Variável | Usada por | Observações |
|---|---|---|
| `ENKY_ALLOW_PRODUCTION_WRITE=1` | imports/bootstrap | Gate explícito para escrever em prod. Sem isso, os scripts recusam. |
| `ADMIN_EMAIL` / `ADMIN_NAME` / `ADMIN_PASSWORD` | seed/bootstrap | Cria o admin inicial. |
| `SUPERADMIN_EMAIL` / `RICARDO_EMAIL` | seed | Marca papel SUPERADMIN inicial. **Não é o mecanismo de autorização** — o gate real é o papel `Role.SUPERADMIN` no banco + `requireAdminActor`. |
| `ACCESS_PASSWORD` | `provision-access.cjs` | Senha de demo (default `EnkyDemo2026`). |
| `MUSCLEWIKI_API_KEY` / `EXERCISEDB_RAPIDAPI_KEY` | import de exercícios | Só nos scripts de import manual, nunca no runtime. |

## 10. Reservadas (ainda sem consumidor — não preencher)

`STORAGE_PROVIDER_ACCESS_KEY`, `STORAGE_PROVIDER_SECRET_KEY` (upload de foto §12 depende disto), `AI_PROVIDER_API_KEY`.

---

## Checklist de segurança da configuração

- [ ] **Segredos de webhook** (`PAYMENT_PROVIDER_WEBHOOK_SECRET`, `STRAVA_WEBHOOK_VERIFY_TOKEN`) distintos da API key e por ambiente.
- [ ] **URLs de callback** apontam para o `APP_URL` correto de cada ambiente (Preview ≠ Production).
- [ ] **Idempotência** ativa: `MarketplaceOrder.idempotencyKey`, `MarketplacePaymentEvent`.
- [ ] **Rotação de chaves**: rotacionar `AUTH_SECRET` derruba sessões (comunicar); VAPID e Asaas rotacionáveis sem downtime.
- [ ] **Variáveis públicas**: só `NEXT_PUBLIC_VAPID_PUBLIC_KEY` é cliente. Nenhum segredo com prefixo `NEXT_PUBLIC_`.
- [ ] **Sem segredo em log**: `LOG_LEVEL` e o logger (pino) não emitem dado de saúde/prontidão/dor nem segredo.
- [ ] **Sem segredo no bundle**: confirmar que só a chave VAPID pública aparece no client (`grep NEXT_PUBLIC` no build).
- [ ] **Migrações**: `DIRECT_URL` presente no ambiente de build para `migrate deploy`.

## Passos manuais de deploy

1. Provisionar Neon (pooled `DATABASE_URL` + direct `DIRECT_URL`).
2. Definir as obrigatórias (§1) + as das features ativas (§2–§6).
3. **Rodar as migrações pendentes em banco isolado (Neon Preview) ANTES de produção** — ver relatório de integração; há 21 migrações novas não validadas contra banco real.
4. Configurar webhooks (Asaas, Strava) com os secrets e callbacks do ambiente.
5. `vercel-build` roda `migrate-on-deploy` + `next build`.
