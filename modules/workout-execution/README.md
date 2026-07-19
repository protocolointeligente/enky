# modules/workout-execution

Execução de treino do atleta (Etapa 6). Ver [ADR-006](../../docs/adr/ADR-006-athlete-execution-and-pwa-foundation.md).

## Arquivos

| Arquivo | Papel |
|---------|-------|
| `execution-state.ts` | **Lógica pura** (sem React/IO, `now` injetado): state machine (`nextStatus`/`isTerminal`), dedupe+ordenação idempotente (`dedupeAndOrder`), tempo por timestamp (`computeTime`), redução de eventos (`reduce`), `formatDuration`. |
| `execution-schema.ts` | Schemas Zod de entrada (`startExecutionInputSchema`, `appendEventsInputSchema`). |
| `start-execution.ts` | Inicia execução: ownership+visibilidade, execução ativa única (§45), idempotência, snapshot imutável + `workoutVersion` (§18-19), auditoria `WORKOUT_EXECUTION_STARTED`. |
| `append-events.ts` | Anexa eventos (append-only), reconcilia status/tempos pela redução pura, atualiza a execução, audita só a transição terminal. |

## Modelo

`WorkoutExecution` (1 tentativa) → `WorkoutExecutionEvent[]` (log append-only).
Status derivado dos eventos, **não** de `Workout.status` (o feedback é a fonte da
verdade do treino). Estados: `STARTED → PAUSED ↔ STARTED → COMPLETED | PARTIALLY_COMPLETED | ABANDONED`.

## API

- `POST /api/athlete/workouts/[id]/execution/start` → cria/retorna execução (idempotente).
- `POST /api/athlete/executions/[id]/events` → anexa lote de eventos (PAUSE/RESUME/STEP_COMPLETED/COMPLETE/ABANDON…); status recalculado.

## Testes

`tests/unit/modules/workout-execution/execution-state.test.ts` — tempo com pausa/background,
conclusão parcial, idempotência de terminal, ordenação, formatação.

## Pendências

Hook `useExecutionTimer` (glue React) e UI por modalidade vêm com a tela de execução.
