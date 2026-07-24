# modules/periodization-engine — Motor Estratégico

**ENKY Intelligence 2.0 · Fase 1.** A camada **acima** do gerador de semana
(`modules/periodization/generation-rules.ts`). Enquanto aquele transforma _uma_
semana em sessões, este decide, **de cima para baixo**, a forma do ciclo inteiro
a partir da **data da prova** e do estado do atleta:

```
StrategicInputs ──► buildMacrocycle ──► { macrocycle, mesocycles[], weeks[], rationale }
   (prova, nível,                              │
    volume, dias)                              ▼
                                       toWeekContexts()  ── Fase 3 ──►  planWeek() ──► sessões DRAFT
```

## O que ele decide

| Decisão | Regra | Referência |
|---|---|---|
| Total de semanas | janela início→prova | S1 |
| Comprimento do taper | 0–3 semanas por duração/nível | S2 · Bosquet 2007 |
| Fases (BASE→BUILD→PEAK→TAPER) | afunilamento geral→específico | S3 · Bompa, Issurin |
| Cadência de deload | 3:1 (iniciante) / 4:1 | S4 |
| Volume/intensidade por fase | fatores + distribuição polarizada | S5 · Seiler 2010 |
| Onda de carga na semana | degraus conservadores + deload | S6 |
| Volume-base de partida | informado ou padrão (com aviso) | S7 |

## Postura (não negociável)

- **Propõe, não publica.** Toda saída é sugestão; nada vai ao calendário sozinho.
- **Explicável e versionado.** Cada decisão vira uma linha em `rationale.rules`
  com versão; `rationale.references` lista a origem científica. `STRATEGY_VERSION`
  sobe junto com qualquer mudança de fórmula.
- **Sem precisão falsa.** Faltou dado? Gera assim mesmo, rebaixa `confidence` e
  lista o ausente em `rationale.missingData`. Nunca em silêncio.
- **CTL/ATL/TSB é contexto, não gatilho.** O estado de carga aparece como aviso;
  nunca corta volume automaticamente (mesma postura de `load-state.ts`).

## API

```ts
import { buildMacrocycle, toWeekContexts } from "@/modules/periodization-engine/build-macrocycle";
import { planWeek } from "@/modules/periodization/generation-rules";

const result = buildMacrocycle({
  modality: "RUNNING",
  goal: "Maratona de São Paulo",
  startDate: "2026-01-05",
  eventDate: "2026-04-26",
  level: "INTERMEDIATE",
  availableWeekdays: [1, 3, 5, 7],
  baseWeeklyVolumeKm: 45,
  includeStrength: true,
});

if (result.ok) {
  // Pipeline completo Fase 1 → Fase 3:
  const weeks = toWeekContexts(result, { availableWeekdays: [1, 3, 5, 7], includeStrength: true });
  const sessionsByWeek = weeks.map(planWeek);
}
```

`buildMacrocycle` retorna um **resultado tipado** (`ok: true | false`) — nunca
lança para fluxo de negócio, idêntico ao motor de zonas.

## Arquivos

- `periodization-engine-types.ts` — tipos (reutiliza os primitivos do gerador).
- `strategy-rules.ts` — regras S1–S7, puras, versionadas, com `STRATEGY_REFERENCES`.
- `build-macrocycle.ts` — `buildMacrocycle` (entrada única) + `toWeekContexts` (ponte).

## Fora de escopo desta fatia (próximas fases)

- **Fase 2** — biblioteca científica de sessões (catálogo com evidência por sessão).
- **Fase 4/5/6** — editor com recálculo, regeneração preservando aceitos, simulação.
- **Fase 9** — mover a geração para background job quando o custo justificar.
- Persistência: hoje o motor é puro; o serviço que grava `Periodization`/fases/
  semanas a partir da saída é a próxima fatia de integração.
