# ENKY Intelligence 2.0 — Entrega e Checklist de Homologação

**Branch:** `feat/intelligent-periodization-engine`
**Base recomendada do PR:** `feat/athlete-assessments-prescription-zones`
**Sem merge em `main`. Sem deploy em Production.**

> ⚠️ O PR contra a base acima inclui **um commit que não é desta iniciativa**:
> `cd858e1 feat(admin): feature flags + LGPD — WIP da Fase 05`, colocado ali por
> outra sessão entre o ponto de fork e os commits deste trabalho. Os 6 commits do
> Intelligence 2.0 são `32da813 → 1300088`.

## 1. Commits (Intelligence 2.0)

| Commit | Fase | Conteúdo |
|---|---|---|
| `32da813` | 1 | Motor estratégico puro (macro→meso→micro, taper, deload, onda de carga) |
| `cbdf126` | 1 | Persistência + rota + UI (rascunho + rationale + preview do "porquê") |
| `60995d0` | 2 | Biblioteca científica de sessões (catálogo + consultas + página) |
| `5af65d9` | 3 | Motor de sugestão (sessões auto-explicáveis: objetivo/sistema/risco/evidência) |
| `37169d1` | 6 | Simulação de carga CTL/ATL/TSB antes de salvar |
| `1300088` | 4/5 | Editor inteligente (recálculo da semana + alertas) + regeneração verificada |

## 2. Módulos novos (Fase 8 — desacoplados, ciência fora do React)

| Módulo | Papel |
|---|---|
| `modules/periodization-engine` | Motor estratégico (Fase 1) — `buildMacrocycle` + `toWeekContexts` |
| `modules/training-library` | Catálogo científico de sessões (Fase 2) |
| `modules/session-generator` | Enriquecimento/sugestão (Fase 3) — `enrichWeekPlan` |
| `modules/load-simulation` | Projeção CTL/ATL/TSB (Fase 6) — `projectLoad` |
| `modules/adaptation-engine` | Recálculo da semana + alertas (Fase 4) — `analyzeWeek` |

Reaproveitados sem reescrita: `periodization/generation-rules` (`planWeek`),
`training-zones`, `assessments`, `intelligence/load-state`.

## 3. Rotas novas

- `POST /api/trainer/athletes/[id]/periodizations/strategy/preview` — prévia do macrociclo (não grava)
- `POST /api/trainer/athletes/[id]/periodizations/strategy` — salva rascunho
- `POST /api/trainer/athletes/[id]/periodizations/strategy/simulate` — projeção de carga (não grava)
- `POST /api/trainer/athletes/[id]/session-suggestions` — sugestões enriquecidas (não grava)
- `GET  /api/trainer/training-library` — catálogo (dado estático)

## 4. UI

- Botão **"✨ Gerar com ENKY"** em `/treinador/periodizacao` → modal com: preview do
  macrociclo, "por que este plano?", sessões-exemplo (Fase 3), recálculo da semana
  (Fase 4) e simulação de carga (Fase 6). Nada é publicado; a proposta nasce rascunho.
- Página `/treinador/biblioteca-sessoes` — navegar o catálogo científico.

## 5. Migração

- `20260718170000_periodization_strategy_rationale` — **aditiva**, coluna
  `Periodization.strategyRationale JSONB` nullable. Planos manuais seguem com o
  campo nulo. Nenhuma migração destrutiva.

## 6. Testes e cobertura

`npm run validate` **verde** a cada fatia. Unitários novos por fase:
periodization-engine (18) + schema/mapeamento (9) + training-library (10) +
session-generator (6) + load-simulation (7) + adaptation-engine (10) = **60
testes novos**; suíte total **543 / 50 arquivos**. Núcleos científicos são
**puros e testados sem banco**.

**Pendente de ambiente (não de código):** integração (Vitest+Postgres) e E2E
(Playwright) exigem banco isolado; os fluxos novos ainda não têm spec de E2E
próprio — ver checklist.

## 7. Performance

Motores puros e síncronos (ms). A simulação enriquece todas as semanas do plano
em memória — barato para janelas típicas. **Fase 9 (background job + cache)** só
se justifica sob carga real (planos muito longos × muitas sessões).

## 8. Explicabilidade (Fase 7 — transversal)

Toda saída carrega `rules[]` (com versão), `references[]`, `missingData[]`,
`caveats[]` e `confidence`. Versões: `strategy-v1`, `library-v1`, `week-analysis-v1`,
`gen-v1` (gerador), `1.0.0` (carga). A racionalização estratégica é **congelada**
em `strategyRationale` na gravação.

## 9. Estado das 11 fases

✅ 1,2,3,4,5,6,7,8 · 🟡 9 (parcial — motor barato hoje) · 🟡 10/11 (unit+docs
prontos; integração/E2E/Preview pendentes de banco).

---

## 10. Checklist de homologação

### Código (verificável neste ambiente) — ✅
- [x] `npm run lint` (0 erros)
- [x] `npm run typecheck` (0 erros)
- [x] `npm run test` (543 unit verdes)
- [x] `npm run build` (compila)
- [x] `npm run prisma:validate` (schema válido)

### Ambiente / operador (fora deste ambiente) — ⬜
- [ ] Subir a branch em **Preview** com banco isolado
- [ ] `prisma migrate deploy` aplica `20260718170000_periodization_strategy_rationale` no banco de Preview
- [ ] `npm run test:integration` verde contra o Postgres de Preview
- [ ] `npm run test:e2e` verde (e, idealmente, novo spec dirigindo "✨ Gerar com ENKY")
- [ ] Homologação visual do fluxo: gerar → ver "porquê" → sessões-exemplo → recálculo → simular carga → salvar rascunho → gerar ciclo → revisar rascunhos
- [ ] Confirmar que **nada** é publicado automaticamente em nenhum passo
- [ ] Verificar isolamento cross-tenant nas rotas novas (treinador só acessa atleta vinculado)

### Abrir o PR (gh não está instalado neste ambiente)
- Instale o gh CLI **ou** use a URL de comparação:
  `https://github.com/protocolointeligente/enky/compare/feat/athlete-assessments-prescription-zones...feat/intelligent-periodization-engine`
- Marque como **Draft**. **Não** faça merge em `main` sem homologação.
