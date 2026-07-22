# ENKY OS

**Human Performance Intelligence Platform**

> A ENKY transforma dados em compreensão, compreensão em decisão e decisão em performance. A ENKY não substitui o treinador — ela o potencializa.
> — ENKY 00 — Constitution

Plataforma de inteligência esportiva para treinadores, assessorias e atletas: gestão de atletas, calendário, prescrição multiesporte, periodização, feedback, métricas, relatórios, marketplace e pagamentos.

## Status

**Fase 12 — Homologação e preparação para produção (piloto controlado).** Sobre a base operacional
(identidade/auth, convite de atleta, calendário, biblioteca de exercícios, templates, prescrição de
treinos, portal do atleta e feedback/sRPE) e a ENKY Intelligence (motor de atenção determinístico +
persistência de insight + check-in de prontidão), estão implementadas as Fases 6, 8, 9, 10 e 11:
periodização assistida multiesporte, relatórios premium com PDF, painel administrativo, planos e
pagamentos (Asaas atrás de `PaymentProvider`) e integração Strava v1. O estado auditado completo está
em **`docs/ENKY_CURRENT_STATE.md`**.

Validação nesta branch: `npm run validate` verde (**lint + typecheck + 417 testes unitários + build**).
Integração (Vitest + Postgres) e E2E (Playwright) têm specs escritos, mas exigem um banco de teste
isolado para rodar. Ver `docs/PRODUCTION_READINESS.md` para o gate de go-live.

> **Sem merge para `main`, sem Production, sem migration contra banco real.** O que resta para o piloto
> são tarefas do operador (env de produção, banco Preview/Production isolados, backup testado, smoke e
> homologação visual no Preview, ensaio de rollback) — enumeradas como `[ ]` em
> `docs/PRODUCTION_READINESS.md`. **Marketplace** e **Metric Registry** permanecem especificados, sem
> produto funcional.

**Rotas implementadas** (inventário completo em `docs/ENKY_CURRENT_STATE.md` §4):

- **Auth:** `register`, `login`, `logout`, `session`, `password-reset/request`, `password-reset/confirm`
- **Convite de atleta:** `athletes/invitations` (criar/ativar/reenviar/revogar)
- **Treinador:** `trainer/athletes` (+ `roster`, detalhe, periodizações, planned-vs-actual, readiness, reports), `trainer/calendar`, `trainer/exercises` (CRUD + arquivar/reativar), `trainer/templates` (CRUD + aplicar/duplicar/arquivar), `trainer/workouts` (CRUD + publicar/mover/cancelar/arquivar/duplicar/salvar-como-template/feedback/insight), `trainer/periodizations`, `trainer/reports` (PDF/share/revoke), `trainer/billing` (checkout/plans/subscription/cancel), `trainer/intelligence/attention` + `insights/[id]/decision`
- **Atleta:** `athlete/calendar`, `athlete/workouts` (+ `[id]`, `[id]/feedback`), `athlete/readiness`, `athlete/reports` (+ PDF), `athlete/integrations/strava`
- **Admin:** `admin/{stats,users,trainers,athletes,organizations,audit}`
- **Webhooks:** `webhooks/payment-provider`, `webhooks/strava`
- **Infra:** `health`, `novidades`, `exercise-media/[id]`

## Documentos oficiais (fonte única de verdade)

Em caso de conflito, o documento de maior hierarquia prevalece:

1. `docs/enky-os/enky_00_constitution.md` — ENKY 00 — Constitution
2. `docs/enky_os_specification.md` — ENKY OS — Product & Engineering Specification v1.0
3. `docs/enky_interface_specification.md` — ENKY OS — Interface Architecture & Screen Specifications v1.4
4. `docs/enky_data_model_specification.md` — ENKY OS — Data Model Specification v1.2.1
5. `docs/enky-os/enky_24_prompt_master.md` — ENKY 24 — Prompt Master para Claude/Codex

Nenhuma regra de negócio deve ser implementada fora do que esses documentos definem.

Decisões de arquitetura tomadas dentro deste repositório (que não vêm diretamente de um dos 5 documentos acima) ficam registradas em `docs/adr/`, indexadas por `docs/enky-os/enky_os_indice.md`. A matriz de permissões completa está em `docs/enky_role_permission_matrix.md`.

## Stack

- [Next.js](https://nextjs.org) (App Router) + React + TypeScript em modo `strict`
- PostgreSQL + [Prisma ORM](https://www.prisma.io)
- Autenticação por sessão em cookie `httpOnly` (primitivos em `server/auth/`)
- [Zod](https://zod.dev) para validação de entrada
- [Tailwind CSS](https://tailwindcss.com)
- ESLint + Prettier
- [Vitest](https://vitest.dev) (unitário + integração contra PostgreSQL real) + [Playwright](https://playwright.dev) (E2E, specs escritos — pendente rodar contra banco de teste isolado)
- Arquitetura de **monólito modular** — sem microserviços

## Requisitos

- Node.js ≥ 20.9
- npm
- PostgreSQL (local ou remoto) para desenvolvimento com banco real

## Instalação

```bash
npm install
cp .env.example .env
# edite .env com DATABASE_URL e AUTH_SECRET reais
npm run dev
```

## Configuração de ambiente

Todas as variáveis estão documentadas em `.env.example`. As obrigatórias nesta fase:

| Variável       | Descrição                                              |
| -------------- | ------------------------------------------------------ |
| `DATABASE_URL` | String de conexão PostgreSQL usada pelo Prisma         |
| `AUTH_SECRET`  | Segredo de assinatura HMAC da sessão (≥ 32 caracteres) |
| `APP_URL`      | URL base da aplicação                                  |
| `NODE_ENV`     | `development` \| `test` \| `production`                |
| `LOG_LEVEL`    | Nível do logger estruturado (pino)                     |

`.env` nunca é commitado.

## Scripts

```bash
npm run dev              # servidor de desenvolvimento
npm run build             # build de produção
npm run start             # servidor de produção (após build)
npm run lint               # ESLint
npm run typecheck          # TypeScript --noEmit
npm run test                # Vitest (unitário)
npm run test:integration    # Vitest contra PostgreSQL real (requer DATABASE_URL válido)
npm run test:e2e            # Playwright (requer `npx playwright install` antes)
npm run format               # Prettier --write
npm run validate              # lint + typecheck + test + build
npm run prisma:generate        # gera o Prisma Client
npm run prisma:validate         # valida prisma/schema.prisma
npm run prisma:format            # formata prisma/schema.prisma
```

## Estrutura de pastas

```
app/                rotas (App Router), route handlers
components/         componentes de apresentação — sem regra de negócio
modules/            um módulo por domínio (identity, athletes, workouts, ...)
domain/             regras transversais e taxonomia de erros
server/             auth, resposta HTTP padronizada, observabilidade
infrastructure/     acesso a sistemas externos (banco, e futuramente e-mail/storage/pagamento/IA)
lib/                utilitários compartilhados (validação de ambiente)
prisma/             schema.prisma e migrations
tests/              testes unitários (Vitest) e E2E (Playwright)
docs/               documentos oficiais + ARCHITECTURE.md / DEVELOPMENT.md
brand/              identidade visual oficial
```

Ver `docs/ARCHITECTURE.md` para o fluxo de dependência entre camadas.

## Regras de segurança

- Autorização é sempre validada no servidor — o frontend pode ocultar elementos de UI, mas isso nunca é a proteção real.
- Nenhuma credencial, chave ou segredo é commitado no repositório.
- Senhas são hasheadas (`bcryptjs`, 12 rounds) — nunca armazenadas em texto plano. Decisão e critério de reavaliação (Argon2id) em `docs/adr/ADR-002-authentication.md`.
- Sessão opaca e revogável: o cookie `httpOnly`/`secure` em produção/`sameSite=lax` carrega um token aleatório; o banco guarda só o hash. Logout, troca de senha e comprometimento de conta revogam sem depender de expiração — ver `docs/adr/ADR-002-authentication.md`.
- Nenhum dado de cartão, CVV ou validade é recebido ou persistido pela ENKY — apenas tokens do gateway de pagamento.
- Logs redigem automaticamente senha, token, cookie e campos de texto livre que podem conter dados de saúde.
- Nenhum admin é promovido automaticamente por variável de ambiente ou lista de e-mails.
- Toda rota de mutação valida `Origin`/`Referer` (CSRF) e aplica rate limiting antes de tocar o banco — ver `docs/adr/ADR-004-csrf-strategy.md`.
- Login nunca revela se uma conta existe — mesma mensagem genérica para conta inexistente e senha incorreta.

## Proibições de comandos destrutivos

Nunca executar contra um ambiente com dados reais:

- `prisma migrate reset`
- `prisma db push --force-reset`
- seeds que apagam ou sobrescrevem dados existentes
- `git push --force` para `main`

Ver `docs/DEVELOPMENT.md` §"Regras para migrations" para o pipeline seguro de mudança de schema.

## Licença

Todos os direitos reservados. Projeto proprietário — reprodução, distribuição ou uso do código-fonte sem autorização expressa é proibido.
