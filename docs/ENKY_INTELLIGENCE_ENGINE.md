# ENKY_INTELLIGENCE_ENGINE — Motor de Periodização Inteligente

**Branch:** `feat/intelligent-periodization-engine` (a partir de
`feat/athlete-assessments-prescription-zones`). **Sem merge em main. Sem deploy
em Production.**

Este documento é o **índice** da iniciativa ENKY Intelligence 2.0: a filosofia, o
mapa de módulos (Fase 8) e o estado real de cada fase — o que já existe no
código, o que esta fatia entregou e o que segue pendente.

---

## 1. Filosofia (Human Performance Framework)

O treinador não monta mais toda a periodização à mão: informa os parâmetros do
atleta e do objetivo; o ENKY constrói uma **proposta** fundamentada na
literatura. **O treinador decide.** Toda sugestão é:

- **explicável** — cada decisão tem um "porquê" versionado;
- **rastreável** — regra + versão + referência científica em cada saída;
- **versionada** — mudou a fórmula, sobe a versão; um plano antigo continua
  explicável pela regra que o gerou;
- **sem caixa-preta** — nenhuma regra científica vive dentro de componente React.

O sistema **sugere**; **nunca publica automaticamente**. O treinador pode editar,
remover, substituir, aceitar ou regenerar qualquer sugestão.

---

## 2. Mapa de módulos (Fase 8)

Postura de arquitetura: núcleos **puros, versionados e testáveis sem banco**;
persistência e autorização em serviços separados; **zero regra científica em
React**. O que já existe é reaproveitado — não reconstruído.

| Módulo | Papel | Estado |
|---|---|---|
| `modules/periodization-engine` | **Motor estratégico** — macro→meso→micro a partir da prova | ✅ **esta fatia** |
| `modules/periodization` (`generation-rules`) | Gerador de sessão por semana (`planWeek`) | ✅ já existia (Fase 6) — reusado |
| `modules/training-zones` | Zonas individualizadas (FC/pace/potência/CSS/%1RM) | ✅ já existia |
| `modules/assessments` | Avaliações versionadas + perfil consolidado | ✅ já existia |
| `modules/intelligence` (`load-state`) | CTL/ATL/TSB/ACWR, motor de atenção, prontidão | ✅ já existia |
| `modules/scientific-rules` | Catálogo de regras científicas transversal | ⏳ hoje vive em `strategy-rules.ts` + `generation-rules.ts`; extração dedicada é pendente |
| `modules/training-library` | Catálogo de sessões com evidência/referência/contraindicação | ⏳ Fase 2 — pendente |
| `modules/session-generator` | Geração de sessão a partir do catálogo | ⏳ hoje procedural em `generation-rules`; catálogo é pendente |
| `modules/load-simulation` | Simular CTL/ATL/TSB de alterações antes de salvar | ⏳ Fase 6 — pendente (base pronta em `load-state`) |
| `modules/adaptation-engine` | Ajuste por feedback/aderência/lesão | ⏳ Fase 5 — pendente |

> Optamos por **não** criar módulos vazios só para "bater" a lista da Fase 8:
> scaffolding sem conteúdo é dívida, não arquitetura. Os módulos pendentes serão
> criados quando a fatia correspondente os preencher.

---

## 3. Estado por fase

| Fase | Escopo | Estado |
|---|---|---|
| **1 — Motor estratégico** | macrociclo/meso/micro, fases, taper, deload, onda de carga a partir da prova + estado do atleta | ✅ **entregue** (`modules/periodization-engine`, 18 testes) |
| **2 — Biblioteca científica** | catálogo de sessões por modalidade com evidência, contraindicação, pré-requisito | ⏳ pendente |
| **3 — Motor de sugestão** | gerar plano/meso/micro/semana/dia com "por quê", sistema energético, risco, confiança | 🟡 **pipeline + persistência prontos** — `toWeekContexts` + `planWeek` geram sessões DRAFT; o motor estratégico já **grava periodização-rascunho** (fases + semanas + rationale) via `saveMacrocyclePlan` e tem **UI com preview/porquê antes de salvar**; granularidade "só um dia" pendente |
| **4 — Editor inteligente** | recálculo de volume/carga/CTL/ATL/TSB ao editar | ⏳ pendente (núcleos de cálculo já existem) |
| **5 — Regeneração** | regenerar preservando aceitos/anotações/ajustes | ⏳ pendente |
| **6 — Simulação** | prever CTL/ATL/TSB/volume antes de salvar | ⏳ pendente (`load-state` é a base) |
| **7 — Explicabilidade** | "por quê", "e se", evidências, confiança, versão da regra | ✅ **transversal** — `rationale.rules/references/missingData/caveats` + `confidence` em toda saída dos motores |
| **8 — Arquitetura** | módulos desacoplados, sem ciência em React | ✅ respeitada; módulos pendentes catalogados acima |
| **9 — Performance** | processamento pesado em background/fila/cache | ⏳ pendente — motor é puro e barato hoje (ms); só migra p/ job quando o custo justificar |
| **10 — Testes** | modalidades, níveis, janelas, alterações, lesões | 🟡 cobertura da Fase 1 entregue (18 testes: RUNNING/STRENGTH/TRIATHLON, níveis, janelas curtas/longas, dados ausentes, erros, pipeline) |
| **11 — Documentação** | docs dos motores | 🟡 `PERIODIZATION_ENGINE.md` + este índice; `SESSION_GENERATION_ENGINE.md`, `SCIENTIFIC_RULES.md`, `ADAPTATION_ENGINE.md` pendentes |

Legenda: ✅ entregue · 🟡 parcial · ⏳ pendente.

---

## 4. O que esta fatia entregou

- `modules/periodization-engine/` — motor estratégico puro e versionado
  (`strategy-v1`): `strategy-rules.ts` (S1–S7 + referências), `build-macrocycle.ts`
  (`buildMacrocycle` + ponte `toWeekContexts`), tipos e README.
- Ponte **Fase 1 → Fase 3**: cada microciclo alimenta o `planWeek` já existente —
  sem duplicar regra de sessão.
- 18 testes unitários (`tests/unit/modules/periodization-engine/`).
- Docs: `PERIODIZATION_ENGINE.md` + este índice.

Ver [`PERIODIZATION_ENGINE.md`](./PERIODIZATION_ENGINE.md) para a especificação
detalhada das regras.

---

## 5. Fatia 2 — Persistência + rota + UI (entregue)

- **Migração aditiva** `20260718170000_periodization_strategy_rationale`:
  `Periodization.strategyRationale Json?` — a saída explicável congelada na
  geração. Planos manuais seguem com o campo nulo.
- **Serviço** `periodization-engine-service.ts` (escopo org+treinador+acesso,
  auditoria `GENERATE_PERIODIZATION_STRATEGY`):
  - `proposeMacrocycle` — **preview**, não grava (alimenta o "simular antes de salvar");
  - `saveMacrocyclePlan` — grava `Periodization` (isDraft) + fases (mesociclos) +
    semanas (microciclos) + `strategyRationale`, em transação.
- **Rotas:** `POST …/periodizations/strategy/preview` (prévia) e
  `POST …/periodizations/strategy` (salva rascunho).
- **UI:** `components/periodization-strategy-modal.tsx` — botão **"✨ Gerar com
  ENKY"** na página de periodização: coleta prova/atleta, mostra a **proposta +
  o porquê** (regras, confiança, dados ausentes, referências) e só então salva
  como rascunho. Nada publica.
- **Schema/mapeamento** puros e testados (`strategy-input-schema.ts`,
  `toEngineLevel` PT→motor, ELITE→ADVANCED).

## 6. Próxima fatia recomendada

**Fase 2 — biblioteca científica de sessões** (catálogo com evidência/
contraindicação por sessão) para o gerador escolher sessões do catálogo em vez
de procedurais; e **Fase 6 — simulação** de CTL/ATL/TSB reaproveitando
`load-state`. Ambas agora têm onde encaixar (o plano-rascunho existe e é
persistido).
