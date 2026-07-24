# SESSION_GENERATION_ENGINE — Motor de sugestão (ENKY Intelligence 2.0 · Fase 3)

> **Status:** implementado (`modules/session-generator`, puro e testado — 6
> testes) + rota de preview + tie-in na UI do motor estratégico. **Não persiste**
> — é a etapa em que o treinador vê o porquê antes de gerar/publicar.

## 1. O que a Fase 3 fecha

O gerador de semana (`generation-rules.planWeek`, Fase 1/6) diz **quais** sessões
e **como** (blocos, RPE, datas). A biblioteca científica (`training-library`,
Fase 2) diz **para quê** e **com que evidência**. A Fase 3 os combina: casa cada
sessão gerada com a entrada de catálogo mais específica e devolve a **sugestão
auto-explicável** que a espec pede —

> por que · objetivo · sistema energético · adaptação · carga prevista · risco ·
> confiança · referências.

```
WeekContext ─► planWeek() ─► WeekPlan ─┐
                                       ├─► enrichWeekPlan() ─► WeekSuggestion
training-library (recommendSessions) ──┘        (por sessão: objetivo, sistema,
                                                 adaptação, risco, evidência…)
```

## 2. Enriquecimento (`enrich-week.ts`, puro)

`enrichSession(session, context)` casa a sessão com o catálogo **relaxando o
critério em degraus** e é honesto sobre o quanto casou:

1. modalidade + fase + nível + tipo → `matched: true`
2. modalidade + fase + tipo → `matched: true`
3. modalidade + tipo (qualquer fase) → `matched: false` (análogo de outra fase)
4. RECOVERY/LONG sem entrada própria → análogo aeróbico leve (EASY) da modalidade
   → `matched: false`
5. nada → sugestão sem catálogo (só a regra da fase), `matched: false`

`matched: false` **nunca é silencioso** — o campo `why` diz "análogo de outra
fase, revise a intensidade". A `adaptation` é derivada do `energySystem`; a
`predictedLoad` (descritiva) = `estimatedLoadPerHour × duração média`.

`enrichWeekPlan(plan, context)` aplica a todas as sessões e **preserva**
`confidence` e `rationale` do gerador (não os reinventa).

## 3. Rota (preview, não grava)

`POST /api/trainer/athletes/[athleteId]/session-suggestions`
— corpo = contexto de uma semana (`suggestion-schema.ts`); exige acesso
treinador↔atleta; devolve `{ catalogVersion, sessions[], confidence, rationale }`.
Não escreve nada: a persistência segue no fluxo de geração assistida existente
(`generate-week.ts`), que nasce DRAFT.

## 4. UI

No modal **"✨ Gerar com ENKY"**, depois da prévia do macrociclo, o botão **"Ver
sessões da semana de maior carga"** chama a rota para a semana de pico da fase de
construção e lista as sessões-exemplo com objetivo, sistema energético,
adaptação, risco, carga prevista e nível de evidência — Fase 1 (estrutura) + 2
(biblioteca) + 3 (sugestão) numa tela só. Nada é criado ali; as sessões só viram
rascunho quando o treinador gerar o ciclo depois de salvar.

## 5. Postura

- **Preview, não publicação.** A sugestão é para o treinador ver e decidir.
- **Honesto sobre o casamento.** `matched: false` é declarado, não escondido.
- **Reuso, não duplicação.** Não altera o gerador nem a biblioteca — só os
  combina; ambos seguem puros e testados.
