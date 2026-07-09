# ENKY 18 - MÉTRICAS, INDICADORES E DASHBOARDS
**Versão 1.0** — Métricas, indicadores, painéis e inteligência analítica

---

## Regra de Ouro

> **Calcular muito, interpretar bem, mostrar apenas o que ajuda a decidir.**

---

## 5 Camadas

1. **Dados brutos** — coletados de atleta, treino, feedback, avaliação
2. **Métricas derivadas** — cálculos a partir dos brutos
3. **Indicadores compostos** — leituras combinadas (prontidão, fadiga, risco)
4. **Insights** — interpretações da ENKY Intelligence
5. **Exibição seletiva** — o que aparece por perfil e contexto

---

## 26 Grupos de Métricas

Cadastrais, antropométricas, disponibilidade, prescrição, execução, aderência, carga externa, carga interna, intensidade, volume, densidade, recuperação, prontidão, fadiga, dor/desconforto, performance, evolução, por modalidade (6), risco contextual, consistência, comportamento, comunicação, comerciais, admin, qualidade de dados, da Intelligence

---

## Indicadores Compostos Principais

| Indicador | Entradas | Saída |
|-----------|---------|-------|
| **Prioridade de atenção** | Treino perdido, dor, aderência, carga, recuperação, prova | baixa/atenção/revisar/urgente |
| **Prontidão** | Sono, fadiga, dor, estresse, motivação, carga | boa/atenção/baixa/dados insuficientes |
| **Fadiga contextual** | RPE↑, performance↓, sono↓, carga↑, sequência intensa | hipótese, não diagnóstico |
| **Equilíbrio semanal** | Treinos, intensos, recuperação, volume, modalidade | equilibrada/carregada/baixa/concentrada |
| **Qualidade de dados** | Perfil, feedback, treinos, avaliações, zonas | alta/média/baixa/insuficiente |
| **Maturidade no sistema** | Tempo, treinos, feedbacks, avaliações | inicial/construção/bom/robusto |

---

## Dashboards

### Treinador
Atletas que precisam de atenção + treinos hoje + feedbacks pendentes + aderência + carga semanal + alertas + Intelligence

### Atleta
Treino de hoje + status semanal + feedback pendente + evolução simples + mensagem do treinador

### Admin
Usuários + treinadores + atletas + receita + MRR + vendas + churn + logs + erros

---

## Alertas

Poucos, úteis, explicáveis. Cada alerta: motivo + nível (informativo/atenção/importante/crítico) + ação sugerida + dados usados + opção ignorar

---

## MVP de Métricas

Atletas ativos, treinos hoje, sem treino, feedbacks pendentes, aderência básica, planejado vs realizado, volume semanal, session-RPE simples, status, dor, alertas simples, dashboards 3 perfis, marketplace básico
