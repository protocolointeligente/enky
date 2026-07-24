# modules/training-library — Biblioteca científica de sessões

**ENKY Intelligence 2.0 · Fase 2.** Catálogo declarativo, puro e versionado de
sessões de treino por modalidade. Cada entrada carrega tudo que o motor de
sugestão (Fase 3) precisa para **explicar** uma sugestão — objetivo, fase ideal,
sistema energético, zona/método, contraindicações, pré-requisitos, evidência e
referências.

## Postura

- **Opção fundamentada, não prescrição.** Uma sessão do catálogo é uma
  possibilidade com base científica; o motor propõe a partir daqui e o treinador
  decide.
- **Evidência honesta.** `evidenceLevel` A/B/C (revisão/consenso · estudos
  controlados · prática consagrada). Nunca vendemos "A" onde há só prática.
- **Versionado.** `CATALOG_VERSION` sobe a cada mudança de conteúdo — uma
  sugestão gerada continua explicável pela versão do catálogo que a originou.
- **Puro.** Sem Prisma, sem React — dado + consultas, testável sem fixture.

## Forma de uma sessão (`CatalogSession`)

`id` · `modality` · `title` · `objective` · `sessionKind` (ponte com o gerador) ·
`idealPhases[]` · `levels[]` · `energySystem` · `method` · `intensity` ·
`description` · `durationMin [min,max]` · `estimatedLoadPerHour` (descritivo) ·
`contraindications[]` · `prerequisites[]` · `evidenceLevel` · `references[]`.

## API

```ts
import {
  allSessions,
  getSession,
  querySessions,
  recommendSessions,
} from "@/modules/training-library/session-catalog";

querySessions({ modality: "RUNNING", phase: "BUILD", level: "INTERMEDIATE" });
recommendSessions({ modality: "CYCLING", phase: "PEAK", sessionKind: "QUALITY" });
```

- `querySessions(query)` — filtra por modalidade/fase/nível/tipo/sistema (ausente
  = não filtra). **TRIATHLON** une nado/pedal/corrida.
- `recommendSessions(criteria)` — como `querySessions`, ordenado por
  **especificidade** (menos fases ideais primeiro = mais específica para a fase).
  É a ponte que a Fase 3 usará para justificar uma sugestão.

## Cobertura v1

Corrida (5), natação (3), ciclismo (3), força (2) e core/estabilidade funcional
(1). Curado, não exaustivo — cada entrada é revisável e cresce por demanda real,
não por completude especulativa.

## Próximo (Fase 3)

O gerador de sessão (`modules/periodization/generation-rules.ts`) passará a
**enriquecer** cada sessão gerada com a entrada de catálogo correspondente
(objetivo, sistema energético, contraindicações, referências), fechando o
"por quê" da sugestão com a evidência da biblioteca.
