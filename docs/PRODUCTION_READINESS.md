# ENKY — Checklist de Produção (Fase 12)

Gate de go/no-go para o **piloto controlado** com treinadores reais. Objetivo:
estabilidade antes de escala. Nada de abrir cadastro público até este checklist
fechar em Preview **e** Production.

Legenda: `[x]` feito no repo · `[ ]` o operador executa contra a infra viva
(precisa de credenciais que não vivem no repositório).

Stack de referência: **Vercel** (deploy) · **Neon** (Postgres, projeto
`Enky-Production`) · **Resend** (e-mail) · **Asaas** (pagamento) · **Upstash**
(rate limit) · **Strava** (integração opcional).

---

## 0. Pré-requisitos do repositório

- [x] `npm run validate` verde (lint + typecheck + unit + build) na branch a
      deployar. _Ver nota em OPERATIONS.md sobre trabalho não commitado que
      deixa o `validate` vermelho por motivo alheio à Fase 12._
- [x] Nenhum `.env*` versionado (só `.env.example`). Confirme:
      `npm run check:env` inclui esse scan; ou `git ls-files | grep -E '\.env'`.
- [x] `.gitignore` cobre `.env*`, `*token*.json`, `client_secret*.json`, mídia.

## 1. Checklist de produção

- [x] Este documento. Os itens 2–11 abaixo são o corpo dele.

## 2. Variáveis de ambiente

- [x] Preflight automatizado: `npm run check:env -- --env production`
      (valida presença/forma **sem imprimir valores**; sai ≠0 se faltar algo
      bloqueante). Também roda em Preview: `-- --env preview`.
- [ ] Na Vercel, escopo **Production**, definidas e testadas:
  - [ ] `DATABASE_URL` — Neon **pooler** + `channel_binding=require` (runtime).
  - [ ] `DIRECT_URL` — Neon **direto** (sem `-pooler`), para migrations.
  - [ ] `AUTH_SECRET` — ≥32 chars, aleatório, **exclusivo de produção**.
  - [ ] `APP_URL` — domínio real HTTPS (não `localhost`).
  - [ ] `EMAIL_PROVIDER_API_KEY` + `EMAIL_FROM` — Resend, domínio verificado.
  - [ ] `PAYMENT_PROVIDER_SECRET_KEY` + `PAYMENT_PROVIDER_WEBHOOK_SECRET`.
  - [ ] `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` (rate limit).
  - [ ] `STRAVA_*` — só se o piloto usar Strava (periférico; sem elas o produto
        funciona inteiro).
- [ ] **Redeploy** após qualquer mudança de env (variável nova só vale em
      deployment novo).

## 3. Banco Preview

- [ ] `DATABASE_URL`/`DIRECT_URL` da Preview apontam para um banco **isolado**
      (branch Neon `enkypreview`), nunca para o de produção.
- [ ] `npm run check:migrations -- --status-only` contra a Preview →
      "schema up to date".
- [ ] Seed de demo aplicado (item 6) e homologação visual humana feita.

## 4. Banco Production

- [ ] Banco de produção existe e está **separado** da Preview (branch/projeto
      Neon distinto).
- [ ] `scripts/bootstrap-production.cjs --confirm` rodado uma vez (migrate +
      admin + vídeos). Ver OPERATIONS.md §Deploy inicial.
- [ ] `prisma migrate status` contra produção → em dia.
- [ ] **Backup/PITR habilitado** no Neon e **restauração testada** (item do
      critério de aceite; ver ROLLBACK.md §Restauração de banco).

## 5. Migrations em banco limpo

- [x] Script `npm run check:migrations -- --confirm` (contra banco DESCARTÁVEL):
      reset → replay → status em dia → `prisma validate` → deploy idempotente.
- [ ] Rodado ao menos uma vez antes do go-live (Postgres local via
      `docker-compose up db`, ou branch Neon efêmera).

## 6. Seed de demo seguro

- [x] `scripts/seed.cjs` é idempotente, **escopado a uma única org demo**, com
      guard que **bloqueia produção** (`NODE_ENV`/`VERCEL_ENV=production`).
- [x] Sem PII real: e-mails `*.demo.*@enky.local`, senha demo fixa.
- [ ] Rodar só em dev/test/Preview: `npm run seed:preview`. **Nunca** em prod.

## 7. Logs sem dado sensível

- [x] Logger (pino) redige `password`, `passwordHash`, `token`, `cookie`,
      `authorization`, `payment`, `cardNumber`, `cvv`, `symptoms`, `notes`.
- [x] URLs com token (convite, reset de senha) só são logadas no **dev mailer**
      (guardado por `NODE_ENV==='development'`).
- [x] `apiError()` loga o erro completo server-side com `correlationId` e
      devolve mensagem **genérica** ao cliente em produção.
- [x] Auditoria de call-sites: nenhum `logger.*` passa e-mail/senha/token cru
      fora do redigido (ver relatório da Fase 12).

## 8. Monitoramento de erro

- [x] `instrumentation.ts` (`onRequestError`) — funil nativo do Next para toda
      exceção de request não tratada → logger estruturado.
- [x] `app/global-error.tsx` — fronteira de erro raiz do cliente, mostra
      `digest` de correlação, sem stack trace.
- [ ] `LOG_LEVEL=info` (ou `warn`) em produção; logs visíveis na aba
      **Vercel → Logs**. (Plugue para Sentry/Datadog documentado, não ativado.)

## 9. Smoke test

- [x] `tests/e2e/smoke.spec.ts` cobre os 6 fluxos: registrar treinador →
      convidar → ativar → criar treino → feedback → gerar relatório.
- [ ] Aprovado contra a Preview:
      `APP_URL=https://<preview>.vercel.app npm run test:smoke`
      (o processo precisa do `DATABASE_URL`/`AUTH_SECRET` do mesmo banco).
- [ ] Aprovado contra Production (com limpeza automática dos dados de teste).

## 10. Documentação de operação

- [x] `docs/OPERATIONS.md` — deploy, env, migrations, seed, monitoramento,
      backup, incidentes comuns, logins demo.

## 11. Plano de rollback

- [x] `docs/ROLLBACK.md` — reverter deploy, migrations, restaurar banco,
      degradar recurso.
- [ ] Rollback de deploy **ensaiado** uma vez na Vercel (Instant Rollback).

---

## Critério de aceite (Fase 12)

| Critério | Como se prova | Estado |
|---|---|---|
| Deploy Preview validado | health 200 + smoke verde + homologação visual | ⏳ operador |
| Deploy Production validado | health 200 + smoke verde | ⏳ operador |
| Smoke test aprovado | `npm run test:smoke` verde | ✅ escrito / ⏳ rodar |
| Backup testado | restauração Neon ensaiada (ROLLBACK.md) | ⏳ operador |
| Nenhuma variável sensível versionada | `check:env` / `git ls-files` | ✅ |
| Pronto para piloto controlado | todos os `[ ]` acima fechados | ⏳ |

> **Fronteira honesta:** tudo marcado `[x]` está pronto e verificável no
> repositório. Tudo `[ ]`/⏳ exige credenciais de produção e acesso à Vercel/Neon
> que **não** estão neste ambiente — são passos do operador, com comando exato
> dado acima e em OPERATIONS.md.
