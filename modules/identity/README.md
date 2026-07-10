# modules/identity

**Responsabilidade:** conta de usuário (`User`), papel global (`Role`), autenticação e ciclo de vida da sessão.

**Fonte de verdade:** Data Model Specification v1.2.1 §2 (`User`, enum `Role`); Product & Engineering Specification v1.0 §8 (Autenticação, Papéis).

**Status:** fundação apenas. Os primitivos técnicos (hash de senha, sessão assinada em cookie httpOnly, guards de autorização) já existem em `server/auth/`. Nenhum fluxo de cadastro, login ou recuperação de senha foi implementado nesta fase.
