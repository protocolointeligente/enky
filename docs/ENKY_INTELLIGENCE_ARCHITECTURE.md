# ENKY_INTELLIGENCE_ARCHITECTURE.md

**Status:** proposta para aprovação (nenhum código implementado).
**Companheiro de:** [ENKY_DECISION_ENGINE.md](./ENKY_DECISION_ENGINE.md) (a mente — como decide).
**Alinhado a:** ENKY 11, 18, 20, 23 (roadmap), Data Model Specification, Constitution.

---

## 1. Visão geral

O Enky deixa de ser "software de gestão com uma função de IA" e passa a ser uma **plataforma de apoio
à decisão** cujo coração é a **ENKY Intelligence**. Todo o resto do sistema (autenticação, atletas,
prescrição, calendário, biblioteca, feedback, avaliações) continua existindo, mas com um novo papel:
**alimentar e ser consumido pelo motor de inteligência.**

Princípio arquitetural central:

> A ENKY Intelligence é um **serviço central único**, não uma tela. Qualquer módulo do sistema pede
> análises ao mesmo motor, através de um contrato único, e recebe **Insights** explicáveis.

---

## 2. As 5 camadas (ENKY 18) como pipeline

```
Fontes de dados ──▶ (1) INGESTÃO / NORMALIZAÇÃO
   (internas +          adapters por fonte → sinais canônicos (MetricSample)
    wearables)                 │
                               ▼
                    (2) MÉTRICAS DERIVADAS
                        DerivedMetric (versionadas: srpe, acwr, monotony…)
                               │
                               ▼
                    (3) INDICADORES COMPOSTOS
                        prontidão, fadiga contextual, prioridade de atenção…
                               │
                               ▼
                    (4) MOTORES DE DECISÃO  ◀── regras (ENKY_DECISION_ENGINE.md)
                        carga · recuperação · fadiga · adesão · performance …
                               │  produz Insight (6 partes + confiança + log)
                               ▼
                    (5) EXIBIÇÃO CONTEXTUAL
                        InsightCard nos 12 pontos de entrada
```

"Calcular muito, interpretar bem, mostrar apenas o que ajuda a decidir" (ENKY 18, Regra de Ouro).

---

## 3. O serviço central: Intelligence Service

Um único ponto de entrada lógico consumido por todas as telas:

```
analyze(context) → Insight[]
```

- **context**: `{ scope, athleteId?, organizationId, entryPoint, window, actor }`
  - `scope`: ATHLETE | CALENDAR_WEEK | WORKOUT | ROSTER | REPORT | PRESCRIPTION_DRAFT …
  - `entryPoint`: qual tela pede (dashboard, perfil, calendário, feedback…)
- **Insight** (contrato de saída, idêntico ao decision engine):
  `{ observacao, interpretacao, dadosUsados[], confianca, limitacoes, acoesSugeridas[], risco, engine, rulesetVersion, athleteId, createdAt }`

O mesmo serviço serve **on-demand** (a tela pede ao abrir) e **em lote** (cron varre todos os atletas
e pré-computa insights de atenção). A UI nunca fala com um motor específico — só com o serviço.

---

## 4. Motores de inteligência (modulares e independentes)

Cada motor é uma unidade isolada: recebe sinais, aplica suas regras (§ENKY_DECISION_ENGINE), emite
Insights com nível de risco. Podem evoluir/serem versionados separadamente.

| Motor | Pergunta que responde | Sinais principais | Risco típico |
|-------|-----------------------|-------------------|--------------|
| **Análise de carga** | A carga está adequada? | srpe, weekly/acute/chronic, acwr, ramp | médio |
| **Recuperação** | O atleta está se recuperando? | sono, HRV, fadiga, TSB | médio |
| **Fadiga** | Há acúmulo de fadiga? | RPE↑, performance↓, sono↓, monotony/strain | médio→alto |
| **Adesão** | O plano está sendo seguido? | planejado×executado, aderência | baixo |
| **Performance** | O atleta está respondendo? | pace/potência @ RPE/HR, PRs, testes | médio |
| **Risco (contextual)** | Há sinais de risco? | dor, carga agressiva, sequência, pós-lesão | **alto** |
| **Tendências** | Para onde está indo? | séries temporais de carga/prontidão | baixo |
| **Planejado × Executado** | Onde divergiu e por quê? | prescrição vs realizado | baixo |
| **Sugestão de prescrição** | Que próxima sessão faz sentido? | tudo acima + fase/objetivo | médio (rascunho editável) |
| **Explicabilidade** | Por que esta recomendação? | monta "dados usados + regras + confiança" | — (transversal) |

O motor de **Explicabilidade** é transversal: garante que nenhum outro publique um Insight sem as 6
partes e sem log.

---

## 5. Fluxo de dados detalhado

1. **Coleta:** fontes internas (prescrição, feedback, RPE, avaliações) já geram dados; fontes externas
   (wearables) entram via **adapters**.
2. **Normalização:** cada adapter converte o formato da fonte em **sinais canônicos** (um `MetricSample`
   com `{ athleteId, kind, value, unit, measuredAt, source, quality }`).
3. **Derivação:** um job versionado calcula `DerivedMetric` por atleta/período (idempotente pela
   unique key já existente `uq_derived_metric_period`).
4. **Composição:** indicadores compostos (prontidão, fadiga) a partir das métricas derivadas.
5. **Decisão:** os motores rodam as regras e emitem Insights + logs.
6. **Exibição:** Insights são servidos aos `InsightCard` nos pontos de entrada; treinador aceita/edita/ignora → volta como sinal de calibração.

Execução: **lote** (cron diário/near-real-time por org) para pré-computar atenção; **on-demand** para
a tela aberta. Tudo respeitando isolamento por `organizationId`.

---

## 6. Modelos de dados

**Já existentes (reutilizar):**
- `DerivedMetric` — métricas derivadas versionadas (perfeito para a camada 2).
- `Report` — `metricsSnapshot`, `insights`, `recommendations`, `limitations` (relatório interpretativo).
- `Workout.generationRationale` + `confidenceLevel` (`ConfidenceLevel`) — racional de prescrição gerada.
- `WorkoutFeedback` — sRPE, dor, fadiga, recuperação (fonte interna primária hoje).
- `TestResult` — avaliações/testes fisiológicos.

**Propostos (exigem migration — decisão para aprovação, NÃO implementar agora):**
- `MetricSample` — sinais brutos normalizados de qualquer fonte (camada 1). Necessário para wearables.
- `Insight` / `Recommendation` — **reabre a decisão F2** (na Fase 01.5 optou-se por não ter tabela de
  IA). Com a Intelligence no centro e análise contínua em lote, uma tabela de Insights persistidos
  (com estado aceito/ignorado/editado) passa a fazer sentido. **Requer aprovação explícita.**
- `IntelligenceLog` — auditoria das decisões (pode começar reusando `AuditLog` com um tipo dedicado).
- `DataSourceConnection` — credenciais/consentimento por atleta/fonte (Strava/Garmin…).

Enquanto a decisão sobre `Insight`/`MetricSample` não for tomada, a **Fase I** roda sobre os modelos
já existentes (feedback + DerivedMetric + Report), **sem migration**.

---

## 7. Pontos de integração (a inteligência aparece em todo o sistema)

Os 12 pontos de entrada (ENKY 20) consomem o **mesmo** serviço via um componente único **`InsightCard`**:

| Ponto | Insight típico |
|-------|----------------|
| Dashboard treinador | Atletas que precisam de atenção (priorizados por risco) |
| Perfil do atleta | Resumo inteligente: positivos, atenção, dados insuficientes |
| Calendário | Distribuição de intensidade, conflitos, necessidade de recuperação |
| Prescrição manual | Revisar coerência, alertar excesso, sugerir alternativa |
| Geração automática | Rascunho editável + justificativa + confiança + cautelas |
| Sessão de treino | Contexto do treino vs carga recente |
| Feedbacks | Interpretar RPE/dor, planejado×realizado, tendência |
| Análises/Relatórios | Resumir tendências, gerar relatório interpretativo |
| Dashboard atleta | Resumo simples, reforço positivo, sem alarmismo |
| Mensagens | Sugerir comunicação ao atleta (nunca alarmista) |
| Marketplace | Revisar promessa, classificar nível |
| Admin | Treinadores inativos, uso |

**`InsightCard`** (contrato de UI): selo "ENKY Intelligence" + observação + confiança (cor por nível) +
"ver por quê" (expande dados usados/regras/limitações) + ações (aceitar/editar/ignorar). Nunca um
chatbot como elemento principal — um **copiloto** que já analisou e apresenta.

---

## 8. Fontes de dados & adapters

Fontes previstas: **Strava, Garmin, Polar, Coros, Suunto, Intervals.icu** + internas (treino prescrito,
treino realizado, RPE, HR, HRV, sono, questionários, histórico, avaliações físicas, testes
fisiológicos). Padrão **Adapter**: cada fonte implementa `toMetricSamples(raw) → MetricSample[]`. A
mente nunca conhece a fonte — só sinais canônicos. Adicionar uma fonte = adicionar um adapter, sem
tocar nos motores. Consentimento e credenciais por atleta em `DataSourceConnection` (privacidade +
isolamento por org).

---

## 9. Segurança, privacidade e governança

- **Isolamento por tenant** em toda leitura/escrita (`organizationId`), como no resto do sistema.
- **Consentimento** explícito por atleta para dados de wearables; direito de revogar.
- **Auditabilidade** de toda decisão (dados usados, regras, confiança, ação, edição do treinador).
- **Governança de modelos** (ENKY 11): revisão de prompts, casos reais, versionamento de regras,
  atualização científica, feedback dos treinadores.
- **Limites de execução:** o serviço nunca executa ações críticas (cancelar/mover publicado/diagnosticar).

---

## 10. Roadmap da inteligência (faseado)

| Fase | Entrega | Fontes/dados | Migration? |
|------|---------|--------------|------------|
| **I — Prova de valor (MVP Intelligence)** | Motores de **adesão, planejado×executado, carga (sRPE simples), atenção** + `InsightCard` no dashboard/perfil/feedback. Regras determinísticas + LLM só para linguagem. | Só dados internos já coletados (feedback, workout) | Não (usa DerivedMetric/Report) |
| **II — Recuperação & carga** | Prontidão/fadiga, ACWR/monotonia; **questionário de prontidão** (sono/fadiga/dor) para coletar sinais que faltam | Interno + questionários | Leve (questionário) + decisão `Insight` |
| **III — Integrações** | Adapters Strava/Garmin/Intervals; `MetricSample`; HRV/sono reais | Wearables | Sim (`MetricSample`, `DataSourceConnection`) |
| **IV — Motores avançados** | Risco contextual, performance, tendências, **sugestão de prescrição** (rascunho editável) | Tudo acima | Conforme necessário |
| **V — Calibração** | Loop de aprendizado pela aceitação do treinador; modelos estatísticos onde houver dados | Histórico acumulado | — |

A ordem preserva a Constitution: só implementar inteligência sobre dados **reais** já gerados pelos
módulos anteriores (modules/intelligence README: "só ganha código a partir da Fase 5, depois que os
módulos gerarem dados reais" — este roadmap adianta uma **Fase I enxuta e não-destrutiva** que valida
a hipótese sem esperar tudo).

---

## 11. Decisões arquiteturais (aprovadas)

1. **Persistência na Fase I:** ✅ **Reusar `Workout`/`Report`** (recomendações vivem em
   `generationRationale`/`confidenceLevel`/`Report`) — **sem migration**. A tabela `Insight`
   dedicada (reabertura da F2) entra só na **Fase II**.
2. **Motor:** ✅ **Regras determinísticas decidem; o LLM apenas verbaliza** a saída com prudência —
   auditável, barato, sem caixa-preta (alinhado ao limite inviolável 2 do ENKY 11).
3. **Estreia no produto:** ✅ **Fase I estreia em 02G**, após o 02F fechar a qualidade do dado
   "realizado" (feedback). Ver [ENKY_MVP_INTELLIGENCE_REVISION.md](./ENKY_MVP_INTELLIGENCE_REVISION.md) §6.
4. **Execução do lote:** on-demand na Fase I; cron por organização a partir da Fase II.
5. **`MetricSample`:** só na **Fase III** (entrada de wearables).

---

## 12. Impacto na arquitetura atual (o que muda)

- `modules/intelligence` deixa de ser "fundação adiada para Fase 5" e ganha a **Fase I** descrita acima.
- Novo contrato `analyze(context) → Insight[]` como fronteira estável entre motores e telas.
- Novo componente de UI `InsightCard` reutilizável (padrão visual ENKY, selo Intelligence).
- `modules/metrics` implementa a camada de `DerivedMetric` (fórmulas versionadas).
- Nada é removido; prescrição/calendário/feedback passam a **emitir sinais** e **exibir insights**.
