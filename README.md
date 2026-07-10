# ENKY OS

**Human Performance Intelligence Platform**

> A ENKY transforma dados em compreensão, compreensão em decisão e decisão em performance. A ENKY não substitui o treinador — ela o potencializa.
> — ENKY 00 — Constitution

Plataforma de inteligência esportiva para treinadores, assessorias e atletas: gestão de atletas, calendário, prescrição multiesporte, periodização, feedback, métricas, relatórios, marketplace e pagamentos.

## Status

**Fundação técnica (Fase 01).** Este repositório contém a base estrutural do projeto — projeto Next.js configurado, arquitetura de monólito modular, autenticação preparada, Prisma inicializado com um schema mínimo. Nenhuma tela, dashboard, marketplace, motor de geração de treinos ou funcionalidade de produto foi implementada ainda. Ver `docs/DEVELOPMENT.md` para o que "pronto" significa em cada entrega.

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
- [Vitest](https://vitest.dev) (unitário) + [Playwright](https://playwright.dev) (E2E, preparado)
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

## Proibições de comandos destrutivos

Nunca executar contra um ambiente com dados reais:

- `prisma migrate reset`
- `prisma db push --force-reset`
- seeds que apagam ou sobrescrevem dados existentes
- `git push --force` para `main`

Ver `docs/DEVELOPMENT.md` §"Regras para migrations" para o pipeline seguro de mudança de schema.

## Licença

Todos os direitos reservados. Projeto proprietário — reprodução, distribuição ou uso do código-fonte sem autorização expressa é proibido.
