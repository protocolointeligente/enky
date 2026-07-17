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

Como o `fingerprintOf` é `athleteId:engine:versão:janela:regras`, `sinaisAusentes`/`janela` legível podem mudar entre varreduras da mesma semana **sem** criar linha nova — o aceito/ignorado do treinador é preservado (testado).

**Prontidão** entra como sinal (presente/ausente + classe do último check-in), **nunca** como regra própria: a heurística de `readiness.ts` segue experimental e não decide carga sozinha. O check-in (`ReadinessCheckIn`) coleta sono, fadiga, dor muscular, estresse, motivação, **humor**, **disposição**, **dor localizada** (texto livre, redigido em log) e observação — todos opcionais; menos sinais reduzem a confiança para "insuficiente".

**Linguagem (obrigatória, testada em `homologation.test.ts`):** proibido "prever lesão", "previsão/risco de lesão", "propenso a lesão", "iminente" e linguagem de certeza — em **qualquer** texto exposto, inclusive limitações. O vocabulário é "sinal de atenção", "carga elevada", "contexto de cautela". A decisão final é sempre do treinador.

**Status (02H → Fase 03 — máquina de estados persistente):** a tabela `Insight` (migrations `20260712120000_add_insight_lifecycle` + `20260718100000/…100_insight_state_machine`) grava o ciclo **detecção→exposição→ação→resultado** com uma máquina de estados completa:

- **Estados:** `NEW` (exposto, não visto) → `VIEWED` (treinador abriu) → `ACCEPTED`/`IGNORED` (decisão) → `RESOLVED` (encerrado com `outcome`). `EXPIRED` é aplicado pela varredura quando a situação some antes de qualquer decisão — nunca sobrescreve uma decisão. `PENDING` é legado, reconciliado para `NEW`.
- **Dedup:** `fingerprintOf` = `athleteId:engine:versão:janela-ISO:regras`. A mesma situação em semana nova (ou após bump de `RULESET_VERSION`) é um insight novo — dedup por atleta, regra, contexto, **janela temporal e versão**.
- `insight-store.ts` — `upsertExposedInsights(actor, insights, now?)` grava a exposição (idempotente) e expira o que ficou aberto e não voltou à varredura; devolve `{ id, status, note, outcome }`. `resolveInsight(id, actor, { status?, note?, outcome? }, now)` registra visto/aceito/ignorado/resolvido + nota + resultado, com escopo org+treinador e `AuditLog` (`RESOLVE_INSIGHT`). Cada `Insight` pode apontar para um `workoutId` (opcional).
- Rotas: `GET /api/trainer/intelligence/attention` (persiste + devolve estado); `POST /api/trainer/intelligence/insights/[id]/decision`.
- `fingerprintOf`/`isoWeekKey` (em `insight.ts`) são puros e testados (`tests/unit/.../fingerprint.test.ts`); o ciclo/expiração é coberto por `tests/integration/insight-lifecycle.test.ts`.

Fases seguintes (ver roadmap): cron/lote por organização; integrações wearable e `MetricSample`.
