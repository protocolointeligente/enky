# modules/workouts

**Responsabilidade:** prescrição de treino e seu conteúdo modular — `Workout`, `WorkoutBlock`, `WorkoutExercise`, `WorkoutStep`, `Exercise`.

**Fonte de verdade:** Data Model Specification v1.2.1 §5; Product & Engineering Specification v1.0 §18–25 (prescrição e modalidades); Interface Architecture v1.4 §6 (Prescrição Manual).

**Regra crítica (Constitution + Product Spec §13):** nunca criar treino sem `athleteId` e `trainerId`; nenhum treino gerado nasce publicado.

**Status:** fundação apenas. Nenhum modelo, serviço ou rota implementado nesta fase.
