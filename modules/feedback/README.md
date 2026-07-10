# modules/feedback

**Responsabilidade:** `WorkoutFeedback` — feedback pós-treino do atleta e o cálculo oficial de `sessionRpeLoad` (sempre no backend, nunca confiando em valor enviado pelo cliente).

**Fonte de verdade:** Data Model Specification v1.2.1 §6; Product & Engineering Specification v1.0 §26; Interface Architecture v1.4 §7.

**Regra crítica:** `sessionRpeLoad = actualDurationMinutes × sessionRpe`, calculado apenas quando ambos os valores são válidos; `PARTIAL`/`NOT_AVAILABLE`/`INVALID` mantêm o valor `null`.

**Status (Fase 02C):** implementado — MVP operacional completo.

**Cálculo de carga:** `session-rpe.ts` exporta `calculateSessionRpeLoad()`, função pura, única fonte de verdade da fórmula. Regras exatas:
- `COMPLETE` — duração e RPE presentes → `sessionRpeLoad = round(duration × rpe, 2)`.
- `PARTIAL` — apenas um dos dois presente → `sessionRpeLoad = null`.
- `NOT_AVAILABLE` — nenhum dos dois presente (e o treino não foi `MISSED`) → `sessionRpeLoad = null`.
- `INVALID` — `completionStatus: "MISSED"` mas duração e/ou RPE foram enviados mesmo assim (inconsistente) → `sessionRpeLoad = null`.

`feedback-schema.ts` nunca aceita `sessionRpeLoad` do cliente — o Zod descarta silenciosamente qualquer chave desconhecida, então o valor enviado (se houver) nunca chega ao serviço.

**Serviços (`submit-workout-feedback.ts`):**
- `submitWorkoutFeedback()` — exige `Workout.status` em `PUBLISHED`/`IN_PROGRESS`; grava `WorkoutFeedback` e move `Workout.status` para `COMPLETED`/`PARTIAL`/`MISSED` conforme `completionStatus`, na mesma transação. `WorkoutFeedback.workoutId` é `@unique`; uma corrida de dois envios concorrentes é resolvida pela constraint do banco e traduzida para `ConflictError` (nunca vaza o erro cru do Prisma — ver teste de integração de concorrência).
- `updateWorkoutFeedback()` — `WorkoutFeedback` não tem `lockVersion`; a trava otimista usa o `updatedAt` conhecido pelo cliente como condição de `updateMany` (compare-and-swap), igual ao padrão de `lockVersion` usado em `Workout`.
- `get-trainer-workout-feedback.ts` — `getTrainerWorkoutFeedback()`, escopado por `organizationId`/`trainerId`.

**Regra crítica:** dor, fadiga, recuperação e notas em texto livre são dados sensíveis de saúde — nunca entram em `AuditLog` (`reason`/`changedFields`); apenas o fato de que o feedback foi enviado é registrado.

**Fora de escopo nesta fase:** `DerivedMetric` (agregações de carga ao longo do tempo) — feedback individual por treino está pronto, mas o cálculo agregado fica para uma fase futura.
