# ENKY OS — Arquitetura Técnica

Este documento descreve a arquitetura de engenharia do repositório. Ele não substitui nem reinterpreta os documentos oficiais de produto — em caso de dúvida sobre regra de negócio, a hierarquia abaixo prevalece.

## Hierarquia documental oficial

1. ENKY 00 — Constitution
2. ENKY OS — Product & Engineering Specification v1.0
3. ENKY OS — Interface Architecture & Screen Specifications v1.4
4. ENKY OS — Data Model Specification v1.2.1
5. ENKY 24 — Prompt Master para Claude/Codex

## Monólito modular

A ENKY é um único deploy (monólito), organizado internamente em módulos de domínio com fronteiras explícitas — não microserviços. Cada módulo em `modules/<domínio>/` é responsável por um pedaço coeso do negócio (identidade, atletas, treinos, periodização, marketplace etc.) e não deve depender dos detalhes internos de outro módulo.

## Camadas e fluxo de dependência

```
app/            rotas (App Router), server components, route handlers
components/     apresentação React reutilizável — sem regra de negócio
        ↓
modules/*       orquestração de cada domínio (casos de uso específicos do módulo)
        ↓
domain/         regras de negócio transversais, tipos e erros (AppError e subclasses)
        ↓
infrastructure/ acesso a sistemas externos: banco de dados (Prisma), e futuramente
                e-mail, armazenamento, pagamento, IA
```

A dependência flui em uma direção só: `app`/`components` podem chamar `modules` e `server`; `modules` podem chamar `domain` e `infrastructure`; nada em `domain` ou `infrastructure` importa de `app`, `components` ou `modules`.

`server/` é a camada de adaptação HTTP (auth, formato de resposta de API, logging) compartilhada por todas as rotas — ver `server/README.md`.

**Exceção documentada:** `server/auth/session.ts` e `server/auth/guards.ts` importam `infrastructure/database/prisma` diretamente, pulando a camada `modules`/`domain`. Gestão de sessão é infraestrutura de identidade transversal, não lógica de domínio de negócio — ver `docs/adr/ADR-002-authentication.md`.

Regras (ENKY 24 — Prompt Master §4, §22):

- componentes React não concentram regra de negócio;
- rotas e route handlers não concentram regra de negócio — apenas validam entrada, chamam um caso de uso e formatam a resposta (`server/http/response.ts`);
- regras de negócio ficam em `domain/` e nos serviços de cada `modules/<domínio>/`;
- acesso ao banco fica isolado em `infrastructure/database/` — nenhum outro módulo importa `@prisma/client` diretamente;
- nenhuma query operacional confia apenas em IDs recebidos do cliente sem revalidar propriedade/tenant no servidor.

## Multi-tenancy

Toda entidade operacional pertence a uma `Organization` (Data Model Specification v1.2.1 §2, §10). Nesta fase de fundação, o schema contém apenas `User`, `Organization`, `OrganizationMembership` e `Session` (infraestrutura de auth, ver ADR-002) — o restante do modelo de dados de produto (28 modelos, 22 enums) é implementado em uma fase dedicada.

**Decisão registrada (ADR-001):** organizações multiusuário completas (assessorias com múltiplos treinadores) são um recurso de Fase 6 do roadmap. Até lá, todo `TRAINER` recebe uma `Organization` pessoal implícita no cadastro, para que o isolamento de tenant já exista desde a primeira entidade criada, sem expor UI de assessoria antes da hora. Ver `docs/adr/ADR-001-multitenancy-enforcement.md`.

O mecanismo concreto de aplicação das invariantes de tenant é resolução de tenant no servidor (nunca aceito do frontend) com filtro obrigatório por `organizationId` em toda query de serviço de domínio; Row-Level Security do PostgreSQL fica como defesa em profundidade adiada — ver ADR-001 para a decisão completa e seus critérios de reavaliação.

## Autorização server-side

Autorização nunca é decidida apenas no frontend. `server/auth/guards.ts` expõe `requireIdentity()` e `requireRole()`, que devem ser chamados no início de todo route handler ou server action que acesse dado protegido. O papel é sempre lido do banco no momento da requisição (nunca cacheado no token de sessão — ver ADR-002), para que uma alteração de papel ou desativação de conta tenha efeito imediato. O papel global (`Role`: `SUPERADMIN`/`ADMIN`/`TRAINER`/`ATHLETE`) e a segunda camada por organização (`OrganizationRole`) têm sua matriz de permissões completa em `docs/enky_role_permission_matrix.md`.

## Padrão de erros e resposta HTTP

Toda falha de negócio é uma subclasse de `AppError` (`domain/errors.ts`): `ValidationError`, `AuthenticationError`, `AuthorizationError`, `NotFoundError`, `ConflictError`, `BusinessRuleError`, `ExternalServiceError`. Route handlers capturam exceções e delegam a `server/http/response.ts`, que:

- mapeia cada `AppError` para seu `httpStatus` e `code` correspondentes;
- para erros não mapeados, loga o erro completo no servidor e retorna apenas uma mensagem genérica ao cliente quando `NODE_ENV=production` — nunca stack trace.

## Observabilidade

`server/observability/logger.ts` usa logging estruturado (pino) com redação automática de senha, token, cookie e campos de texto livre que podem conter dados de saúde (`notes`, `symptoms`). Logs de desenvolvimento são formatados para leitura humana; logs de produção são JSON puro.

## Convenções

- Import absoluto via alias `@/*` apontando para a raiz do repositório (ex.: `@/domain/errors`).
- Um módulo de domínio por pasta em `modules/`; ver `modules/README.md` para a lista completa e a ordem de implementação.
- Nenhum segredo em código-fonte — sempre via variável de ambiente documentada em `.env.example`.
