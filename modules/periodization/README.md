# modules/periodization

**Responsabilidade:** camada estratégica do planejamento — `Periodization`, `PeriodizationPhase`, `TrainingWeek`, `GenerationBatch`, e a `PeriodizationGenerationEngine` (geração assistida de treinos).

**Fonte de verdade:** Data Model Specification v1.2.1 §3–4; ENKY 25 — Periodização; Interface Architecture v1.4 §5.

**Achado F3 resolvido na Fase 01.5:** origem = `WorkoutSource.PERIODIZATION_GENERATED` (motor) ou `MANUAL` (prescrição manual vinculada); automatismo = `generationMode` (`AUTOMATIC`/`ASSISTED`). Ver ENKY 25 §8 e Data Model v1.2.1 §1/§5.

**Status:** fundação apenas. Nenhum modelo, serviço ou rota implementado nesta fase.
