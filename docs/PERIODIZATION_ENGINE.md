# PERIODIZATION_ENGINE — Motor Estratégico (ENKY Intelligence 2.0 · Fase 1)

> **Status:** implementado nesta fatia (`modules/periodization-engine`), puro e
> testado (18 testes unitários). **Não** persiste ainda; **não** publica nada
> automaticamente.

## 1. Propósito

O treinador deixa de desenhar o macrociclo à mão. Ele informa **objetivo, data da
prova e o estado do atleta**; o motor propõe **a forma do ciclo inteiro** —
quantas semanas, como se agrupam em mesociclos, onde vai o pico e o taper, quando
desloadar e como a carga ondula. O treinador **revisa, edita e decide**. O motor
nunca publica.

Este é o diferencial competitivo do ENKY. Por isso a postura é rígida:
**explicável, rastreável, versionada, sem caixa-preta.**

## 2. Onde ele encaixa

```
                         ┌──────────────────────── Fase 1 (ESTE módulo) ───────────────────────┐
 entradas do atleta ───► │ buildMacrocycle → macrocycle + mesocycles[] + weeks[] + rationale    │
 (prova, nível, volume,  └───────────────────────────────────┬─────────────────────────────────┘
  dias disponíveis,                                           │ toWeekContexts()
  carga atual)                                                ▼
                         ┌──────────────────────── Fase 3 (reuso) ─────────────────────────────┐
                         │ planWeek() (modules/periodization/generation-rules.ts)               │
                         │   → sessões DRAFT com blocos, RPE, rationale e confiança             │
                         └──────────────────────────────────────────────────────────────────────┘
```

O motor estratégico **não duplica** nenhuma regra de sessão. Ele decide a
estrutura e entrega cada semana como um `WeekContext` para o gerador de semana já
existente e testado.

## 3. Entradas (`StrategicInputs`)

| Campo | Obrigatório | Ausente ⇒ |
|---|---|---|
| `modality` | ✅ | — |
| `startDate`, `eventDate` (YYYY-MM-DD) | ✅ | `eventDate ≤ startDate` → erro `INVALID_WINDOW` |
| `goal` | ✅ (string) | — |
| `level` (BEGINNER/INTERMEDIATE/ADVANCED) | — | assume INTERMEDIATE + `missingData` + confiança ↓ |
| `availableWeekdays` (1–7) | — | usado só na ponte para o gerador |
| `baseWeeklyVolumeKm` | — | padrão por modalidade/nível + `missingData` + confiança LOW (endurance) |
| `includeStrength` | — | false |
| `currentLoad` (CTL/ATL/TSB) | — | **contexto/aviso apenas** — nunca corta volume |

## 4. Regras científicas (`strategy-rules.ts`, `STRATEGY_VERSION = "strategy-v1"`)

| # | Regra | Resumo | Referência |
|---|---|---|---|
| S1 | Janela | `totalWeeks = ceil((dias+1)/7)`; teto 104 semanas | — |
| S2 | Taper | 0–3 semanas por duração e nível | Bosquet 2007 (meta-análise: ~2 semanas, corta volume, preserva intensidade) |
| S3 | Fases | BASE 50% · BUILD 35% · PEAK 15% das semanas de preparação; ≥1 em cada; sobra vai p/ BASE; ciclos curtos colapsam | Bompa & Buzzichelli 2019; Issurin 2010 |
| S4 | Deload | 3:1 (iniciante) / 4:1; nunca no taper nem na semana da prova | — |
| S5 | Volume/intensidade por fase | `volumeFactor` + `intensityFocus` (polarizada nas fases duras) | Seiler 2010 |
| S6 | Onda de carga | degraus ~+7% (teto +21%), deload a 60% | Gabbett 2016 (como **aviso**, não gatilho) |
| S7 | Volume-base | informado, ou padrão com aviso | — |

Cada regra aplicada aparece em `rationale.rules[]` com `{ id, version, explanation }`;
`rationale.references[]` lista a bibliografia; `rationale.missingData[]` e
`rationale.caveats[]` explicitam o que faltou e o que assumir com cautela.

## 5. Saída (`MacrocycleResult`)

Resultado **tipado** — nunca lança para fluxo de negócio (idêntico ao motor de
zonas):

- `ok: false` → `{ code: "INVALID_WINDOW" | "WINDOW_TOO_LONG", message }`.
- `ok: true` → `{ macrocycle, mesocycles[], weeks[], confidence, rationale }`.
  - `mesocycles[]` particiona exatamente as semanas (sem buraco/sobreposição).
  - `weeks[]` traz por semana: fase, `isRecoveryWeek`, `isEventWeek`, `loadStep`,
    `targetVolumeKm` (null p/ força) e `intensityFocus`.
  - `confidence`: `HIGH | MODERATE | LOW` — o **menor** teto disparado.

## 6. Invariantes garantidas por teste

- Semanas cobrem a janela sem buracos; a última é a da prova e não a ultrapassa.
- Fases afunilam (BASE ≥ BUILD ≥ PEAK) e o taper fecha na prova.
- Os rótulos de fase **reclassificam de volta na mesma `PhaseKind`** quando o
  gerador de semana os relê (regressão do bug "afinamento" → TAPER).
- Deload respeita cadência do nível e evita taper/semana da prova.
- Faltou volume → padrão + `missingData` + confiança LOW; nunca silencioso.
- `currentLoad` não altera o volume gerado (só vira aviso).

## 7. Fora de escopo desta fatia

Persistência da saída (gravar `Periodization`/fases/semanas), catálogo de sessões
com evidência (Fase 2), editor com recálculo/simulação (Fases 4/6), regeneração
preservando aceitos (Fase 5) e background jobs (Fase 9). Ver
[`ENKY_INTELLIGENCE_ENGINE.md`](./ENKY_INTELLIGENCE_ENGINE.md) para o mapa das
fases e o estado de cada uma.
