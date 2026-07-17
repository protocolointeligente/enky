# modules/periodization

**Responsabilidade:** camada estratégica do planejamento — `Periodization`, `PeriodizationPhase`, `TrainingWeek`, `GenerationBatch`, e a `PeriodizationGenerationEngine` (geração assistida de treinos).

**Fonte de verdade:** Data Model Specification v1.2.1 §3–4; ENKY 25 — Periodização; Interface Architecture v1.4 §5.

**Achado F3 resolvido na Fase 01.5:** origem = `WorkoutSource.PERIODIZATION_GENERATED` (motor) ou `MANUAL` (prescrição manual vinculada); automatismo = `generationMode` (`AUTOMATIC`/`ASSISTED`). Ver ENKY 25 §8 e Data Model v1.2.1 §1/§5.

## Status

**Camada estratégica (manual).** `periodization-service.ts` cria/lista/lê/exclui `Periodization` + `PeriodizationPhase` + `TrainingWeek` (semanas derivadas da janela por `deriveWeeks`); a leitura conta treinos já agendados na janela de cada semana. Rotas: `POST/GET /api/trainer/athletes/[athleteId]/periodizations`, `GET/DELETE /api/trainer/periodizations/[id]`. UI: `/treinador/periodizacao`.

**Geração assistida por semana (Fase 6).** `generation-rules.ts` (motor puro) + `generate-week.ts` (persistência). Rota: `POST /api/trainer/periodizations/[id]/weeks/[weekId]/generate`. Os modelos `Periodization`/`PeriodizationPhase`/`TrainingWeek`/`GenerationBatch` já contemplavam tudo que a fase pedia — **nenhuma migration foi necessária**. `Workout.trainingWeekId` agora é de fato preenchido pelo motor (o casamento por sobreposição de datas continua valendo para treinos manuais).

Escopo atual: `SINGLE_WEEK`, `generationMode = ASSISTED`. `AUTOMATIC` e `FULL_CYCLE` não existem — e não é omissão: publicar sem revisão humana não é um recurso que faltou, é uma decisão de produto contra.

## Como funciona

`planWeek(context)` é **puro** — não conhece Prisma. Por isso as regras são testáveis por modalidade sem banco (`tests/unit/modules/periodization/generation-rules.test.ts`), e `generate-week.ts` fica sendo só persistência (coberto por `tests/integration/periodization-generation.test.ts`).

Entradas que a geração respeita:

| Entrada                         | De onde vem                                                                                                          |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Objetivo                        | `Periodization.goal`                                                                                                 |
| Fase do ciclo                   | `PeriodizationPhase.name`, classificado por palavra-chave (base/build/pico/taper/transição)                          |
| Semana regenerativa             | `TrainingWeek.isRecoveryWeek`                                                                                        |
| Volume alvo                     | `TrainingWeek.targetVolume` → senão `PeriodizationPhase.targetVolumeKm` → senão padrão por nível (com confiança LOW) |
| Intensidade alvo                | `TrainingWeek.targetIntensity` / da fase — mantida como nota, não convertida em zonas                                |
| Nível e disponibilidade semanal | **requisição** — não existem no `AthleteProfile`                                                                     |
| Modalidade                      | requisição                                                                                                           |

Nível e disponibilidade vêm na requisição de propósito: não são fato cadastral, são decisão de planejamento que muda de ciclo para ciclo. Se um dia virarem estáveis por atleta, aí vale a coluna e a migration.

Volume alvo é **sempre em km**, inclusive natação (8 → 8000 m).

## Postura científica

Estas regras existem para o motor não vender precisão que não tem. Mudá-las é decisão de produto, não refactor.

- **O motor propõe, o treinador dispõe.** Toda sessão nasce `DRAFT`. Não existe caminho de auto-publicação — nem com flag. Publicar é `modules/workouts/publish-workout.ts`, por ação explícita.
- **Intensidade em RPE, nunca em pace/potência calculados.** Sem teste de pace/FTP/CSS/1RM no sistema, prescrever ritmo exato ou %1RM seria inventar precisão. Quando houver teste, aí a regra sobe de versão.
- **Faltou dado, gera rebaixado — nunca em silêncio.** Sem volume alvo → `LOW`; sem nível ou fase não reconhecida → no máximo `MODERATE`. O dado ausente vai em `missingData` e o motivo em `caveats`. A confiança é sempre o **menor** teto disparado.
- **Confiança HIGH ≠ prescrição correta.** Significa apenas que o motor tinha os dados que a regra pede. A revisão do treinador é obrigatória em qualquer nível.
- **Triathlon nunca passa de `MODERATE`.** Um alvo escalar em km não é divisível entre nado/pedal/corrida sem arbitrar — 1 km de nado não custa 1 km de pedal. A proporção usada é referência, e isso é dito no rationale.
- **ACWR não é consumido aqui.** Ele é descritivo em `modules/intelligence/load-state.ts` e não tem validade como preditor isolado de lesão; usá-lo para decidir volume seria exatamente o erro que a literatura aponta. Quem manda no volume é o alvo que o treinador definiu.
- **Fórmulas versionadas.** `ALGORITHM_VERSION` (`gen-v1`) + `version` por regra. Mudou uma fórmula? Sobe a versão da regra **e** o `ALGORITHM_VERSION` — um treino gerado no passado tem que continuar explicável pela regra que de fato o gerou.

## Rastreabilidade

`GenerationBatch.contextSnapshot` congela **a entrada** (o que o motor viu); `generationRationale` congela **o raciocínio** (regra a regra, com versão). O rationale é gravado também em cada `Workout`, não só no lote: o treinador revisa uma sessão por vez e precisa da regra ali, não num lote distante.

Regerar a mesma semana exige `replaceExisting` e **só descarta rascunho gerado e não tocado** — publicado ou editado pelo treinador (`trainerModified`) sobrevive. É `update-workout-draft.ts` que marca `trainerModified`; sem essa marca, editar e regerar perderia o trabalho do treinador.
