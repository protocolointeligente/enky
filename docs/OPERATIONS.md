# ENKY — Operação (runbook do piloto)

Guia curto para operar o ENKY no piloto controlado. Complementa
`PRODUCTION_READINESS.md` (o gate) e `ROLLBACK.md` (quando algo dá errado).

## Topologia

- **Deploy:** Vercel, framework Next.js. `main` → Production; toda branch/PR →
  Preview automático.
- **Banco:** Neon Postgres, projeto `Enky-Production`. Branch `enkypreview` para
  Preview; produção em branch/endpoint próprio. Compute **auto-suspende**: a 1ª
  query pós-ocioso pode dar cold-start (5–15s) — não é falha.
- **Conexão:** runtime usa o host **pooler** (`-pooler`) com
  `channel_binding=require`. Migrations usam `DIRECT_URL` (host **direto**, sem
  pooler, `sslmode=require`, **sem** `channel_binding` — quebra o Prisma nesta
  stack, reporta P1001).
- **E-mail:** Resend. **Pagamento:** Asaas (webhook em
  `/api/webhooks/payment-provider`). **Rate limit:** Upstash Redis REST.
  **Integração:** Strava (opcional).

## Deploy inicial (banco de produção novo)

Rode **local**, apontando as URLs para produção (o passo de vídeos lê catálogo
`.xlsx` não versionado; a Vercel/Neon não dão shell one-off):

```bash
# 1. Preflight — confere env sem imprimir segredo
npm run check:env -- --env production

# 2. Bootstrap idempotente: migrate deploy + admin + vídeos
DATABASE_URL='<pooler...>' DIRECT_URL='<direto...>' \
ADMIN_EMAIL='admin@enky.com.br' ADMIN_PASSWORD='<forte>' \
node scripts/bootstrap-production.cjs --confirm
```

O **catálogo de planos** NÃO tem passo de seed — quem o semeia é a migration
`20260716140000_subscription_billing` (+ `20260717120000_plan_catalog_pricing`).
Fonte única. Nunca reintroduza um `seed-plans` (já brigou com a migration e
causou 23505 em produção).

## Deploy contínuo

1. Merge para `main` (ou promova o Preview). Vercel builda e publica.
2. Se a mudança tem **migration nova**: rode `prisma migrate deploy` contra
   produção com `DIRECT_URL` **antes ou logo após** o deploy do código — o app
   novo assume o schema novo. Migrations do ENKY são aditivas por disciplina;
   ainda assim veja ROLLBACK.md para o caso de uma migration incompatível.
3. Confirme saúde: `curl https://<dominio>/api/health` → `{"status":"ok",...}`.
4. Rode o smoke (§Smoke) se a mudança tocou um dos 6 fluxos críticos.

## Variáveis de ambiente

- Preflight: `npm run check:env -- --env production|preview`. Não imprime valor.
- Lista completa e comentada: `.env.example`. Regras de validação: `lib/env.ts`.
- **Sempre redeploy** após mudar env na Vercel — variável nova só vale em
  deployment novo.
- Rotacionar `AUTH_SECRET` **invalida toda sessão e todo convite pendente** e
  **obriga cada atleta a reconectar o Strava** (tokens são cifrados com chave
  derivada dele). Faça só em incidente de segurança.

## Migrations

```bash
# Status (não destrutivo) — pode rodar contra qualquer ambiente
DIRECT_URL='<direto...>' npm run check:migrations -- --status-only

# Validação em banco LIMPO/descartável (reset → replay → idempotência)
DATABASE_URL='<descartável>' DIRECT_URL='<descartável>' \
  npm run check:migrations -- --confirm

# Aplicar em produção (parte do bootstrap; ou avulso num deploy com migration)
DIRECT_URL='<direto...>' npx prisma migrate deploy
```

Regra dura: migration aplicada é **imutável**. Corrigir = migration nova, nunca
editar a antiga (muda o checksum e diverge dos bancos que já a rodaram).

## Seed de demo

- Só dev/test/Preview. O script **bloqueia** produção.
  `npm run seed:preview` popula 1 org demo (Ana/Bruno/Carla/Diego).
- Logins demo (senha `EnkyDemo2026`): `treinador.demo.preview@enky.local`,
  atleta `atleta.demo.preview@enky.local`.
- Idempotente: rodar de novo converge ao mesmo estado; toca só a org demo.

## Monitoramento

- **Erros de servidor:** `instrumentation.ts` (`onRequestError`) manda toda
  exceção de request não tratada ao logger; `apiError()` cobre as rotas. Veja em
  **Vercel → Deployment → Logs**, filtrando `level>=50` (error). Cada erro tem
  `correlationId`/`digest` — é o código que o usuário informa ao suporte.
- **Erros de cliente:** `app/global-error.tsx` mostra o `digest` correlato.
- **Saúde:** `GET /api/health` (público, sem cache). Use num uptime-check
  externo (ex.: cron a cada 5 min) para saber se a instância está de pé.
- **Escalar depois:** o plugue para Sentry/Datadog é `instrumentation.ts`. Não
  foi ativado de propósito — "sem abrir escala antes da estabilidade".

## Backup

- Neon mantém history/PITR conforme o plano. Confirme a janela de retenção no
  console e **teste uma restauração** (ROLLBACK.md §Restauração de banco) antes
  do piloto — backup não testado não conta.

## Incidentes comuns

| Sintoma | Causa provável | Ação |
|---|---|---|
| P1001 "can't reach database" | cold-start Neon, ou `channel_binding` na URL | reabrir/repetir; tirar `channel_binding` do `DIRECT_URL` |
| Convite "enviado" mas sem e-mail | `EMAIL_*` ausente | conferir env Resend + domínio verificado; ver logs |
| Checkout/webhook de pagamento falha | `PAYMENT_PROVIDER_*` ausente/errado | conferir key + token do webhook no Asaas; URL HTTPS |
| Rate limit fraco / zera no redeploy | `UPSTASH_*` ausente → memória por instância | configurar Upstash + redeploy |
| Rotas de Strava respondem 422 | `STRAVA_*` ausente | esperado se não configurado; é periférico |
| Erro 500 genérico ao usuário | exceção não tratada | achar pelo `correlationId`/`digest` nos logs |

## Trava conhecida do repositório

`npm run validate` pode estar **vermelho** por trabalho em paralelo não
commitado (Fases 9–11: `report-premium.test.ts` erro de tipo, overload de Buffer
em `crypto.ts`, `calendar-schedule.test.ts` vs. limite do plano grátis). Isso é
alheio à Fase 12 — resolva antes do go-live, mas não bloqueia a escrita destes
artefatos. Detalhe na memória do projeto (`enky-roadmap-backlog`).
