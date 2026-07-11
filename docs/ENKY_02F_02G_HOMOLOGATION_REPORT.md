# ENKY_02F_02G_HOMOLOGATION_REPORT.md

**Checkpoints:** 02F (experiência do atleta) + 02G (ENKY Intelligence — Fase I/II inicial).
**Branch:** `feat/fase-02d-calendar-library` (sem merge, sem Production, **sem migration**).
**Objetivo:** validar o primeiro circuito operacional — sRPE coletado → estado de carga → regra de atenção → insight → recomendação ao treinador — quanto a **cálculo, prioridade, confiança, linguagem, UX e comportamento com dados insuficientes**.

---

## 1. Ambiente e escopo testado

- **Validação estática:** `tsc --noEmit` ✅ · `eslint .` ✅ · `next build` ✅ (compila).
- **Suíte unitária:** **143/143** ✅, incluindo **32 testes de intelligence** (motores puros) e **10 cenários de homologação controlada**.
- **Evidência dos cenários:** `tests/unit/modules/intelligence/homologation.test.ts` (exercita `evaluate`, `computeLoadState`, `interpretFeedback` com entradas construídas).
- **Fora de escopo (não implementado, por decisão):** migrations, tabela `Insight`, questionário de prontidão, integrações wearable.

> Observação honesta sobre método: os motores são **funções puras**, então a homologação de **cálculo/prioridade/confiança/linguagem** foi feita de forma determinística e reproduzível em teste. A homologação **visual/percepção de utilidade** (o treinador entende e age?) é a etapa humana no Preview — recomendada antes do go definitivo (ver §7).

---

## 2. Cenários executados (obrigatórios)

| # | Cenário | Resultado esperado | Resultado observado | Status |
|---|---------|--------------------|---------------------|--------|
| 1 | Sem histórico mínimo de carga (5 dias) | Não gerar alerta de carga | `evaluate` → `null` (gate `dataDays ≥ 10`) | ✅ |
| 2 | Carga estável (série longa) | Estado normal, sem recomendação alarmista | ACWR≈1.0 → nenhum insight | ✅ |
| 3 | ACWR ≥ 1,5 (calculado da série) | Marcar para revisão | `revisar` · regra `carga:acwr-alto` · bem-formado · linguagem de **contexto** | ✅ |
| 4 | Rampa semanal ≥ 30% | Marcar para revisão | `revisar` · regra `carga:ramp-alto` | ✅ |
| 5 | Dor + carga elevada | Dor primeiro | `urgente` · `seguranca:dor-relatada` (sobrepõe carga) | ✅ |
| 6 | ACWR alto, amostra pequena (5 dias) | Confiança reduzida / sem alerta | `null` (gate de histórico) | ✅ |
| 7 | Treino perdido + carga elevada | Prioridade documentada | `revisar` · `carga:acwr-alto` (carga antes de adesão, conforme ordem documentada) | ✅ |
| 8 | Dados incompletos (1 feedback) | Explicitar limitação, não inventar | `confianca=BAIXA` + `limitacoes` preenchida + observação factual | ✅ |
| 9 | Múltiplos atletas com motivos diferentes | Priorização correta | ordenação `urgente > revisar > atenção` | ✅ |
| 10 | Feedback interpretado + estado de carga juntos | Coexistir sem conflito | detalhe do treino (`revisar` sessão) + dashboard (`revisar` carga), superfícies distintas, ambos bem-formados | ✅ |

---

## 3. Avaliação da mensagem (qualidade e linguagem)

Gate automatizado (`assertWellFormed`) aplicado a todos os insights dos cenários:

- **O que aconteceu?** `observacao` factual e não vazia ✅
- **Por que importa?** `interpretacao` presente ✅
- **Quais dados sustentam?** `dadosUsados ≥ 1` (ACWR, ramp, dor, RPE, retornos…) ✅
- **Qual ação considerar?** `acoesSugeridas ≥ 1`, no modo "considere/revise/avalie" ✅
- **Confiança** ∈ {BAIXA, MEDIA, ALTA}, escala com volume de dados ✅
- **Limitações** sempre presentes ✅
- **Não alarmista:** ausência de "certamente / com certeza / garantido / vai lesionar / está lesionado" ✅
- **Observação × recomendação:** separadas em campos distintos (observação vs ação) ✅

---

## 4. Bugs encontrados e severidade

| Bug | Severidade | Onde |
|-----|-----------|------|
| **B1** — Insight de carga sugeria risco ("pode elevar o risco de má adaptação e fadiga"), lendo-se como previsão de lesão a partir de uma métrica isolada — cientificamente frágil e juridicamente ruim. | **Média** | `attention.ts` (regra de carga) |

Nenhum outro insight apresentou linguagem alarmista (verificado pelo gate em todos os cenários). Nenhuma duplicação de insight (o motor de atenção devolve **um** insight por atleta; o detalhe do treino devolve **um** por sessão).

---

## 5. Correções realizadas

- **B1 corrigido:** a regra de carga foi reescrita para tratar ACWR/ramp/monotonia/strain como **sinais de contexto**, nunca diagnóstico/previsão:
  - **Antes:** "Um salto agudo de carga … pode elevar o **risco de má adaptação e fadiga**."
  - **Depois:** "Sinal de contexto: a carga recente saltou em relação ao padrão deste atleta. **Não é, isoladamente, previsão de lesão** — vale revisar antes de manter a progressão planejada."
  - **Ação:** "Revise o contexto (sono, recuperação, agenda) antes de manter a progressão planejada."
  - **Limitações:** "ACWR, ramp, monotonia e strain são sinais de contexto, **não diagnóstico nem previsão isolada de lesão**. Sem HRV/sono para confirmar fadiga."
- Teste de homologação #3 fixa esse comportamento (assere "contexto", "não é", "não diagnóstico").

Somente problemas de 02F/02G foram tocados. Nenhuma migration, tabela `Insight`, questionário ou wearable.

---

## 6. UX, estados e não-regressão

- **Estados vazios/loading/erro:** dashboard e detalhe tratam "Carregando…", erro (`uiClasses.error`) e vazio; a seção "Precisam de atenção" só aparece quando há insights (`insights.length > 0`); a análise falha **em silêncio** sem quebrar a página.
- **Explicabilidade na UI:** `InsightCard` mostra selo "ENKY Intelligence", risco (cor), confiança e "ver por quê" (interpretação + dados usados + regras + limitações).
- **Segurança/tenant:** rotas de intelligence exigem `TRAINER` + `resolveActiveOrganization` + `trainerProfile`, e as consultas são escopadas por `organizationId + trainerId` (mesmo padrão do restante).
- **Não-regressão:** 143 testes unitários verdes + build ok; autenticação, tenant isolation e o fluxo treinador→atleta→feedback→revisão preservados.

---

## 7. Riscos residuais

1. **Warm-up da CTL:** a média móvel de 42 dias só estabiliza após ~4× a constante; atletas com pouco histórico têm CTL "amortecida" e ACWR mais ruidoso. **Mitigação:** gate `dataDays ≥ 10` + confiança explícita. Recomenda-se comunicar "poucos dados" mais cedo na Fase II.
2. **Carga de fonte única (sRPE):** ainda sem TRIMP/potência; leitura de carga é boa, mas não corroborada por HR/potência (Fase III).
3. **Sem persistência/aprendizado:** insights não são gravados (aceito/ignorado) — é justamente o que a tabela `Insight` (02H) trará; hoje não há loop de calibração.
4. **Custo on-the-fly:** varredura de 90 dias por carregamento do dashboard — aceitável na escala MVP; migrar para cron/persistência na Fase II.
5. **Fuso horário:** `plannedDate` é `@db.Date` (UTC midnight); o mapeamento diário usa a data ISO — consistente, mas a janela é em dias corridos, não no fuso do treinador.

---

## 8. Decisão final

**APROVADO no nível de motor, cálculo, prioridade, confiança, linguagem e UX-código** — todos os cenários obrigatórios passam e a falha de linguagem (B1) foi corrigida.

**Recomendação antes de iniciar o 02H:** uma passada de **homologação visual no Preview** pelo treinador/product (renderização dos InsightCards, clareza da priorização, percepção de utilidade real) — é a única dimensão que um teste determinístico não cobre. Feita essa validação humana, **liberado para o 02H** (questionário de prontidão + tabela `Insight` com o ciclo completo detecção→recomendação→exposição→ação→resultado + motor de recuperação/fadiga).

**Status para o 02H:** ✅ desbloqueado após o checkpoint visual no Preview.
