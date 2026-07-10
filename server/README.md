# server

Camada de adaptação entre o mundo HTTP (rotas do App Router) e o domínio. Rotas e controllers não concentram regras de negócio (ver `docs/ARCHITECTURE.md`) — apenas chamam casos de uso em `domain/` e traduzem o resultado em uma resposta HTTP padronizada.

## Estrutura

- `auth/` — primitivos de autenticação: hashing de senha (`password.ts`), sessão opaca revogável persistida em `Session` (`session.ts`), guards de autorização server-side que leem o papel sempre do banco, nunca de um token (`guards.ts`). Preparados nesta fase; nenhuma rota de login ainda os utiliza — ver Product & Engineering Spec v1.0 §8 e `docs/adr/ADR-002-authentication.md` para a decisão completa.

  **Exceção deliberada ao fluxo de dependência:** `auth/session.ts` e `auth/guards.ts` importam `infrastructure/database/prisma` diretamente. Gestão de sessão é infraestrutura de identidade, não lógica de domínio de negócio — tratá-la como uma exceção documentada evita forçar uma camada de indireção artificial só para preservar a regra geral.

- `http/` — formato padronizado de resposta de API (`response.ts`), que nunca expõe stack trace em produção.
- `observability/` — logging estruturado (`logger.ts`) com redação automática de senha, token, cookie e campos de saúde/texto livre.

## Regras

- Autorização é sempre validada aqui (server-side), nunca apenas no frontend.
- Erros lançados pelo domínio (`AppError` e subclasses) são a única forma esperada de falha de negócio — qualquer outro erro é tratado como inesperado e logado com `correlationId`.
