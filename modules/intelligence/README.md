# modules/intelligence

**Responsabilidade:** ENKY Intelligence — camada contextual e explicável, nunca chat genérico. Interpreta dados reais, nunca diagnostica, nunca publica ou move treino sozinha.

**Fonte de verdade:** Product & Engineering Specification v1.0 §31–32 (formato padrão de insight); Constitution, Princípios 2, 8, 15, 16.

**Achado F2 resolvido na Fase 01.5:** `AIRecommendation` e `AthleteInsight` foram substituídas — a recomendação vive em `Workout.generationRationale`/`confidenceLevel` e em `Report`, sem tabela própria de IA no MVP. Ver `enky_os_specification.md` §12.

**Status:** fundação apenas. Este módulo só deve ganhar código a partir da Fase 5 do roadmap (ENKY 23 §19), depois que os módulos anteriores estiverem gerando dados reais.
