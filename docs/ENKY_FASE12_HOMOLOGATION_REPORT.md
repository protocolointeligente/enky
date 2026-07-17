# ENKY — Fase 12: Homologação e Preparação para Produção

**Data:** 2026-07-17 · **Objetivo:** preparar o ENKY para piloto real com
treinadores, sem abrir escala antes da estabilidade.

Este relatório mapeia cada item de escopo e cada critério de aceite ao que ficou
**pronto no repositório** (verificável agora) vs. o que é **passo do operador**
contra a infra viva (Vercel/Neon/Resend/Asaas), que exige credenciais fora deste
ambiente. A fronteira é declarada de propósito — não há "pronto" fingido.

## Entregáveis criados nesta fase

| Arquivo | Item | O que é |
|---|---|---|
| `docs/PRODUCTION_READINESS.md` | 1 | Checklist mestre de go/no-go do piloto |
| `scripts/check-env.cjs` + `npm run check:env` | 2 | Preflight de env sem imprimir segredo; scan de `.env` versionado |
| `scripts/verify-migrations.cjs` + `npm run check:migrations` | 5 | Valida a cadeia de migrations em banco limpo (reset→replay→idempotência) |
| `instrumentation.ts` | 8 | `onRequestError` nativo do Next → logger estruturado |
| `app/global-error.tsx` | 8 | Fronteira de erro raiz do cliente com `digest` de correlação |
| `tests/e2e/smoke.spec.ts` + `npm run test:smoke` | 9 | Smoke dos 6 fluxos pela UI real |
| `docs/OPERATIONS.md` | 10 | Runbook de operação do piloto |
| `docs/ROLLBACK.md` | 11 | Plano de rollback (deploy/migration/banco/degradação) |

## Escopo, item a item

**1. Checklist de produção** — ✅ `docs/PRODUCTION_READINESS.md`, com os 11 itens
e a tabela de critério de aceite, separando `[x]` repo de `[ ]` operador.

**2. Validar variáveis de ambiente** — ✅ `npm run check:env -- --env production`.
Espelha as regras de `lib/env.ts`, roda antes do app subir, **nunca imprime
valor** (só presença + comprimento mascarado). Distingue bloqueante (DB, AUTH,
APP_URL, e-mail/pagamento em prod) de recomendado (Upstash) e periférico
(Strava). Testado: sai com código ≠0 quando falta variável.

**3. Validar banco Preview** — ⏳ operador. Procedimento e comando em
PRODUCTION_READINESS §3 e OPERATIONS §Migrations
(`check:migrations -- --status-only` contra a `enkypreview`). Requer credencial
da Preview.

**4. Validar banco Production** — ⏳ operador. Procedimento em READINESS §4:
`bootstrap-production.cjs --confirm` + `migrate status`. Requer credencial de
produção.

**5. Validar migrations em banco limpo** — ✅ script + ⏳ execução. O
`check:migrations --confirm` prova reset→replay→status em dia→validate→deploy
idempotente contra um banco **descartável**; tem guard que recusa
`NODE_ENV=production`. Falta o operador rodá-lo uma vez (Postgres local ou branch
Neon efêmera).

**6. Seed de demo seguro** — ✅ já era seguro e foi auditado: `scripts/seed.cjs`
é idempotente, escopado a **uma** org demo, com guard que **bloqueia produção**
(`NODE_ENV`/`VERCEL_ENV`), e-mails `@enky.local` (sem PII real), senha demo
fixa. Nenhuma mudança de código foi necessária — a segurança já estava no lugar.

**7. Revisar logs para não expor dados sensíveis** — ✅ auditoria feita:
- O logger (`server/observability/logger.ts`) redige `password`, `passwordHash`,
  `token`, `cookie`, `authorization`, `payment`, `cardNumber`, `cvv`, `symptoms`,
  `notes`.
- Todos os ~30 call-sites de `logger.*` foram lidos: logam `userId`, `eventId`,
  `correlationId`, `ip`, `messageId` — nada de credencial crua.
- URLs com token (convite, reset de senha) só são logadas no **dev mailer**,
  guardado por `NODE_ENV==='development'`; em Preview/Production o token nunca sai
  no log.
- `apiError()` loga o erro completo server-side com `correlationId` e devolve
  mensagem **genérica** ao cliente em produção (nada de stack trace vazado).
- Nenhum vazamento encontrado → nenhuma correção necessária.

**8. Configurar monitoramento de erro** — ✅ dois hooks nativos, zero dependência
nova (coerente com "sem abrir escala antes da estabilidade"):
- `instrumentation.ts` `onRequestError` captura toda exceção de request não
  tratada no servidor (render de Server Component, rota, middleware) e a manda
  ao logger — o funil que faltava além do `apiError()`.
- `app/global-error.tsx` é a fronteira de erro raiz do cliente, exibindo o
  `digest` de correlação sem stack trace.
- O plugue para Sentry/Datadog fica documentado em OPERATIONS §Monitoramento,
  deliberadamente **não** ativado ainda.

**9. Criar smoke tests** — ✅ `tests/e2e/smoke.spec.ts` cobre os 6 fluxos pela UI
real: (1) registrar treinador `/registrar` → (2) convidar atleta → (3) ativar →
(4) criar+publicar treino → (5) atleta enviar feedback → (6) treinador gerar e
compartilhar relatório. Roda contra o deployment via `APP_URL`. Um único ponto
toca o banco (re-carimba o `tokenHash` do convite) porque o token de ativação
nunca volta por HTTP e em prod sai por e-mail real — documentado no cabeçalho do
spec. Limpa os dados que cria.

**10. Documentação de operação** — ✅ `docs/OPERATIONS.md`: topologia, deploy
inicial e contínuo, env, migrations, seed, monitoramento, backup, tabela de
incidentes comuns, logins demo.

**11. Plano de rollback** — ✅ `docs/ROLLBACK.md`: árvore de decisão, Instant
Rollback da Vercel, roll-forward de migration, restauração Neon (PITR) com teste
obrigatório, degradação por recurso.

## Critério de aceite

| Critério | Estado | Nota |
|---|---|---|
| Deploy Preview validado | ⏳ operador | procedimento + comandos prontos (READINESS §3) |
| Deploy Production validado | ⏳ operador | procedimento + comandos prontos (READINESS §4) |
| Smoke test aprovado | ✅ escrito / ⏳ rodar | `npm run test:smoke` contra Preview/Prod |
| Backup testado | ⏳ operador | roteiro de teste em ROLLBACK §3 |
| Nenhuma variável sensível versionada | ✅ **atingido** | `.env*` no `.gitignore`; só `.env.example` rastreado; `check:env` confirma |
| Pronto para piloto controlado | ⏳ | destrava quando os 4 ⏳ acima fecharem |

## O que falta para o go-live (só operador, com credencial)

1. Definir as env vars de **Production** na Vercel e `check:env -- --env production` verde.
2. `bootstrap-production.cjs --confirm` no banco de produção (migrate + admin + vídeos).
3. `check:migrations --confirm` uma vez num banco descartável.
4. `npm run test:smoke` verde contra Preview **e** Production.
5. Ensaiar restauração Neon (backup testado) e um Instant Rollback.
6. Homologação visual humana no Preview.
7. Resolver a trava de `npm run validate` herdada das Fases 9–11 (ver OPERATIONS
   §Trava conhecida) antes de promover para `main`.

Fechados esses sete, o critério "pronto para piloto controlado" está satisfeito.
