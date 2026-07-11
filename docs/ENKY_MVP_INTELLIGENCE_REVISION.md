# ENKY_MVP_INTELLIGENCE_REVISION.md — Revisão do MVP e do Roadmap

**Status:** proposta para aprovação (nenhum código implementado).
**Base:** ENKY 23 (roadmap), ENKY 20, [ENKY_INTELLIGENCE_ARCHITECTURE.md](./ENKY_INTELLIGENCE_ARCHITECTURE.md), [ENKY_DECISION_ENGINE.md](./ENKY_DECISION_ENGINE.md).

---

## 1. Nova hipótese do MVP

**Antes:** "O Enky é uma plataforma de gestão esportiva."
**Agora:** "O Enky é uma plataforma de apoio à decisão. O MVP deve provar que a **ENKY Intelligence
melhora a tomada de decisão do treinador**."

Tudo que **não contribui diretamente** para validar essa hipótese **perde prioridade** — sem ser
removido.

---

## 2. O que gera dados (mantém prioridade — é combustível da inteligência)

- **Prescrição** (treino planejado) → sinal "planejado".
- **Execução + feedback** (RPE, dor, duração, prontidão) → sinais "realizado" e "carga interna".
- **Calendário** → distribuição/sequência de carga.
- **Atletas/vínculo** → escopo e contexto.
- **Avaliações/testes** → linha de base de performance.

Sem esses módulos, a inteligência não tem o que interpretar. Eles continuam, mas **a serviço do motor**.

## 3. O que perde prioridade (existe, mas fora do caminho crítico do MVP)

Marketplace, pagamentos, periodização automática avançada, redesign administrativo, relatórios
comerciais, integrações wearable (entram só na Fase III da inteligência), redesenho de admin.

## 4. Foco do MVP Intelligence (Fase I — não-destrutiva, sem migration)

Sobre os dados **já coletados** (feedback + workout), entregar via `InsightCard`:
1. **Atenção** no dashboard do treinador — atletas priorizados por risco (dor, treino perdido, aderência).
2. **Resumo inteligente** no perfil do atleta (positivos / atenção / dados insuficientes).
3. **Interpretação de feedback** (RPE/dor, planejado × realizado).
4. **Confiança + limitações** explícitas em cada recomendação (nunca caixa-preta).
5. **Log** de decisões e **feedback do treinador** sobre utilidade (aceitou/ignorou/editou).

## 5. Métricas de sucesso do MVP (valida a hipótese?)

| Métrica | O que mede |
|---------|------------|
| **% de recomendações úteis** | Treinador marca insight como útil/aceito |
| **% aceitas vs ignoradas vs editadas** | Qualidade e confiança das sugestões |
| **Tempo até decisão** | Insight reduz o esforço de interpretar dados? |
| **Cobertura de atenção** | % de atletas com leitura de atenção atualizada |
| **Retenção/uso do treinador** | Volta para ver os insights? |

Se os treinadores **agem** melhor e **mais rápido** com os insights, a hipótese se sustenta.

## 6. Roadmap revisado (alinha 02x/03x às fases da inteligência)

| Sequência | Entrega | Relação com a inteligência |
|-----------|---------|----------------------------|
| **02E** ✅ | UX do treinador + calendário | Gera "planejado" com qualidade |
| **02F** (em curso) | Experiência do atleta + fechamento do feedback | Gera "realizado/carga interna" com qualidade |
| **02G** | Painel de revisão do treinador + **primeiros InsightCards** (Fase I) | **Estreia da Intelligence no produto** |
| **02H** | Isolamento Preview/Production + hardening | Pré-requisito para migrations da inteligência |
| **03A** | Métricas derivadas (`DerivedMetric`) + prontidão/carga (Fase II) | Motores de recuperação/carga |
| **03B** | Integrações esportivas (adapters + `MetricSample`, Fase III) | Novas fontes de sinal |
| **03C** | Motores avançados + sugestão de prescrição + calibração (Fases IV–V) | Inteligência madura |

O reordenamento **puxa a inteligência para frente** (estreia em 02G, não "Fase 5"), começando pela
versão enxuta que roda sobre dados já existentes — sem esperar wearables nem migrations pesadas.

## 7. O que NÃO muda

Constitution, limites éticos da Intelligence (ENKY 11), isolamento por tenant, auditoria, segurança,
e a regra de que a inteligência é **copiloto**, nunca piloto. A revisão muda **prioridade e ordem**, não
os princípios.
