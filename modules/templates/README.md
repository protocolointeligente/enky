# modules/templates

**Responsabilidade:** modelos de treino reutilizáveis por organização — `WorkoutTemplate` com `contentSnapshot` (Json).

**Fonte de verdade:** Data Model Specification v1.2.1 §5 (`WorkoutTemplate`); Product & Engineering Specification §18–25 (conteúdo de treino).

**Status (Fase 02D.2):** implementado — CRUD + aplicação + "salvar como template", sem migration.

**Regra crítica — imutabilidade (Product Spec §13):** `contentSnapshot` é uma **cópia** do conteúdo tirada no momento em que o template é criado/salvo. Aplicar um template cria um `Workout` novo (`source = TEMPLATE`, `workoutTemplateId` preenchido) com os blocos copiados — **nunca** uma referência viva. Editar o template não altera treinos já aplicados; editar um treino aplicado não altera o template. Provado pelo teste de integração `workout-templates.test.ts`.

**Schema canônico:** `template-schema.ts` — `templateContentSchema` reutiliza `workoutBlockInputSchema` (o mesmo shape da prescrição); schemas de create/update/apply/`saveWorkoutAsTemplate`. `organizationId` nunca vem do cliente.

**Serviços (`template-service.ts`):**
- `loadOwnedTemplate()` — valida `organizationId`+`trainerId`; cross-org → `NotFoundError`.
- `listTemplates()` / `getTemplate()` — `getTemplate` parseia `contentSnapshot` com `templateContentSchema`.
- `createTemplate()` / `updateTemplate()` — `updateTemplate` incrementa `lockVersion` (trava otimista).
- `archiveTemplate()` — arquivamento suave.
- `duplicateTemplate()` — clona com título `" (cópia)"`; `contentSnapshot: source.contentSnapshot ?? Prisma.JsonNull`.
- `applyTemplate()` — cria `Workout` `DRAFT`/`TEMPLATE` para um atleta+data, persiste os blocos via `persist-blocks.ts`; exige vínculo ativo treinador↔atleta na org; `AuditLog(APPLY_WORKOUT_TEMPLATE)` com `reason: applied_template:<id>`.
- `saveWorkoutAsTemplate()` — lê o conteúdo do treino (`workoutContentInclude` + `workoutBlocksToInput` de `modules/workouts`) e materializa um novo `contentSnapshot`.

**Auditoria:** `CREATE_WORKOUT_TEMPLATE`, `UPDATE_WORKOUT_TEMPLATE`, `ARCHIVE_WORKOUT_TEMPLATE`, `APPLY_WORKOUT_TEMPLATE`, `DUPLICATE_WORKOUT_TEMPLATE`.

**Fora de escopo nesta fase:** periodização (encadear templates num plano), marketplace de templates entre organizações.
