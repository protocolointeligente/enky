# modules/organizations

**Responsabilidade:** tenant multi-organização — `Organization`, `OrganizationMembership`, enum `OrganizationRole`. Todo isolamento de dados entre treinadores/assessorias passa por aqui.

**Fonte de verdade:** Data Model Specification v1.2.1 §2 e §10 (invariantes de tenant).

**Achado F4 resolvido na Fase 01.5:** organizações multiusuário completas (assessorias) só chegam na Fase 6 do roadmap (ENKY 23 §21). Até lá, cada `TRAINER` recebe uma `Organization` pessoal implícita criada atomicamente em seu cadastro — o dado já nasce isolado por tenant desde o dia 1, sem expor UI de assessoria antes da hora. Decisão completa, incluindo o mecanismo de aplicação das invariantes de tenant (achado F8), em `docs/adr/ADR-001-multitenancy-enforcement.md`.

**Status:** fundação apenas. `prisma/schema.prisma` já contém `Organization` e `OrganizationMembership` mínimos; nenhum serviço de criação/gestão foi implementado.
