# modules/intelligence

**Responsabilidade:** ENKY Intelligence — camada contextual e explicável, nunca chat genérico. Interpreta dados reais, nunca diagnostica, nunca publica ou move treino sozinha.

**Fonte de verdade:** Product & Engineering Specification v1.0 §31–32 (formato padrão de insight); Constitution, Princípios 2, 8, 15, 16.

**Achado F2 resolvido na Fase 01.5:** `AIRecommendation` e `AthleteInsight` foram substituídas — a recomendação vive em `Workout.generationRationale`/`confidenceLevel` e em `Report`, sem tabela própria de IA no MVP. Ver `enky_os_specification.md` §12.

**Status (02G — Fase I):** motor de **atenção** implementado (`attention.ts`). Regras determinísticas sobre os dados que já existem (workouts + feedback), sem migration e sem LLM — a decisão é feita por regras e a verbalização é por template prudente. Estreia no dashboard do treinador via `InsightCard`. Ver `docs/ENKY_DECISION_ENGINE.md` (a mente) e `docs/ENKY_INTELLIGENCE_ARCHITECTURE.md`.

- `attention.ts` — `analyzeRosterAttention(actor, now)` varre a carteira (escopo org+treinador) e devolve, por atleta que precisa de atenção, um `Insight` (formato de 6 partes) do sinal de maior prioridade: dor (urgente, sobrepõe tudo) → treinos perdidos → RPE alto → aderência baixa → retorno pendente. `evaluate(bucket)` é a função pura das regras (testada em `tests/unit`).
- **Nunca** diagnostica, **nunca** age sozinha; confiança escala com a quantidade de dados.

Fases seguintes (ver roadmap): recuperação/carga (ACWR, prontidão) na Fase II, com a tabela `Insight` dedicada e questionários; integrações wearable na Fase III.
