# modules/audit

**Responsabilidade:** `AuditLog` — trilha append-only de toda ação sensível da plataforma. Módulo transversal: os demais módulos escrevem nele, ele não depende de nenhum outro.

**Fonte de verdade:** Data Model Specification v1.2.1 §9 e §11 (lifecycle, soft delete, LGPD); Product & Engineering Specification v1.0 §15 (ações que exigem log).

**Regra crítica:** `AuditLog` nunca sofre hard delete. Em anonimização LGPD, perde a associação nominal direta mas preserva estrutura e hashes.

**Status:** escrita já em uso por toda a plataforma via `domain/audit.ts` (`recordAuditLog` + catálogo `AuditAction`). Leitura (admin básico, Fase 1) em `audit-service.ts`: `getPlatformStats` (contagens cross-tenant) e `listAuditLogs` (trilha recente + ações distintas para filtro). Rotas cross-tenant guardadas por ADMIN/SUPERADMIN: `GET /api/admin/stats`, `GET /api/admin/audit`. UI `/admin`. Sem escopo de organização — o papel é a fronteira.
