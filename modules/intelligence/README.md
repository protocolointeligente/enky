# modules/intelligence

**Responsabilidade:** ENKY Intelligence — camada contextual e explicável, nunca chat genérico. Interpreta dados reais, nunca diagnostica, nunca publica ou move treino sozinha.

**Fonte de verdade:** Product & Engineering Specification v1.0 §31–32 (formato padrão de insight); Constitution, Princípios 2, 8, 15, 16.

**Achado F2 resolvido na Fase 01.5:** `AIRecommendation` e `AthleteInsight` foram substituídas — a recomendação vive em `Workout.generationRationale`/`confidenceLevel` e em `Report`, sem tabela própria de IA no MVP. Ver `enky_os_specification.md` §12.

**Status (02G — Fase I):** motor de **atenção** implementado (`attention.ts`). Regras determinísticas sobre os dados que já existem (workouts + feedback), sem migration e sem LLM — a decisão é feita por regras e a verbalização é por template prudente. Estreia no dashboard do treinador via `InsightCard`. Ver `docs/ENKY_DECISION_ENGINE.md` (a mente) e `docs/ENKY_INTELLIGENCE_ARCHITECTURE.md`.

- `attention.ts` — `analyzeRosterAttention(actor, now)` varre a carteira (escopo org+treinador) e devolve, por atleta que precisa de atenção, um `Insight` do sinal de maior prioridade: dor (urgente, sobrepõe tudo) → carga elevada (ACWR/ramp) → treinos perdidos → RPE alto → aderência baixa → retorno pendente. `evaluate(bucket)` é a função pura das regras (testada em `tests/unit`).
- **Nunca** diagnostica, **nunca** age sozinha; confiança escala com a quantidade de dados.

**Status (Fase 7 — explicabilidade):** o contrato `Insight` obriga todo motor a explicar a origem da conclusão. Além de motivo/interpretação/ações/confiança/limitações, são **obrigatórios**:

- `dadosUsados` — os sinais presentes que sustentam o motivo;
- `sinaisAusentes` — o que o motor **não** tinha ao concluir (retorno, RPE, histórico de carga, prontidão, e sempre sono/HRV objetivos, que o sistema não recebe). A lacuna é parte do insight: o treinador precisa ver o tamanho do ponto cego;
- `janela` — o contexto temporal da leitura (28 dias para os sinais recentes; 90 dias para a carga).

Como o `fingerprintOf` é `athleteId:engine:regras`, `sinaisAusentes`/`janela` podem mudar entre varreduras **sem** criar linha nova — o aceito/ignorado do treinador é preservado (testado).

**Prontidão** entra como sinal (presente/ausente + classe do último check-in), **nunca** como regra própria: a heurística de `readiness.ts` segue experimental e não decide carga sozinha.

**Linguagem (obrigatória, testada em `homologation.test.ts`):** proibido "prever lesão", "previsão/risco de lesão", "propenso a lesão", "iminente" e linguagem de certeza — em **qualquer** texto exposto, inclusive limitações. O vocabulário é "sinal de atenção", "carga elevada", "contexto de cautela". A decisão final é sempre do treinador.

**Status (02H — persistência do ciclo):** a tabela `Insight` foi criada (migration `20260712120000_add_insight_lifecycle`) reabrindo a decisão F2, agora com aprovação explícita. O motor continua calculando on-the-fly; o store grava o ciclo **detecção→exposição→ação→resultado**:

- `insight-store.ts` — `upsertExposedInsights(actor, insights)` grava a exposição na leitura da carteira (uma linha por `fingerprintOf` = `athleteId:engine:regras`, idempotente) e devolve cada Insight com `{ id, status, outcome }`. `resolveInsight(id, actor, { status?, outcome? })` registra aceitar/ignorar (a ação) e o resultado, com escopo org+treinador e `AuditLog` (`RESOLVE_INSIGHT`).
- Rotas: `GET /api/trainer/intelligence/attention` (agora persiste + devolve estado); `POST /api/trainer/intelligence/insights/[id]/decision`.
- `fingerprintOf` (em `insight.ts`) é puro e testado; o ciclo é coberto por `tests/integration/insight-lifecycle.test.ts`.

Fases seguintes (ver roadmap): questionário de prontidão/recuperação e cron/lote por organização na Fase II; integrações wearable e `MetricSample` na Fase III.
