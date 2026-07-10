# modules/identity

**Responsabilidade:** conta de usuário (`User`), papel global (`Role`), autenticação e ciclo de vida da sessão.

**Fonte de verdade:** Data Model Specification v1.2.1 §2 (`User`, enum `Role`); Product & Engineering Specification v1.0 §8 (Autenticação, Papéis).

**Status (Fase 02B):** cadastro, login e logout implementados.

- `register-trainer.ts` — `registerTrainer()`: cria atomicamente `User`+`TrainerProfile`+`Organization` pessoal+`OrganizationMembership(OWNER)` (ADR-001), abre `Session`, registra `AuditLog`.
- `login.ts` — `login()`: mensagem genérica contra enumeração de conta, comparação de tempo constante mesmo quando a conta não existe.
- `logout.ts` — `logout()`: revoga a `Session` atual (idempotente).
- `password-policy.ts` — schema Zod de senha (comprimento antes de composição, NIST 800-63B).
- `normalize-email.ts` — normalização de e-mail (trim + lowercase) usada em todo o módulo.

Rotas em `app/api/auth/{register,login,logout,session}/route.ts`. Guards em `server/auth/guards.ts`. Recuperação de senha ainda não implementada — fora do escopo da Fase 02B.
