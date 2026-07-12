# modules/periodization

**Responsabilidade:** camada estratégica do planejamento — `Periodization`, `PeriodizationPhase`, `TrainingWeek`, `GenerationBatch`, e a `PeriodizationGenerationEngine` (geração assistida de treinos).

**Fonte de verdade:** Data Model Specification v1.2.1 §3–4; ENKY 25 — Periodização; Interface Architecture v1.4 §5.

**Achado F3 resolvido na Fase 01.5:** origem = `WorkoutSource.PERIODIZATION_GENERATED` (motor) ou `MANUAL` (prescrição manual vinculada); automatismo = `generationMode` (`AUTOMATIC`/`ASSISTED`). Ver ENKY 25 §8 e Data Model v1.2.1 §1/§5.

**Status:** produto v1 — camada estratégica MANUAL. `periodization-service.ts` cria/lista/lê/exclui `Periodization` + `PeriodizationPhase` + `TrainingWeek` (semanas derivadas da janela por `deriveWeeks`); a leitura conta treinos já agendados na janela de cada semana (sem exigir FK). Rotas: `POST/GET /api/trainer/athletes/[athleteId]/periodizations`, `GET/DELETE /api/trainer/periodizations/[id]`. UI: `/treinador/periodizacao`.

**Ainda não implementado (Fase 5):** o motor `PeriodizationGenerationEngine` (`GenerationBatch`, `generationMode` AUTOMATIC/ASSISTED) — geração assistida de treinos depende de dados acumulados. O vínculo explícito treino↔semana (`Workout.trainingWeekId`) também fica para quando a geração existir; o v1 casa por sobreposição de datas.
