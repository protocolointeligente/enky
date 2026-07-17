# modules/audit

**Responsabilidade:** `AuditLog` — trilha append-only de toda ação sensível da plataforma. Módulo transversal: os demais módulos escrevem nele, ele não depende de nenhum outro.

**Fonte de verdade:** Data Model Specification v1.2.1 §9 e §11 (lifecycle, soft delete, LGPD); Product & Engineering Specification v1.0 §15 (ações que exigem log).

**Regra crítica:** `AuditLog` nunca sofre hard delete. Em anonimização LGPD, perde a associação nominal direta mas preserva estrutura e hashes.

**Status:** escrita em uso por toda a plataforma via `domain/audit.ts` (`recordAuditLog` + catálogo `AuditAction`).

**Leitura mora em `modules/admin`** (Fase 9). O antigo `audit-service.ts` (`getPlatformStats` + `listAuditLogs`) foi absorvido por `modules/admin/admin-service.ts`: quem lê a trilha é só o painel administrativo, e manter a leitura aqui deixava a autorização (papel ADMIN/SUPERADMIN) longe do módulo que a exige. Este módulo é hoje o lado de **escrita** da trilha; `modules/admin` é o lado de leitura/operação.
