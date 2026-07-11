# ENKY_METRIC_REGISTRY.md — Registro-mestre de métricas de performance (v1.0)

**Status:** documento-base (design). Nenhuma métrica em produção sem passar pelos Critérios de Aceitação (§Aceitação).
**Base:** ENKY PERFORMANCE METRICS REGISTRY v1.0, ENKY 18, [ENKY_DECISION_ENGINE.md](./ENKY_DECISION_ENGINE.md), [ENKY_METRICS_CATALOG.md](./ENKY_METRICS_CATALOG.md), [ENKY_INTELLIGENCE_ARCHITECTURE.md](./ENKY_INTELLIGENCE_ARCHITECTURE.md).

> Princípio central: **muitos campos ≠ base científica superior.** Cada métrica só entra quando tem
> definição operacional, dados de entrada, fórmula versionada, unidade, escopo esportivo, limitações,
> nível de evidência, interpretação e regra de uso. O diferencial da ENKY não é a quantidade de
> métricas — é **selecionar, validar, combinar e explicar** cada uma.

## Registro-padrão (campos por métrica, §5)

`metric_key` · `name_pt` · `name_en` · `category` · `source_data` · `formula_version` ·
`formula_reference` · `unit` · `sport_scope` · `validity_level` · `limitations` · `interpretation` ·
`decision_rules` · `reference_ids` · `is_explainable` · `is_prescriptive` · `confidence_score` · `status`.

**Legendas.** `validity_level`: 🟩 consolidado · 🟨 razoável · 🟧 experimental. `status`: `núcleo-MVP` ·
`futura` · `experimental` · `administrativa` · `duplicada` · `rejeitada`. `sport_scope`: END (corrida/
ciclismo/natação/triatlo) · FOR (força/funcional) · ALL.

> ⚖️ **Nota jurídica (Risco §11).** NP™, TSS™, IF™, FTP e VDOT™ são marcas/algoritmos proprietários
> (TrainingPeaks / Jack Daniels). A ENKY **não reproduz** o algoritmo proprietário: usa **equivalentes
> abertos e documentados** (sRPE, TRIMP, Critical Power/Velocity, Efficiency Factor, desacoplamento) e
> trata NP/FTP/VDOT como **referência conceitual**, com implementação própria versionada.

---

## A. Carga e intensidade (§7.1)

### `srpe_load` — Carga sessão-RPE (session-RPE load)
- **cat:** carga interna · **unit:** UA (AU) · **sport:** ALL · **status:** núcleo-MVP · **fase:** I (já usado) · 🟩
- **source_data:** RPE (CR-10), duração (min).
- **formula_v1:** `sRPE = RPE × duração_min`. **ref:** Foster et al., 2001.
- **interpretation:** dose interna de treino, independente de equipamento.
- **decision_rules:** base para carga aguda/crônica; sem RPE → coletar.
- **limitations:** subjetivo; RPE deve ser coletado ~30 min pós-sessão.
- **explainable:** sim · **prescriptive:** sim (via carga) · **confidence:** alta se RPE presente.

### `trimp` — TRIMP (Training Impulse)
- **cat:** carga interna · **unit:** UA · **sport:** END · **status:** futura · **fase:** III (🔵 HR) · 🟩
- **source_data:** duração, FC média/série temporal, FCrep, FCmáx.
- **formula_v1:** Banister: `TRIMP = Σ(Δt × ΔHRr × 0.64·e^(1.92·ΔHRr))` com `ΔHRr=(HR−HRrep)/(HRmáx−HRrep)`; alternativa por zonas (Edwards). **ref:** Banister 1991; Edwards 1993.
- **interpretation:** carga interna ponderada por FC.
- **decision_rules:** complementa sRPE quando há HR real.
- **limitations:** exige HR contínua; sensível a HRmáx/HRrep corretos.
- **explainable:** sim · **prescriptive:** sim · **confidence:** média (depende de HRmáx real).

### `power_load` — Carga por potência
- **cat:** carga interna · **unit:** UA · **sport:** END (ciclismo) · **status:** futura · **fase:** III (🔵) · 🟨
- **source_data:** potência (série temporal), potência de limiar (própria).
- **formula_v1 (ENKY, aberta):** `power_load = (intensidade_rel² ) × duração_h × 100`, com intensidade relativa ao limiar próprio (evita NP/TSS proprietários).
- **interpretation:** carga mecânica interna de sessões com medidor.
- **decision_rules:** só quando houver potência confiável.
- **limitations:** exige limiar calibrado; não usar algoritmo proprietário.
- **explainable:** sim · **prescriptive:** sim · **confidence:** média.

### `hr_load` / `pace_load` — Carga por FC / por ritmo
- **cat:** carga interna · **unit:** UA · **sport:** END · **status:** futura · **fase:** III (🔵) · 🟨
- **source_data:** FC ou pace (série temporal) + limiar correspondente.
- **formula_v1:** análoga a `power_load`, com intensidade relativa ao limiar de FC (%LTHR) ou de pace (%vLT).
- **interpretation:** carga interna quando não há potência.
- **decision_rules:** hierarquia de fonte: potência > FC > pace > sRPE.
- **limitations:** FC sofre deriva/estresse/calor; pace sofre com terreno.
- **explainable:** sim · **prescriptive:** sim · **confidence:** média.

### `intensity` — Intensidade da sessão
- **cat:** intensidade · **unit:** % · **sport:** ALL · **status:** experimental · **fase:** II · 🟨
- **formula_v1 (§9):** `Intensidade(%) = 100 × √(Carga / (100 × duração_h))` — **só** quando o modelo de carga usa intensidade ao quadrado. **ref:** relação identificada nos dados.
- **interpretation:** o quão dura foi a sessão relativa à capacidade.
- **decision_rules:** entra na distribuição de intensidade / equilíbrio semanal.
- **limitations:** derivada; depende do modelo de carga adotado.
- **explainable:** sim · **prescriptive:** não (informativa) · **confidence:** média.

### `duration` · `distance` · `total_work` — Duração · Distância · Trabalho total
- **cat:** carga externa/volume · **unit:** min · km · kJ · **sport:** ALL/END · **status:** núcleo-MVP · **fase:** I/II · 🟩
- **source_data:** sessão (plano/execução); trabalho = ∫potência·dt (kJ) quando há potência.
- **interpretation:** volume bruto; base de tendências de volume.
- **decision_rules:** progressão de volume; planejado × realizado.
- **explainable:** sim · **prescriptive:** sim · **confidence:** alta.

---

## B. Estado de treinamento (§7.2)

### `ctl` — Carga crônica (Chronic Training Load / "fitness")
- **cat:** estado longitudinal · **unit:** UA · **sport:** ALL · **status:** núcleo-MVP · **fase:** II · 🟩
- **source_data:** carga diária (sRPE ou power/hr load), ≥28–42 d de histórico.
- **formula_v1:** EWMA 42 d: `CTL_t = CTL_{t−1} + (load_t − CTL_{t−1})·(1 − e^{−1/42})`. **ref:** Banister/Coggan (impulse-response).
- **interpretation:** condicionamento acumulado.
- **decision_rules:** entra em ACWR e TSB; sozinho não decide.
- **limitations:** exige histórico; distorce com dados faltantes.
- **explainable:** sim · **prescriptive:** sim (via ACWR/TSB) · **confidence:** escala com histórico.

### `atl` — Carga aguda (Acute Training Load / "fadiga")
- **cat:** estado longitudinal · **unit:** UA · **status:** núcleo-MVP · **fase:** II · 🟩
- **formula_v1:** EWMA 7 d: `ATL_t = ATL_{t−1} + (load_t − ATL_{t−1})·(1 − e^{−1/7})`.
- **interpretation:** fadiga recente.
- **decision_rules:** compõe TSB e ACWR.

### `tsb_form` — Forma (Training Stress Balance)
- **cat:** estado longitudinal · **unit:** UA · **status:** núcleo-MVP · **fase:** II · 🟨
- **formula_v1:** `TSB = CTL_{t−1} − ATL_{t−1}` (frescor). **ref:** modelo impulso-resposta.
- **interpretation:** negativo = fadiga; positivo = frescor (possível pico).
- **decision_rules:** TSB muito negativo + prontidão baixa → reduzir; positivo estável pré-prova → ok.
- **limitations:** proxy; não substitui prontidão real.

### `acwr` — Razão carga aguda:crônica
- **cat:** estado · **unit:** razão · **status:** experimental · **fase:** II · 🟨
- **formula_v1:** `ACWR = ATL / CTL` (ou aguda 7d / crônica 28d). **ref:** Gabbett 2016 (com ressalvas metodológicas).
- **interpretation:** 0.8–1.3 ok · >1.5 risco · <0.8 subcarga.
- **decision_rules:** >1.5 **com** ≥1 outro sinal → sugerir reduzir. Isolado → só informa.
- **limitations:** correlação, não causalidade; sensível a método/dados faltantes.

### `ramp_rate` — Taxa de rampa
- **cat:** estado · **unit:** UA/sem · **status:** núcleo-MVP · **fase:** II · 🟨
- **formula_v1:** Δ CTL (ou carga semanal) semana-a-semana. **interpretation:** > +30%/sem = progressão agressiva.
- **decision_rules:** rampa alta + fadiga → reduzir.

### `monotony` / `strain` — Monotonia · Strain (Foster)
- **cat:** estado · **unit:** razão · UA · **status:** experimental · **fase:** II · 🟨
- **formula_v1:** `monotony = média_diária / DP_diário` (7 d); `strain = carga_semanal × monotony`. **ref:** Foster 1998.
- **interpretation:** monotonia >2.0 + strain alto = risco.
- **decision_rules:** variar estímulo; inserir recuperação.
- **limitations:** exige variação real registrada.

### `cil` — Carga de intensidade crônica
- **cat:** estado · **unit:** UA · **status:** experimental · **fase:** II · 🟧
- **formula_v1 (§8):** EWMA 42 d da **intensidade** (sem ponderar por duração).
- **interpretation:** tendência de intensidade sustentada.
- **decision_rules:** apoia leitura de polarização.

---

## C. Resposta fisiológica (§7.3)

### `rpe` — Percepção de esforço (CR-10)
- **cat:** resposta · **unit:** 0–10 · **sport:** ALL · **status:** núcleo-MVP · **fase:** I · 🟩
- **interpretation:** esforço percebido; base do sRPE. **decision_rules:** RPE≥9 → revisar fadiga.

### `hr_avg` / `hr_max` / `rhr` — FC média / máxima / repouso
- **cat:** resposta · **unit:** bpm · **sport:** END · **status:** futura · **fase:** III (🔵) · 🟩
- **interpretation:** resposta cardíaca; RHR↑ sustentada = possível fadiga/estresse.
- **decision_rules:** RHR desviando da linha de base → sinal de recuperação.

### `hrv` — Variabilidade da frequência cardíaca
- **cat:** recuperação · **unit:** ms (rMSSD) · **sport:** ALL · **status:** experimental · **fase:** III/IV (🔵/🟡) · 🟨
- **formula_v1:** `hrv_trend = (média 7d − baseline 30–60d)`; usar CV e média móvel (Ln rMSSD). **ref:** Plews et al. 2013.
- **interpretation:** queda sustentada vs baseline pode indicar fadiga/estresse.
- **decision_rules:** HRV↓ + sono↓ + RPE↑ (convergência) → sugerir reduzir. **Nunca** isolado.
- **limitations:** ruído alto; exige coleta padronizada (manhã, repouso).

### `decoupling` — Desacoplamento (Pw:HR / Pa:HR)
- **cat:** resposta · **unit:** % · **sport:** END · **status:** experimental · **fase:** III (🔵) · 🟨
- **formula_v1:** deriva % entre 1ª e 2ª metades de (potência ou pace)/FC. **ref:** Friel.
- **interpretation:** >5% = perda de eficiência aeróbia / fadiga na sessão.
- **decision_rules:** decoupling alto recorrente + RPE↑ → investigar fadiga.

### `efficiency_factor` — Fator de eficiência (EF)
- **cat:** performance · **unit:** —/bpm · **sport:** END · **status:** experimental · **fase:** III (🔵) · 🟨
- **formula_v1:** `EF = (potência_normalizada ou velocidade_norm) / FC_média`. **ref:** Coggan (conceito aberto de EF).
- **interpretation:** EF subindo ao longo do tempo = melhora aeróbia.
- **decision_rules:** tendência de EF apoia progressão.

---

## D. Performance (§7.4)

### `critical_power` / `w_prime` — Potência crítica · W′
- **cat:** performance · **unit:** W · kJ · **sport:** END (ciclismo) · **status:** experimental (algoritmo próprio) · **fase:** III · 🟨
- **source_data:** melhores esforços em ≥2–3 durações (3–12 min típicas).
- **formula_v1:** modelo 2 parâmetros `P = W′/t + CP`. **ref:** Monod & Scherrer 1965; Jones et al. 2010.
- **interpretation:** CP = potência sustentável aeróbia; W′ = capacidade anaeróbia finita.
- **decision_rules:** referência para zonas e prescrição (prescriptive).
- **limitations:** exige testes válidos; **algoritmo próprio versionado** (não copiar de terceiros).

### `critical_velocity` — Velocidade crítica (corrida) — alternativa aberta ao VDOT™
- **cat:** performance · **unit:** m/s · **sport:** END (corrida/natação: CSS) · **status:** experimental · **fase:** III · 🟨
- **formula_v1:** modelo 2 parâmetros a partir de tempos de prova (ex.: `d = CV·t + D′`). **ref:** Monod-Scherrer aplicado à corrida.
- **interpretation:** ritmo limiar aberto; substitui VDOT proprietário.
- **decision_rules:** define zonas de pace e prescrição.

### `ftp_eftp` — FTP / FTP estimado
- **cat:** performance · **unit:** W · **sport:** END (ciclismo) · **status:** experimental (usar equivalente aberto) · **fase:** III · 🟧
- **nota:** FTP/eFTP são conceitos proprietários; **ENKY usa CP** como referência aberta e trata FTP como estimativa derivada (`≈ CP` ou % do melhor esforço), versionada e rotulada como estimativa.
- **decision_rules:** só como referência de zona; nunca apresentar como verdade absoluta.

### `pmax` · `normalized_power` · `variability_index` · `threshold_pace`
- **cat:** performance · **status:** `pmax` futura · **NP/VI** experimental (marca própria) · **fase:** III · 🟨
- **NP (potência normalizada):** conceito TrainingPeaks™ → ENKY implementa **média ponderada de 4ª potência** própria e a rotula como "potência ponderada ENKY"; **VI = pot_ponderada / pot_média**. **threshold_pace:** ritmo de limiar por teste/CV.
- **decision_rules:** informativas; VI alto = pedalada/esforço irregular.

---

## E. Recuperação e contexto (§7.5)

### `sleep` — Sono
- **cat:** recuperação · **unit:** h / escore · **sport:** ALL · **status:** futura · **fase:** II (🟡 questionário) / III (🔵) · 🟨
- **source_data:** questionário (horas/qualidade) ou wearable.
- **interpretation:** sono baixo sustentado reduz capacidade de absorver carga.
- **decision_rules:** compõe prontidão; sono↓ + carga↑ → cautela.

### `soreness` / `motivation` — Dor muscular tardia / Motivação
- **cat:** recuperação/comportamento · **unit:** 0–10 · **sport:** ALL · **status:** futura · **fase:** II (🟡) · 🟨
- **interpretation:** entradas do índice de prontidão; motivação baixa recorrente = sinal comportamental.

### `readiness` — Prontidão (composto)
- **cat:** indicador composto · **unit:** escore/classe · **sport:** ALL · **status:** experimental · **fase:** II · 🟧
- **formula_v1:** função ponderada de sono, HRV, fadiga, dor, estresse, carga recente → boa/atenção/baixa/insuficiente.
- **interpretation:** hipótese de "pronto para treinar hoje". **Não diagnóstico.**
- **decision_rules:** ajustar sessão do dia; sempre com confiança explícita.
- **limitations:** composto — exibir confiança e dados usados; experimental até validação.

### `injury` — Lesão/restrição
- **cat:** contexto/segurança · **status:** futura · **fase:** II · **decision_rules:** **veta aumentos**; cautela; nunca diagnostica.

### `compliance` — Aderência (planejado × realizado)
- **cat:** aderência · **unit:** % · **sport:** ALL · **status:** núcleo-MVP · **fase:** I · 🟩
- **formula_v1 (§8):** `compliance = realizado / planejado`, por **carga** (preferencial) → duração → distância.
- **interpretation:** o plano está sendo seguido? **decision_rules:** baixa → reforço/ajuste. (Já em uso no motor de atenção/feedback.)

---

## Arquitetura do Registry (§12)

- **Catálogo versionado** (este documento → futura config em código `modules/metrics/registry`): fonte da verdade de fórmulas, unidades, escopo, limitações, regras. Não é dado operacional.
- **Resultados calculados** → tabela `DerivedMetric` (já existe: `metricKey`, `metricValue`, `periodStart/End`, **`formulaVersion`**, `status`). Falta apenas acrescentar, quando entrar em código, `sourceDataVersion` e `confidenceScore` (migração leve — **02H+**).
- **Governança (§10):** nada em produção sem documentação; fórmulas versionadas; mudança de fórmula = migração registrada (nunca reescreve histórico); toda recomendação com justificativa; compostos com confiança; alertas nunca são diagnóstico; treinador tem autoridade final; dado ausente/ruim reduz confiança; registrar origem/data/qualidade do dado.

## Prioridade de implementação (§13) × fases ENKY

| Fase Registry | Conteúdo | Fase ENKY | Migração |
|---|---|---|---|
| 1 — Fundação | criar o registro, classificar campos, remover admin, definir núcleo, documentar fórmulas | **agora (este doc)** | não |
| 2 — Cálculos | power/hr/pace/sRPE load, CTL/ATL/TSB, intensidade, tempo em zonas, aderência | Intelligence Fase II | leve (`DerivedMetric` + campos) |
| 3 — Performance | CP/W′, curvas, EF, desacoplamento, CV | Intelligence Fase III | sim (`MetricSample` + wearables) |
| 4 — Recuperação/decisão | HRV, sono, prontidão, tendência de fadiga, alertas explicáveis | Intelligence Fase III/IV | sim |

## Critérios de aceitação (§14) — por métrica

Pronta para produção quando: definição inequívoca · fórmula testada · unidades normalizadas · escopo
esportivo definido · limitações documentadas · referência científica/justificativa · casos extremos
testados · saída explicável · confiança estimável · revisão por especialista.

## Classificação (resumo, §6/§15)

- **núcleo-MVP (computável já / em uso):** `srpe_load`, `compliance`, `duration`, `distance`, `total_work`, `rpe`, `ctl`, `atl`, `tsb_form`, `ramp_rate`.
- **experimental (regras/validar):** `acwr`, `monotony`, `strain`, `cil`, `intensity`, `readiness`, `hrv`, `decoupling`, `efficiency_factor`, `critical_power`, `w_prime`, `critical_velocity`.
- **futura (precisa dado/integração):** `trimp`, `power_load`, `hr_load`, `pace_load`, `hr_avg/max`, `rhr`, `sleep`, `soreness`, `motivation`, `injury`, `pmax`, `threshold_pace`.
- **usar equivalente aberto (jurídico):** `ftp_eftp`, `normalized_power`, `variability_index` (→ CP/CV, potência ponderada ENKY).
- **administrativa/rejeitada (fora do núcleo científico):** permissões, chat, sync, aparência, calendário, URLs, IDs, objetos internos.

## Conclusão

O diferencial da ENKY é **selecionar, validar, combinar e explicar** — não acumular campos. Este
Registry é componente **central** da arquitetura: toda métrica que virar cálculo passa por ele,
versionada e explicável, e só chega ao treinador como **interpretação + decisão**, nunca como número solto.
