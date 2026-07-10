# modules/audit

**Responsabilidade:** `AuditLog` — trilha append-only de toda ação sensível da plataforma. Módulo transversal: os demais módulos escrevem nele, ele não depende de nenhum outro.

**Fonte de verdade:** Data Model Specification v1.2.1 §9 e §11 (lifecycle, soft delete, LGPD); Product & Engineering Specification v1.0 §15 (ações que exigem log).

**Regra crítica:** `AuditLog` nunca sofre hard delete. Em anonimização LGPD, perde a associação nominal direta mas preserva estrutura e hashes.

**Status:** fundação apenas. Nenhum modelo, serviço ou rota implementado nesta fase.
