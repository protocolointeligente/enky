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

**Regra crítica (Constitution + Product Spec §13):** nunca criar treino sem `athleteId` e `trainerId`; nenhum treino gerado nasce publicado — confirmado pelos testes de integração da Fase 02C.

**Fora de escopo nesta fase (ver relatório final):** periodização automática, marketplace, geração algorítmica, `WorkoutTemplate` (clonagem) e `CalendarEvent`.
