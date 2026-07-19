# modules/organizations

**Responsabilidade:** tenant multi-organização — `Organization`, `OrganizationMembership`, enum `OrganizationRole`. Todo isolamento de dados entre treinadores/assessorias passa por aqui.

**Fonte de verdade:** Data Model Specification v1.2.1 §2 e §10 (invariantes de tenant).

**Achado F4 resolvido na Fase 01.5:** organizações multiusuário completas (assessorias) só chegam na Fase 6 do roadmap (ENKY 23 §21). Até lá, cada `TRAINER` recebe uma `Organization` pessoal implícita criada atomicamente em seu cadastro — o dado já nasce isolado por tenant desde o dia 1, sem expor UI de assessoria antes da hora. Decisão completa, incluindo o mecanismo de aplicação das invariantes de tenant (achado F8), em `docs/adr/ADR-001-multitenancy-enforcement.md`.

**Status:** fundação. `prisma/schema.prisma` contém `Organization` e `OrganizationMembership`; a criação da org pessoal mora em `modules/identity/register-trainer.ts` (papel `OWNER`).

## Etapa 4 — papéis e identidade da assessoria

- **Papéis organizacionais** (§4): `OrganizationRole` estendido para 8 papéis (OWNER, MANAGER, HEAD_COACH, COACH, ASSISTANT_COACH, FINANCE, SUPPORT, VIEWER). `ADMIN` é legado ⇒ MANAGER. Lista atribuível e rótulos em [`org-roles.ts`](./org-roles.ts) (fonte única); imposição em runtime por `requireOrgRole` (`server/auth/guards.ts`); matriz em [`docs/ENKY_CRM_PERMISSIONS.md`](../../docs/ENKY_CRM_PERMISSIONS.md).
- **Identidade comercial** (§3): `Organization` ganhou `legalName, document, email, phone, website, logoUrl` (todos opcionais). Migração aditiva `20260719120000_org_foundation_roles`.
- **Diferido:** `status` (lifecycle 4-estados — hoje `isActive` já é o gate de suspensão) e defaults de faturamento entram nas fatias que os consomem.
- **Não confundir** identidade da org (comercial) com `TrainerProfile.companyName/crefCode` (identidade profissional do treinador).
