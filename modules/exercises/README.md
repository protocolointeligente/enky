# modules/exercises

**Responsabilidade:** biblioteca de exercícios reutilizáveis por organização — modelo `Exercise` (`@@unique([name, organizationId])`).

**Fonte de verdade:** Data Model Specification v1.2.1 §5 (`Exercise`); Interface Architecture v1.4 §6 (biblioteca ↔ prescrição).

**Status (Fase 02D.2):** implementado — CRUD + arquivamento suave, sem migration (reutiliza o schema existente).

**Escopo de tenant:** todo exercício pertence a uma `organizationId`. Exercícios globais (`organizationId = null`) são somente-leitura e aparecem para todas as organizações. Acesso a exercício de outra org retorna `NotFoundError` (nunca confirma existência).

**Schema canônico:** `exercise-schema.ts` — único ponto de validação Zod (`name`, `category`, `targetMuscles`, `videoUrl?`). `organizationId` nunca é aceito do cliente; é sempre derivado da sessão.

**Serviços (`exercise-service.ts`):**
- `listExercises()` — retorna os exercícios da org **mais** os globais (`OR: [{organizationId}, {organizationId: null}]`); filtros de busca/categoria/`includeInactive`; marca cada item com `isGlobal`/`editable`.
- `loadOwnedOrGlobalExercise()` — carrega por id validando tenant; cross-org → `NotFoundError`.
- `assertEditable()` — bloqueia edição de exercício global com `AuthorizationError`.
- `createExercise()` / `updateExercise()` — colisão de nome na org (`P2002`) vira `ConflictError`.
- `archiveExercise()` / `reactivateExercise()` — arquivamento suave via `isActive`/`archivedAt` (nunca `delete`, para preservar referências históricas em treinos e templates).

**Auditoria:** `CREATE_EXERCISE`, `UPDATE_EXERCISE`, `ARCHIVE_EXERCISE`, `REACTIVATE_EXERCISE`.

**Integração biblioteca ↔ prescrição:** o `BlocksEditor` (`components/blocks-editor.tsx`) consome `listExercises` via `app/_lib/use-exercise-options.ts` e oferece um `<datalist>` que autopreenche a categoria ao casar o nome — sem acoplar a prescrição ao id do exercício (o nome/categoria é copiado para o bloco, mantendo o treino imutável a mudanças posteriores na biblioteca).

**Fora de escopo nesta fase:** campos ricos (descrição/equipamento/nível/instruções/imagem/`createdBy`) e índice parcial único — adiáveis como migration aditiva quando o isolamento de banco Preview/Production estiver pronto.
