# modules/exercises

**Responsabilidade:** biblioteca de exercícios reutilizáveis por organização — modelo `Exercise` (`@@unique([name, organizationId])`).

**Fonte de verdade:** Data Model Specification v1.2.1 §5 (`Exercise`); Interface Architecture v1.4 §6 (biblioteca ↔ prescrição).

**Status (Fase 5):** CRUD + arquivamento suave + metadados de filtro e rastreabilidade de vídeo (migration `20260716120000_exercise_library_metadata`, aditiva — todas as colunas nullable).

**Escopo de tenant:** todo exercício pertence a uma `organizationId`. Exercícios globais (`organizationId = null`) são somente-leitura e aparecem para todas as organizações. Acesso a exercício de outra org retorna `NotFoundError` (nunca confirma existência).

**Schema canônico:** `exercise-schema.ts` — único ponto de validação Zod (`name`, `category`, `targetMuscles`, `modality?`, `equipment?`, `level?`, `description?`, `videoUrl?`, `videoSource?`, `videoLicense?`). `organizationId` nunca é aceito do cliente; é sempre derivado da sessão.

**Deduplicação por caixa/espaço (Fase 5):** o `name` é normalizado no Zod (`trim` + colapso de espaços internos: `"Supino  reto"` → `"Supino reto"`), e a unicidade **case-insensitive** é do banco — os índices parciais `uq_organization_exercise_name` / `uq_global_exercise_name` sobre `LOWER("name")` (migration `20260710104346`). A violação chega como `P2002` e é traduzida para `ConflictError`. A caixa original é preservada para exibição. Provado por `tests/integration/exercise-library.test.ts` ("rejeita duplicata por variação de caixa e de espaço") e `tests/unit/modules/exercises/exercise-schema.test.ts`.

**Rastreabilidade de vídeo (Fase 5):** `videoUrl` (onde), `videoSource` (origem — YouTube/gravação própria/MuscleWiki...) e `videoLicense` (licença ou observação de uso). Campos livres e opcionais — não republicar mídia de terceiros sem crédito registrado.

**Serviços (`exercise-service.ts`):**
- `listExercises()` — retorna os exercícios da org **mais** os globais (`OR: [{organizationId}, {organizationId: null}]`); marca cada item com `isGlobal`/`editable`. Filtros: `search` (nome, insensitive), `category`, `modality`, `muscleGroup` (`targetMuscles has`, exato), `equipment` (contains, insensitive), `level`, `hasVideo` (`videoUrl` nulo ou não) e `includeInactive`.
- `loadOwnedOrGlobalExercise()` — carrega por id validando tenant; cross-org → `NotFoundError`.
- `assertEditable()` — bloqueia edição de exercício global com `AuthorizationError`.
- `createExercise()` / `updateExercise()` — colisão de nome na org (`P2002`) vira `ConflictError`.
- `archiveExercise()` / `reactivateExercise()` — arquivamento suave via `isActive`/`archivedAt` (nunca `delete`, para preservar referências históricas em treinos e templates).

**Auditoria:** `CREATE_EXERCISE`, `UPDATE_EXERCISE`, `ARCHIVE_EXERCISE`, `REACTIVATE_EXERCISE`.

**Integração biblioteca ↔ prescrição:** o `BlocksEditor` (`components/blocks-editor.tsx`) consome `listExercises` via `app/_lib/use-exercise-options.ts` e oferece um `<datalist>` que autopreenche a categoria ao casar o nome — sem acoplar a prescrição ao id do exercício (o nome/categoria é copiado para o bloco, mantendo o treino imutável a mudanças posteriores na biblioteca).

**Fora de escopo nesta fase:** `instructions` estruturado, `imageUrl` e `createdBy` (autoria por usuário); vocabulário controlado de `equipment`/`level` (hoje texto livre — vira enum/tabela se a inconsistência entre treinadores incomodar); busca `muscleGroup` case-insensitive (hoje `has` exato — exigiria índice ou coluna normalizada).
