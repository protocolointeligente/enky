# modules/workouts

**Responsabilidade:** prescrição de treino e seu conteúdo modular — `Workout`, `WorkoutBlock`, `WorkoutExercise`, `WorkoutStep`, `Exercise`.

**Fonte de verdade:** Data Model Specification v1.2.1 §5; Product & Engineering Specification v1.0 §18–25 (prescrição e modalidades); Interface Architecture v1.4 §6 (Prescrição Manual).

**Regra crítica (Constitution + Product Spec §13):** nunca criar treino sem `athleteId` e `trainerId`; nenhum treino gerado nasce publicado.

**Status (Fase 02C):** implementado — MVP operacional completo.

**Schema canônico:** `prescription-schema.ts` é o único ponto de validação Zod para prescrição de treino (blocos, passos e exercícios); reutilizado por `create-workout-draft.ts` e `update-workout-draft.ts` e por qualquer entrada futura (calendário, templates, periodização). Nunca duplicar esse shape em uma rota ou formulário. `sequence` nunca é aceito do cliente — é sempre derivado da posição no array em `persist-blocks.ts`.

**Serviços:**
- `create-workout-draft.ts` — `createWorkoutDraft()`. Exige `requireTrainerAccessToAthlete` (vínculo ativo), cria `Workout` em `DRAFT`/`MANUAL`, persiste blocos via `persist-blocks.ts`, grava `AuditLog(CREATE_WORKOUT_DRAFT)`. Tudo em uma transação.
- `update-workout-draft.ts` — `updateWorkoutDraft()`. Só permite editar treinos em `DRAFT`; usa `lockVersion` como trava otimista (`updateMany` com `where: {lockVersion}` — `count === 0` vira `ConflictError`); apaga e recria todos os blocos (cascade cuida de steps/exercises órfãos).
- `publish-workout.ts` — `publishWorkout()`. Exige `DRAFT` com ≥1 bloco; transição atômica via `updateMany({where: {status: "DRAFT"}})`; grava `AuditLog(PUBLISH_WORKOUT)`. Nenhuma coluna `publishedAt` foi adicionada — o próprio `AuditLog` é a fonte de verdade de quando a publicação ocorreu.
- `get-trainer-workout.ts` — `getTrainerWorkout()` / `listTrainerAthleteWorkouts()`. Sempre filtra por `organizationId` + `trainerId`; acesso cross-tenant retorna `NotFoundError` (nunca `AuthorizationError`, para não confirmar existência).
- `get-athlete-workout.ts` — `getAthleteWorkout()` / `listAthleteWorkouts()`. `ATHLETE_VISIBLE_STATUSES` exclui `DRAFT`/`IN_PROGRESS`; usa `select` explícito (nunca `include`) para não vazar campos internos de geração/algoritmo ao atleta.

**Fase 02D.2 — calendário, agendamento e duplicação (reutilizam o mesmo schema/guards):**
- `workout-visibility.ts` — `ATHLETE_VISIBLE_STATUSES` / `isAthleteVisibleStatus`. Fonte única de visibilidade do atleta, compartilhada por `get-athlete-workout.ts` e pelo calendário.
- `list-calendar-workouts.ts` — `listTrainerCalendarWorkouts()` / `listAthleteCalendarWorkouts()`. Retornam _cards_ leves (sem árvore de blocos) no período; treinador filtra por atleta/modalidade/status dentro de `organizationId`+`trainerId`; atleta vê só os próprios, com status intersectado com `ATHLETE_VISIBLE_STATUSES`.
- `move-workout.ts` — `moveWorkout()`. Só move `DRAFT`/`PUBLISHED` sem feedback (`MOVABLE_STATUSES`); desloca `plannedStartAt`/`plannedEndAt` pelo delta de dias preservando o horário; transição condicional via `updateMany({where:{status}})`; `AuditLog(MOVE_WORKOUT)`.
- `duplicate-workout.ts` — `duplicateWorkout()`. Copia título/descrição/modalidade/blocos para um novo `Workout` `DRAFT`/`MANUAL`; **nunca** copia feedback/Session-RPE/status/timestamps; exige `requireTrainerAccessToAthlete` no atleta-alvo; `AuditLog(DUPLICATE_WORKOUT)` com `reason: duplicated_from:<id>`.
- `change-workout-status.ts` — `cancelWorkout()` (só `DRAFT`/`PUBLISHED` sem feedback → `CANCELLED`) e `archiveWorkout()` (qualquer status ≠ `ARCHIVED` → `ARCHIVED`). Transição condicional + `AuditLog(CANCEL_WORKOUT|ARCHIVE_WORKOUT)`.
- `workout-content.ts` — `workoutContentInclude` + `workoutBlocksToInput()`: converte blocos persistidos de volta ao `WorkoutBlockInput[]` canônico (Decimal→number). Ponte reutilizada por duplicação e por "salvar como template".
- `schedule-schema.ts` — schemas Zod de `move`/`duplicate` e `parseCalendarRange` (janela máx. 92 dias) / `parseModalityParam` / `parseStatusParam`.

**Regra crítica (Constitution + Product Spec §13):** nunca criar treino sem `athleteId` e `trainerId`; nenhum treino gerado nasce publicado — confirmado pelos testes de integração das Fases 02C e 02D.2.

**Fora de escopo nesta fase (ver relatório final):** periodização automática, marketplace, geração algorítmica e `CalendarEvent` (eventos não-treino). Biblioteca de exercícios e `WorkoutTemplate` passaram a ser implementados em `modules/exercises` e `modules/templates`.
