# ADAPTATION_ENGINE — Editor inteligente + Regeneração (Fases 4 e 5)

> **Status:** Fase 4 implementada (`modules/adaptation-engine`, pura e testada —
> 10 testes) e surfaceada no preview; Fase 5 (regeneração preservando o aceito)
> **já estava implementada** na geração assistida — aqui verificada e documentada.

## Fase 4 — Recálculo da semana

Ao gerar/editar as sessões de uma semana, o ENKY recalcula o que a mudança fez à
estrutura. Núcleo puro `week-analysis.ts` (`ANALYSIS_VERSION = "week-analysis-v1"`):

`analyzeWeek(sessions, prevWeekLoad?)` → `WeekAnalysis`:

| Campo | O que é |
|---|---|
| `internalLoad` | soma da carga interna prevista (UA) |
| `volumeKmTotal` | volume somado (null se nenhuma sessão informa km) |
| `loadByModality` | carga e % por modalidade (equilíbrio — útil no triathlon) |
| `intensity` | distribuição polarizada sobre a carga de **endurance** (força fora): `lowLoadPct` / `qualityLoadPct` |
| `qualityCount` / `hasRecovery` | densidade de qualidade e presença de regenerativo |
| `alerts[]` | avisos tipados |

Alertas (heurísticos, **avisos e não bloqueios**):

- `INTENSITY_TOO_HIGH` — qualidade > 35% da carga de endurance (deixa de ser polarizada · Seiler 2010).
- `NO_LOW_INTENSITY` — nenhuma sessão fácil na semana.
- `LOAD_SPIKE` — carga > 1,5× a da semana anterior (progressão abrupta · Gabbett 2016). Só dispara com `prevWeekLoad`.
- `SINGLE_KIND` — todas as sessões do mesmo tipo (info).

**Onde aparece:**

1. No **preview de sessões** (Fase 3): `enrichWeekPlan` devolve `analysis` junto —
   o modal "✨ Gerar com ENKY" mostra carga, polarização e alertas da semana-exemplo.
2. **Ligado aos treinos REAIS** (o editor): botão **"Analisar"** por semana em
   `/treinador/periodizacao` → `GET …/periodizations/[id]/weeks/[weekId]/analysis`.
   O serviço `analyze-training-week.ts` lê os treinos agendados na semana, usa o
   **sRPE real** quando o atleta já executou e **estima** a carga da prescrição
   quando é só rascunho, compara com a semana anterior (alerta de salto) e roda o
   `analyzeWeek`. Assim, editar/gerar um treino e clicar "Analisar" recalcula a
   semana de verdade.

### Estimador de carga (`estimate-workout-load.ts`, `load-estimator-v1`)

Quando não há sRPE (treino planejado), estima a carga interna da prescrição —
**sem inventar pace/potência**: sRPE-like `RPE × minutos`, minutos da duração ou,
na falta dela, de uma velocidade nominal por modalidade (aproximação
**declarada**, marcada como estimativa na UI). Também infere o tipo da sessão
(EASY/LONG/QUALITY/RECOVERY/STRENGTH) e o volume em km. É para **comparar semanas**
(polarização, salto), não para prescrever.

## Fase 5 — Regeneração preservando o aceito

Já implementada em `modules/periodization/generate-week.ts` e verificada nesta
fatia. Ao regerar uma semana ou o ciclo (`replaceExisting`), o filtro de
substituição é **estrito**:

```
status: "DRAFT" ∧ source: "PERIODIZATION_GENERATED" ∧ trainerModified: false
```

Ou seja, **nunca são tocados**:

- treinos **publicados** (o atleta já os vê);
- rascunhos que o treinador **editou** (`trainerModified: true` — escrito por
  `update-workout-draft.ts`);
- treinos **criados manualmente** ou por template (`source ≠ PERIODIZATION_GENERATED`).

Feedbacks e anotações vivem **no** treino preservado, então são preservados por
construção — regenerar recria só o rascunho intacto do próprio motor. Se houver
rascunho gerado a substituir e `replaceExisting` não vier, o serviço responde
`409 Conflict` pedindo a decisão consciente (nunca destrói em silêncio).

**Pendente (v2):** escopo de regeneração por sessão única e por mesociclo; hoje
é por semana (`SINGLE_WEEK`) ou ciclo inteiro (`FULL_CYCLE`).

## Postura

O motor **aponta**, o treinador **decide**. Limiares de alerta são heurísticos e
assumidos como tal; a regeneração jamais apaga trabalho aceito ou publicado.
