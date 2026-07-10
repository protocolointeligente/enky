# ENKY PERFORMANCE METRICS REGISTRY v1.0
**Status: Documento-base de arquitetura científica e técnica**  
**Projeto: ENKY Human Performance Platform**  
**Versão: 1.0**  
**Data: 10 de julho de 2026**

---

## 1. FINALIDADE

Este registro organiza as métricas identificadas nos arquivos extraídos do Intervals.icu e define como elas podem ser avaliadas, documentadas e futuramente implementadas na ENKY. O objetivo não é copiar indiscriminadamente campos de uma plataforma externa, mas construir uma camada própria, explicável, auditável e cientificamente fundamentada para análise de desempenho humano.

---

## 2. PRINCÍPIO CENTRAL

A existência de muitos campos e métricas não equivale, por si só, a uma base científica superior. Cada métrica só deve ser adotada quando possuir definição operacional, dados de entrada conhecidos, fórmula ou algoritmo documentado, unidade, escopo esportivo, limitações, nível de evidência, interpretação prática e regra de uso.

---

## 3. ESCOPO DOS DADOS IDENTIFICADOS

Os arquivos analisados incluem métricas e campos relacionados a:
- carga de treinamento;
- intensidade;
- potência;
- frequência cardíaca;
- ritmo e velocidade;
- zonas de treinamento;
- fitness, fadiga e forma;
- recuperação e prontidão;
- sono e wellness;
- adesão ao planejamento;
- clima e ambiente;
- planejamento de treinos;
- dados administrativos, internos e de interface.

---

## 4. CAMADAS DO SISTEMA DE MÉTRICAS ENKY

### 4.1 Dados brutos
Potência, frequência cardíaca, velocidade, ritmo, cadência, distância, duração, elevação, temperatura, sono, HRV, RPE, dor muscular, motivação, peso corporal e composição corporal.

### 4.2 Métricas derivadas
Carga por potência, carga por frequência cardíaca, carga por ritmo, TRIMP, sessão-RPE, intensidade, eficiência, desacoplamento, variabilidade, tempo em zonas, potência crítica, $W'$, eFTP, trabalho total e aderência ao treino planejado.

### 4.3 Estado longitudinal
Fitness, fadiga, forma (TSB), monotonia, strain, ramp rate, tendência de carga, CIL, prontidão, recuperação e disponibilidade para treinar.

### 4.4 Interpretação científica
A ENKY deve combinar métricas, contexto e tendência temporal. Nenhuma métrica isolada deve ser tratada como diagnóstico ou decisão definitiva. 

*Exemplo:* aumento de CTL acompanhado de queda sustentada de HRV, piora do sono e aumento de RPE deve gerar alerta de possível fadiga acumulada, não uma conclusão automática de evolução positiva.

### 4.5 Recomendação prática
As recomendações podem incluir manter sessão, reduzir volume, reduzir intensidade, substituir treino, inserir recuperação, reavaliar zonas, revisar FTP, investigar fadiga não funcional ou solicitar decisão humana.

---

## 5. REGISTRO PADRÃO DE CADA MÉTRICA

Cada métrica deverá possuir os seguintes campos:
- **`metric_key`**: identificador interno único;
- **`name_pt`**: nome em português;
- **`name_en`**: nome original ou internacional;
- **`category`**: categoria funcional;
- **`source_data`**: dados necessários;
- **`formula_version`**: versão da fórmula;
- **`formula_reference`**: fórmula, artigo ou método;
- **`unit`**: unidade;
- **`sport_scope`**: modalidades válidas;
- **`validity_level`**: nível de evidência;
- **`limitations`**: limitações e contraindicações de uso;
- **`interpretation`**: significado fisiológico ou operacional;
- **`decision_rules`**: regras de decisão;
- **`reference_ids`**: referências científicas;
- **`is_explainable`**: possibilidade de explicação ao usuário;
- **`is_prescriptive`**: possibilidade de influenciar prescrição;
- **`confidence_score`**: confiança do cálculo;
- **`status`**: proposta, validada, experimental, obsoleta ou rejeitada.

---

## 6. CLASSIFICAÇÃO DAS MÉTRICAS

### 6.1 Métricas aproveitáveis diretamente
Campos com significado claro, fórmula conhecida e aplicação consolidada, desde que implementados com documentação própria.

### 6.2 Métricas replicáveis por fórmula
Métricas que podem ser calculadas internamente a partir de dados brutos, sem dependência de serviços externos.

### 6.3 Métricas dependentes de algoritmos próprios
Estimativas como eFTP, potência crítica, $W'$, readiness composto e modelos personalizados de carga exigem modelagem, validação e versionamento próprios.

### 6.4 Métricas administrativas ou de interface
Campos de permissões, chat, sincronização, aparência, calendário, URLs, identificadores e objetos internos não devem compor o núcleo científico.

### 6.5 Métricas que exigem validação científica adicional
Indicadores compostos, classificações de risco, prontidão, strain e inferências preditivas devem ser tratados como experimentais até validação.

### 6.6 Métricas que não devem ser utilizadas
Campos sem definição, redundantes, proprietários sem transparência, irrelevantes ao produto ou que possam induzir decisões clínicas ou esportivas inadequadas.

---

## 7. MÉTRICAS NUCLEARES PARA O MVP

### 7.1 Carga e intensidade
- training load;
- power load;
- HR load;
- pace load;
- session-RPE;
- TRIMP;
- intensidade;
- duração;
- distância;
- trabalho total.

### 7.2 Estado de treinamento
- CTL;
- ATL;
- TSB/Form;
- ramp rate;
- monotonia;
- strain;
- CIL.

### 7.3 Resposta fisiológica
- RPE;
- frequência cardíaca média;
- frequência cardíaca máxima;
- HRV;
- frequência cardíaca de repouso;
- desacoplamento;
- efficiency factor.

### 7.4 Performance
- FTP/eFTP;
- critical power;
- $W'$;
- Pmax;
- VDOT ou velocidade crítica para corrida;
- ritmo limiar;
- potência normalizada;
- variability index.

### 7.5 Recuperação e contexto
- sono;
- soreness;
- motivação;
- readiness;
- lesão;
- compliance.

---

## 8. DEFINIÇÕES INICIAIS

*   **CTL:** média móvel exponencial de 42 dias da carga de treinamento.
*   **ATL:** média móvel exponencial de 7 dias da carga de treinamento.
*   **TSB/Form:** diferença operacional entre fitness e fadiga, conforme modelo adotado.
*   **CIL:** média móvel exponencial de 42 dias da intensidade, sem ponderação principal por duração.
*   **Variability Index:** relação entre potência normalizada e potência média.
*   **Efficiency Factor:** relação entre potência ou velocidade/ritmo normalizado e resposta de frequência cardíaca, conforme modalidade.
*   **Training Load:** estimativa da exigência da atividade em relação à capacidade atual do atleta, calculada por potência, frequência cardíaca, ritmo ou percepção de esforço.
*   **Compliance:** comparação entre o treino planejado e realizado, preferencialmente usando carga e, na ausência dela, duração ou distância.

---

## 9. FÓRMULA INICIAL IDENTIFICADA

A intensidade pode ser derivada da carga e da duração pela relação:
$$\text{Intensidade (\%)} = 100 \times \sqrt{\frac{\text{Carga}}{100 \times \text{duração em horas}}}$$

Essa relação deve ser versionada e aplicada apenas quando o modelo de carga correspondente utilizar intensidade relativa ao quadrado.

---

## 10. REGRAS DE GOVERNANÇA

- Nenhuma métrica entra em produção sem documentação.
- Fórmulas devem possuir versionamento.
- Mudanças de fórmula não podem alterar retrospectivamente resultados sem registro de migração.
- Toda recomendação deve apresentar justificativa legível.
- Métricas compostas devem exibir nível de confiança.
- Alertas não devem ser apresentados como diagnóstico médico.
- O treinador deve manter autoridade final sobre decisões prescritivas.
- Dados ausentes ou de baixa qualidade devem reduzir a confiança do resultado.
- A ENKY deve registrar origem, data e qualidade dos dados.

---

## 11. RISCOS

- excesso de métricas sem utilidade prática;
- falsa precisão;
- dependência conceitual de concorrentes;
- duplicação de campos;
- banco de dados excessivamente complexo;
- conclusões indevidas a partir de uma única métrica;
- risco jurídico por reprodução de algoritmos proprietários;
- uso inadequado de alertas como diagnóstico;
- recomendações sem transparência.

---

## 12. ARQUITETURA RECOMENDADA

Criar um módulo *Metric Registry* separado do banco operacional principal. O registro deve funcionar como catálogo versionado de métricas, fórmulas, referências, unidades, escopo, limitações e regras de interpretação. Os resultados calculados devem ser armazenados com `metric_key`, `formula_version`, `source_data_version`, `timestamp` e `confidence_score`.

---

## 13. PRIORIDADE DE IMPLEMENTAÇÃO

### Fase 1 — Fundação
- criar o registro de métricas;
- classificar os campos extraídos;
- remover itens administrativos e irrelevantes;
- definir o conjunto nuclear do MVP;
- documentar fórmulas e unidades.

### Fase 2 — Cálculos fundamentais
- carga por potência, FC, ritmo e sessão-RPE;
- CTL, ATL e TSB;
- intensidade;
- tempo em zonas;
- aderência planejado versus realizado.

### Fase 3 — Modelos de performance
- FTP/eFTP;
- critical power;
- $W'$;
- Pmax;
- curvas de potência e ritmo;
- eficiência e desacoplamento.

### Fase 4 — Recuperação e decisão
- HRV;
- sono;
- prontidão;
- tendência de fadiga;
- alertas explicáveis;
- recomendações condicionais.

---

## 14. CRITÉRIOS DE ACEITAÇÃO

Uma métrica está pronta para produção quando:
- sua definição é inequívoca;
- a fórmula foi testada;
- as unidades estão normalizadas;
- o escopo esportivo está definido;
- as limitações estão documentadas;
- há referência científica ou justificativa técnica;
- casos extremos foram testados;
- a saída é explicável;
- o nível de confiança pode ser estimado;
- a regra foi revisada por especialista.

---

## 15. PRÓXIMA ENTREGA

Criar a planilha-mestre do ENKY Metric Registry com uma linha por métrica e os campos definidos na Seção 5. A primeira versão deve classificar todas as métricas extraídas em: núcleo MVP, futura, experimental, administrativa, duplicada ou rejeitada.

---

## 16. CONCLUSÃO

Os dados obtidos fornecem um mapa técnico de grande valor para a ENKY. O diferencial competitivo não estará na quantidade de métricas, mas na capacidade de selecionar, validar, combinar e explicar cada uma delas dentro de um sistema multiesporte, científico e orientado à decisão. O ENKY Performance Metrics Registry deve ser tratado como componente central da arquitetura do produto, e não como documentação acessória.
