# ENKY_METRICS_CATALOG.md — Catálogo de métricas → interpretação → decisão

**Base:** ENKY 18 (Métricas), ENKY 11 (Manual da Intelligence), [ENKY_DECISION_ENGINE.md](./ENKY_DECISION_ENGINE.md), [ENKY_INTELLIGENCE_ARCHITECTURE.md](./ENKY_INTELLIGENCE_ARCHITECTURE.md).

> Regra de ouro (ENKY 18): **calcular muito, interpretar bem, mostrar apenas o que ajuda a decidir.**
> Este documento é o mapa completo. Para **cada** grupo de métricas do ENKY 18, a ENKY Intelligence
> deve entregar ao treinador **interpretação + sugestão de decisão** — nunca um gráfico cru. Aqui
> registramos, por grupo: o que mede, a interpretação entregue, a decisão sugerida, a disponibilidade
> do dado hoje e a fase em que entra. É o contrato de conhecimento do motor.

## Pipeline (as 5 camadas do ENKY 18)

```
Dados brutos → Métricas derivadas (DerivedMetric, versionadas) → Indicadores compostos
   → Insight (6 partes: observação, interpretação, dados usados, confiança, limitação, ação)
   → Exibição seletiva (InsightCard no ponto certo)
```

Toda métrica abaixo termina, quando relevante, em **um Insight** — não em um número solto.

## Legenda de disponibilidade de dados

- 🟢 **agora** — já coletado internamente (prescrição, execução, feedback, perfil).
- 🟡 **coletar** — campo/questionário simples a adicionar (ex.: sono, disponibilidade) → migração leve.
- 🔵 **integração** — depende de wearable (Strava/Garmin/Polar…) → `MetricSample` + adapters.
- 🟣 **avaliação** — depende de teste/medida física (antropometria, testes fisiológicos).

---

## 1. Os 26 grupos de métricas

| # | Grupo | Interpretação entregue | Decisão sugerida | Dados | Fase | Hoje |
|---|-------|------------------------|------------------|-------|------|------|
| 1 | **Cadastrais** (idade, sexo, nível, objetivo, histórico) | Contexto que modula todos os limiares e a linguagem | Personaliza faixas de referência por nível/objetivo | 🟢 | I | ⚙️ contexto |
| 2 | **Antropométricas** (peso, altura, composição) | Carga relativa e evolução corporal | Normaliza cargas (ex.: W/kg, kg/peso) | 🟣 | II+ | — |
| 3 | **Disponibilidade** (dias/sem, restrições, equipamento) | Capacidade real de treino | Limita volume/frequência sugeridos | 🟡 | II | — |
| 4 | **Prescrição** (planejado: volume, intensidade, blocos) | O que foi planejado | Base do planejado × executado | 🟢 | I | ✅ |
| 5 | **Execução** (realizado: duração, distância, carga) | O que foi de fato feito | Detecta desvio e aderência | 🟢 | I | ✅ feedback |
| 6 | **Aderência** (realizado/planejado) | Consistência do atleta | Reforçar ou ajustar o plano | 🟢 | I | ✅ atenção/feedback |
| 7 | **Carga externa** (volume, distância, tonelagem) | Dose mecânica acumulada | Progressão de volume | 🟢 | I/II | ⚙️ |
| 8 | **Carga interna** (sRPE, TRIMP) | Custo fisiológico da sessão/semana | Aguda/crônica, ACWR, ramp | 🟢 sRPE · 🔵 TRIMP | I→II | ✅ sRPE |
| 9 | **Intensidade** (pace/FC/potência/RPE, zonas) | Distribuição de intensidade | Polarização/equilíbrio de intensidade | 🟢 alvo · 🔵 real | II/III | ⚙️ alvo |
| 10 | **Volume** (tempo/distância total, séries×reps) | Quantidade de treino | Progressão de volume | 🟢 | I/II | ⚙️ |
| 11 | **Densidade** (trabalho/descanso, frequência) | Concentração da carga | Distribuir melhor a semana | 🟢 | II | — |
| 12 | **Recuperação** (sono, HRV, descanso, recuperação percebida) | Capacidade de absorver carga | Reduzir/manter carga | 🟢 percebida · 🟡 sono · 🔵 HRV | II/III | ⚙️ percebida |
| 13 | **Prontidão** (composto sono+fadiga+dor+estresse+motivação) | Pronto para treinar hoje? | Ajustar a sessão do dia | 🟡/🔵 | II | — |
| 14 | **Fadiga** (RPE↑ + performance↓ + sono↓ + carga↑) | Hipótese de acúmulo de fadiga | Inserir regenerativo | 🟢/🔵 | II | ✅ RPE alto |
| 15 | **Dor/desconforto** (nível, local, lateralidade) | Sinal de segurança (sobrepõe tudo) | Cautela; possível avaliação profissional | 🟢 | I | ✅ segurança |
| 16 | **Performance** (pace/potência @ RPE/HR, PRs, decoupling) | O atleta está respondendo? | Progredir ou investigar plateau | 🟢 parcial · 🔵 real | III | — |
| 17 | **Evolução** (tendências temporais) | Para onde o atleta está indo | Ajuste de macrociclo | 🟢 histórico | III | — |
| 18 | **Por modalidade** (corrida: pace/VDOT/FC · ciclismo: potência/FTP · natação: pace/CSS · força: 1RM/tonelagem/RIR/RPE · funcional · triatlo) | Métricas específicas do esporte | Prescrição específica por modalidade | 🟢/🔵/🟣 | II/III | ⚙️ força/end. |
| 19 | **Risco contextual** (dor + carga agressiva + sequência + pós-lesão + pré-prova) | Convergência de sinais de risco | **Exige validação humana** | 🟢/🔵 | IV | ✅ dor |
| 20 | **Consistência** (regularidade, variância) | Estabilidade do treino | Reforço de hábito | 🟢 | II | — |
| 21 | **Comportamento** (engajamento, pontualidade do feedback) | Adesão comportamental | Sugerir comunicação/lembrete | 🟢 | II | — |
| 22 | **Comunicação** (mensagens, respostas) | Saúde do canal treinador↔atleta | Sugerir mensagem (nunca alarmista) | 🟡 | IV | — |
| 23 | **Comerciais** (vendas, MRR, churn) | Métrica de negócio (fora do foco de treino) | Admin/marketplace | 🟢 (marketplace) | — | — |
| 24 | **Admin** (uso, treinadores inativos, erros) | Saúde da plataforma | Suporte/ação administrativa | 🟢 | — | — |
| 25 | **Qualidade de dados** (completude, recência, consistência) | Quão confiável é a leitura | **Modula a confiança de TODOS os insights** | 🟢 | I | ✅ confiança |
| 26 | **Da Intelligence** (aceitação, edição, utilidade dos insights) | O motor está ajudando de fato? | Calibração de regras/priorização | 🟡 (registrar aceite/ignore) | II | — |

Legenda de "Hoje": ✅ entregue · ⚙️ dado disponível, motor a implementar · — depende de dado/fase futura.

---

## 2. Indicadores compostos (ENKY 18)

Combinam vários grupos em uma leitura única e acionável. Nenhum é diagnóstico — são hipóteses.

| Indicador | Entradas | Saída | Decisão | Fase | Hoje |
|-----------|----------|-------|---------|------|------|
| **Prioridade de atenção** | Treino perdido, dor, aderência, carga, recuperação, prova | baixa / atenção / revisar / urgente | Ordena a carteira do treinador | I | ✅ motor de atenção |
| **Prontidão** | Sono, fadiga, dor, estresse, motivação, carga | boa / atenção / baixa / insuficiente | Ajustar a sessão do dia | II | — (falta sono/HRV) |
| **Fadiga contextual** | RPE↑, performance↓, sono↓, carga↑, sequência intensa | hipótese (não diagnóstico) | Inserir recuperação | II | parcial (RPE) |
| **Equilíbrio semanal** | Treinos, intensos, recuperação, volume, modalidade | equilibrada / carregada / baixa / concentrada | Redistribuir a semana | II | parcial (distribuição por modalidade no calendário) |
| **Qualidade de dados** | Perfil, feedback, treinos, avaliações, zonas | alta / média / baixa / insuficiente | Modula confiança + sugere coletar | I | ✅ (escala de confiança) |
| **Maturidade no sistema** | Tempo, treinos, feedbacks, avaliações | inicial / construção / bom / robusto | Ajusta expectativa de análise | II | — (computável já) |

---

## 3. Como cada métrica vira decisão (contrato)

Para cada grupo, o motor segue o mesmo caminho, já definido em ENKY_DECISION_ENGINE.md:

1. **Deriva** a métrica (versionada em `DerivedMetric`).
2. **Aplica regras** SE→ENTÃO (ciência aplicada, prudência, segurança primeiro).
3. **Exige convergência** de ≥2 sinais para ações de carga; sinal isolado → confiança menor.
4. **Calcula confiança** pela qualidade de dados (grupo 25) — dado escasso nunca vira certeza.
5. **Emite Insight** de 6 partes com a **sugestão de decisão** e o **porquê** (dados + regras + limitações).
6. **Nunca** diagnostica, **nunca** age sozinho; decisões críticas preservam o treinador.

---

## 4. Cobertura atual (02G — Fase I) e lacuna

**Entregue hoje** (regras determinísticas, sem migration, sem LLM):
- Grupos **5, 6, 8 (sRPE), 15, 25** e o indicador **prioridade de atenção** — via `attention.ts` (carteira) e `interpret-feedback.ts` (sessão): dor (urgente), não realizado/parcial, RPE alto, aderência, desvio de duração, execução positiva; confiança escala com o volume de dados.

**Lacuna e como fechar (roadmap da inteligência):**
- **Fase II (sobre dados internos + questionário leve):** carga externa/interna completa (ACWR, monotonia, ramp — grupos 7–11), recuperação/prontidão/fadiga (12–14) com **questionário de sono/prontidão** (🟡, migração leve), consistência/comportamento/maturidade (20, 21, 26), equilíbrio semanal. Introduz a **tabela `Insight`** para persistir aceite/ignorado (grupo 26 — a inteligência aprendendo).
- **Fase III (integrações):** intensidade/performance/evolução reais e métricas por modalidade que dependem de wearables (9, 16, 17, 18) via **`MetricSample` + adapters** (🔵) e avaliações físicas (2, 18 força/end.) (🟣).
- **Fase IV:** risco contextual (19) e comunicação (22) — os de maior risco, com validação humana reforçada.

**Fora do foco de treino:** grupos 23 (comerciais) e 24 (admin) — atendidos por marketplace/admin, não pelo motor de treino.

---

## 5. Princípio que sustenta o catálogo

Ter as métricas **não basta**: o valor está em **interpretá-las e sugerir a decisão**. Por isso cada
linha desta tabela obriga o motor a responder as 4 perguntas (o que aconteceu / por que / o que fazer
/ qual a confiança). Uma métrica que não vira decisão explicável **não é exibida** — vira, no máximo,
um dado "ver por quê". É isso que separa a ENKY Intelligence de um dashboard de gráficos.
