# ENKY_DECISION_ENGINE.md — A mente do Enky

**Status:** proposta para aprovação (nenhum código implementado).
**Alinhado a:** ENKY 11 (Manual da Intelligence), ENKY 18 (Métricas), ENKY 20 (Intelligence no Produto), Constitution.
**Companheiro de:** [ENKY_INTELLIGENCE_ARCHITECTURE.md](./ENKY_INTELLIGENCE_ARCHITECTURE.md).

> Este documento define **como o Enky decide** — a camada de raciocínio que transforma dados em
> decisões. Ele é deliberadamente escrito **antes** de telas e integrações, porque é esta camada
> que diferencia o Enky de um "resumidor de gráficos". A arquitetura serve a esta mente; não o contrário.

---

## 1. Propósito e postura

O Enky **não mostra dados — ele interpreta**. Para cada atleta, continuamente, responde a quatro
perguntas e entrega uma recomendação **explicável, prudente e acionável** ao treinador.

O motor de decisão obedece a três limites invioláveis (ENKY 11):

1. Não substitui a responsabilidade profissional do treinador (copiloto, não piloto).
2. Não apresenta incerteza como certeza.
3. Não recomenda decisão crítica sem contexto suficiente.

E ao princípio ético inegociável: **ajudar o treinador a decidir melhor sem criar falsa autoridade,
falsa precisão ou falsa segurança.**

---

## 2. As quatro perguntas (contrato de saída)

Toda análise produz um **Insight** que responde, nesta ordem:

| Pergunta | Campo do insight | Natureza |
|----------|------------------|----------|
| O que aconteceu? | **Observação** | Fato derivado dos dados |
| Por que aconteceu? | **Interpretação** | Hipótese fundamentada em ciência do treino |
| O que fazer agora? | **Ação sugerida** (opções) | Recomendação prudente, nunca ordem |
| Qual a confiança? | **Confiança + Limitações** | Grau + o que falta / o que é incerto |

Isso mapeia diretamente o **Formato Padrão de Insight** (ENKY 20, §Formato) — 6 partes:
Observação → Interpretação → Dados usados → Confiança → Limitação → Ação sugerida.

O motor **nunca** retorna prosa livre sem essa estrutura.

---

## 3. Evidências que o motor utiliza (taxonomia de sinais)

Nenhum sinal é interpretado isoladamente (Princípio 3). Cada sinal carrega **fonte, recência e
peso de confiabilidade**.

| Grupo | Sinais | Papel na decisão |
|-------|--------|------------------|
| **Segurança** | Dor/desconforto (nível, região, lateralidade), lesão relatada | **Sobrepõe tudo** — veto a aumentos |
| **Carga interna** | sRPE (RPE × duração), TRIMP (se HR) | Base de dose de treino |
| **Carga externa** | Volume, distância, duração, tonelagem, nº de sessões | Contexto da carga interna |
| **Prontidão** | Sono (h/qualidade), HRV, fadiga percebida, humor/estresse, motivação | Capacidade de absorver carga |
| **Execução** | Planejado × realizado, aderência, desvios | O plano está sendo seguido? |
| **Performance** | Pace/potência a dado RPE/HR (decoupling), PRs, testes/avaliações | O atleta está respondendo? |
| **Contexto** | Fase (base/build/pico), proximidade de prova, nível, histórico, modalidade | Modula limiares e risco |
| **Qualidade de dados** | Completude, recência, consistência | Modula **confiança**, não a decisão |

Fontes futuras (Strava, Garmin, Polar, Coros, Suunto, Intervals.icu) alimentam **os mesmos grupos**
— a mente não muda quando a fonte muda; ver arquitetura, §Fontes.

---

## 4. Métricas e fórmulas (versionadas)

O motor computa métricas derivadas persistidas como `DerivedMetric` (`metricKey`, `metricValue`,
`periodStart/End`, **`formulaVersion`**). Toda fórmula é versionada para auditoria e evolução
científica sem reescrever o histórico.

| metricKey | Fórmula (v1) | Faixa de referência | Ressalva |
|-----------|--------------|---------------------|----------|
| `srpe_load` | RPE(0–10) × duração(min) | — | Já coletado no feedback |
| `weekly_load` | Σ `srpe_load` (7 d) | — | Precisa de aderência p/ ser fiel |
| `chronic_load` | EWMA 28–42 d de `srpe_load` diário | — | Exige histórico ≥4 sem |
| `acute_load` | EWMA 7 d | — | — |
| `acwr` | `acute_load` / `chronic_load` | 0.8–1.3 ok · >1.5 risco · <0.8 subcarga | Correlação, não causalidade; sensível a dados faltantes |
| `training_stress_balance` | `chronic_load` − `acute_load` | negativo = fadiga; positivo = frescor | Proxy simples de "forma" |
| `monotony` | média diária / desvio-padrão diário (7 d) | >2.0 = monótono | Precisa de variação real registrada |
| `strain` | `weekly_load` × `monotony` | alto = risco | — |
| `ramp_rate` | Δ% `weekly_load` semana-a-semana | > +30% = agressivo | — |
| `adherence` | realizado / planejado | <70% = baixa | Distingue "não fez" de "não relatou" |
| `readiness_index` | composto (§5.4) | boa/atenção/baixa/insuficiente | Hipótese, não diagnóstico |
| `hrv_deviation` | (HRV 7 d − baseline 60 d) / CV | — | Só com wearable; ruído alto |

Cada métrica declara: **entradas, definição, faixas, ressalvas e `formulaVersion`**. Faixas são
**pontos de partida ajustáveis por modalidade/nível**, nunca dogmas (Princípio 4).

---

## 5. O núcleo: regras de decisão

Regras determinísticas e legíveis, no formato **SE → ENTÃO (hipótese · ação · risco · confiança-base)**.
A camada de linguagem (LLM) apenas **verbaliza** a saída da regra com prudência — não decide sozinha.
Cada regra acionada é registrada no insight ("regras científicas consideradas").

### 5.1 Sobreposições de SEGURANÇA (avaliadas primeiro, vetam o resto)
- **Dor moderada+ ou lesão relatada** → nunca sugerir aumento; sugerir cautela, possível suspensão
  para avaliação, registro de sintomas, conversa com profissional. **Nunca diagnostica** (Regras de Saúde, ENKY 11). Risco **alto** → validação humana.
- **Retorno pós-lesão / pré-competição** → postura conservadora; risco **alto** → validação humana.

### 5.2 Quando **REDUZIR** carga (exige convergência de ≥2 sinais independentes)
- `acwr` > 1.5 **ou** `ramp_rate` > +30%/sem;
- `monotony` > 2.0 **e** `strain` elevado;
- Prontidão baixa persistente (sono↓ **e** HRV↓/fadiga↑) por ≥2–3 dias;
- Performance↓ ao mesmo RPE/HR (decoupling) **com** RPE↑;
- Sequência de sessões intensas sem regenerativo.
→ **Ação:** "considere reduzir volume/intensidade da próxima sessão intensa e confirmar sono/dor/percepção." Risco **médio→alto**.

### 5.3 Quando **AUMENTAR** carga (progressão)
- `adherence` ≥ ~90% por ≥2–3 semanas **e**
- `acwr` < 0.8 (subcarga) **e** prontidão boa **e** sem dor **e**
- Fase de construção (não polimento).
→ **Ação:** "pode-se considerar aumento pequeno (~5–10%) com monitoramento." Risco **baixo→médio**.

### 5.4 Quando **MANTER**
- Sinais estáveis, `acwr` 0.8–1.3, aderência boa, sem dor, prontidão adequada.
→ **Ação:** "manter o plano; seguir monitorando."

### 5.5 Índice de prontidão (composto, §ENKY 18)
`readiness_index` = função ponderada de sono, HRV, fadiga, dor e carga recente → boa / atenção /
baixa / **dados insuficientes**. Entra como sinal em 5.2/5.3, nunca como decisão isolada.

---

## 6. Como a mente lida com dados conflitantes

1. **Hierarquia de confiabilidade:** segurança (dor) > convergência de sinais objetivos
   (HRV+sono+performance) > sinal objetivo isolado > percepção única.
2. **Regra de convergência:** nenhuma métrica isolada gera recomendação de carga crítica
   (Princípios 3 e 4). Ação de carga exige **≥2 sinais independentes** na mesma direção.
3. **Conflito real** (ex.: HRV bom, porém RPE alto e performance baixa) → **reduz a confiança**,
   apresenta as **duas leituras** ao treinador e sugere coletar mais dados / confirmar com o atleta.
4. **Recência:** sinais antigos pesam menos (decay temporal); um dado de 3 semanas atrás não
   sustenta uma recomendação de hoje.
5. **Ausência de dados** → não inventa: "dados insuficientes", confiança **baixa**, ação = **coletar**
   (qual dado coletar e por quê).

---

## 7. Cálculo de confiança (explícito, nunca opaco)

A confiança é uma função transparente de cinco fatores, mapeada ao enum `ConfidenceLevel`
(BAIXA / MÉDIA / ALTA / NOT_ASSESSED):

| Fator | Aumenta confiança | Diminui confiança |
|-------|-------------------|-------------------|
| **Completude** | sinais-chave presentes | lacunas nos sinais que a regra exige |
| **Histórico** | ≥4–8 semanas de dados | histórico curto |
| **Convergência** | ≥2–3 sinais concordam | sinais divergem |
| **Recência** | dados recentes | dados antigos |
| **Consistência** | baixa variância / boa qualidade | ruído alto, buracos |

Esquema simples e auditável (v1): pontuar cada fator (0–2), somar, mapear a faixas → nível. O insight
**sempre** lista "fatores que aumentam/diminuem a confiança". Mesmo com **alta** confiança, decisões
críticas preservam a decisão humana (ENKY 11).

---

## 8. Explicabilidade (contrato anti-caixa-preta)

Todo insight relevante retorna, além das 4 perguntas:
- **Dados usados:** lista de métricas com **valor, período e fonte** (ex.: `acwr=1.6` [7d/28d], `sono=5.5h` [ontem]);
- **Regras científicas consideradas:** identificadores das regras acionadas (§5) + referência conceitual;
- **Fatores de confiança:** o que a sustenta e o que a enfraquece;
- **Limitações:** o que falta para uma leitura mais segura.

A verbalização segue a linguagem prudente (§9). Estrutura primeiro, prosa depois.

---

## 9. Linguagem e guardrails

- **Verbos de copiloto:** "considere", "pode ser prudente", "sugere", "avalie", "revise" —
  **nunca** "faça", "cancele", "está lesionado", "a prescrição ideal é".
- **Ações que o motor NÃO executa sozinho** (ENKY 20): cancelar treino, alterar carga sensível,
  mover sessão publicada, diagnosticar, prescrever tratamento, bloquear atleta, alertar de forma
  alarmista, mexer em marketplace/pagamento/papel.
- **Saúde:** não diagnostica doenças/lesões, não prescreve tratamento; **pode** orientar cautela,
  suspensão para avaliação, registro de sintomas, conversa com profissional.
- **Anti fadiga de alerta:** poucos alertas, priorizados por risco, cada um com motivo + nível +
  ação + dados + opção de ignorar (ENKY 18).

---

## 10. Auditoria e aprendizado

Cada decisão gera um log (ENKY 20, Logs Obrigatórios): tipo de análise, usuário, atleta, **dados
usados, resposta, confiança, ação sugerida, aceita/ignorada, edição do treinador, timestamp,
`rulesetVersion`**. O log alimenta o loop de melhoria: a taxa de aceitação/edição do treinador
calibra priorização e prompts (governança). Regras e fórmulas são **versionadas** — nada é reescrito
retroativamente.

---

## 11. Casos trabalhados (fim a fim)

**Caso A — fadiga acumulada.** `acwr`=1.6, `ramp_rate`=+35%, sono 5.5 h por 3 dias, RPE↑.
→ Observação: carga aguda 60% acima da crônica, sono abaixo da linha de base.
Interpretação: acúmulo de fadiga; risco de má adaptação. Ação: "considere trocar a próxima sessão
intensa por regenerativo e confirmar sono/dor." Confiança: **média** (2 sinais convergentes, sem HRV).
Risco: médio → sugerido ao treinador.

**Caso B — progressão segura.** Aderência 95% por 3 semanas, `acwr`=0.9, prontidão boa, sem dor,
fase de base. → Ação: "pode-se considerar +5–10% de volume com monitoramento." Confiança: **alta**.

**Caso C — dados insuficientes.** Atleta novo, 1 feedback, sem sono/HRV. → "Não há dados suficientes
para sugerir alteração segura. Coletar RPE e recuperação nas próximas sessões." Confiança: **baixa**.

---

## 12. Fora de escopo (desta camada, por ora)

- Diagnóstico clínico ou previsão determinística de lesão ("vai lesionar");
- Prescrição autônoma sem revisão do treinador;
- ML treinado end-to-end — **o MVP começa com regras determinísticas + LLM só para linguagem**;
  modelos estatísticos entram depois, quando houver dados reais suficientes;
- Integrações wearable em tempo real (fase posterior; a mente já é projetada para recebê-las).

---

## 13. Por que isto vem antes das telas

Definida a mente, cada tela vira apenas uma **superfície de exibição** do mesmo motor (um
`InsightCard`), e cada integração vira apenas **mais uma fonte** para os mesmos sinais. Sem esta
camada, a "IA" degenera em resumo de dados — exatamente o que este documento existe para evitar.
