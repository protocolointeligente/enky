# TRAINING_LIBRARY — Biblioteca científica de sessões (Fase 2)

> **Status:** implementada (`modules/training-library`, pura e testada — 10
> testes), com rota de leitura e página de navegação. Consumida pelo motor de
> sugestão na Fase 3.

## 1. Propósito

Um catálogo **declarativo, puro e versionado** de sessões por modalidade. Cada
sessão é uma **opção fundamentada** — não uma prescrição — que carrega tudo que a
Fase 3 precisa para **explicar** uma sugestão: objetivo, fase ideal, sistema
energético, zona/método, contraindicações, pré-requisitos, evidência e
referências.

## 2. Forma da sessão

| Campo | Uso |
|---|---|
| `id` | slug estável, referenciado por sugestões geradas |
| `modality` / `sessionKind` | ponte com o gerador (`generation-rules`) |
| `objective` | o "para quê" da sessão, uma frase |
| `idealPhases[]` / `levels[]` | quando e para quem faz sentido |
| `energySystem` | sistema energético predominante (explicação) |
| `method` / `intensity` | como executar e em que zona |
| `durationMin [min,max]` / `estimatedLoadPerHour` | dimensionamento (descritivo) |
| `contraindications[]` / `prerequisites[]` | segurança e requisitos |
| `evidenceLevel` (A/B/C) / `references[]` | rastreabilidade científica |

## 3. Consultas (`session-catalog.ts`, `CATALOG_VERSION = "library-v1"`)

- `allSessions()` — cópia imutável do catálogo.
- `getSession(id)` — por id, ou `null`.
- `querySessions({ modality, phase, level, sessionKind, energySystem })` — filtra;
  ausente = não filtra. **TRIATHLON** une nado/pedal/corrida.
- `recommendSessions({ modality, phase, level?, sessionKind? })` — ordena por
  **especificidade** (menos fases ideais primeiro). É a ponte da Fase 3.

## 4. Rota e UI

- `GET /api/trainer/training-library?modality=&phase=&level=&sessionKind=` —
  leitura de dado ESTÁTICO, sem escopo de org (igual para toda a plataforma), só
  exige papel de treinador.
- Página `/treinador/biblioteca-sessoes` — navega o catálogo com filtros e mostra
  objetivo, sistema energético, zona, duração, contraindicações, pré-requisitos e
  as referências de cada sessão.

## 5. Postura editorial

- `evidenceLevel` **conservador e honesto**: A = revisão/consenso · B = estudos
  controlados · C = prática consagrada. Nunca "A" onde há só prática.
- **Curado, não exaustivo.** v1: corrida (5), natação (3), ciclismo (3), força (2),
  core/estabilidade (1). Cresce por demanda real, não por completude especulativa.
- **Versionado.** Mudou o conteúdo, sobe `CATALOG_VERSION` — uma sugestão gerada
  continua explicável pela versão que a originou.

## 6. Próximo (Fase 3)

`planWeek` passa a anexar a cada sessão gerada a entrada de catálogo
correspondente via `recommendSessions`, fechando a explicação da sugestão com a
evidência da biblioteca.
