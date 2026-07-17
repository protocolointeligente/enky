# modules/periodization

**Responsabilidade:** camada estratégica do planejamento — `Periodization`, `PeriodizationPhase`, `TrainingWeek`, `GenerationBatch`, e a `PeriodizationGenerationEngine` (geração assistida de treinos).

**Fonte de verdade:** Data Model Specification v1.2.1 §3–4; ENKY 25 — Periodização; Interface Architecture v1.4 §5.

**Achado F3 resolvido na Fase 01.5:** origem = `WorkoutSource.PERIODIZATION_GENERATED` (motor) ou `MANUAL` (prescrição manual vinculada); automatismo = `generationMode` (`AUTOMATIC`/`ASSISTED`). Ver ENKY 25 §8 e Data Model v1.2.1 §1/§5.

## Status

**Camada estratégica (manual).** `periodization-service.ts` cria/lista/lê/exclui `Periodization` + `PeriodizationPhase` + `TrainingWeek` (semanas derivadas da janela por `deriveWeeks`); a leitura conta treinos já agendados na janela de cada semana. Rotas: `POST/GET /api/trainer/athletes/[athleteId]/periodizations`, `GET/DELETE /api/trainer/periodizations/[id]`. UI: `/treinador/periodizacao`.

**Geração assistida (Fase 6).** `generation-rules.ts` (motor puro) + `generate-week.ts` (persistência) + `infer-generation-input.ts` (dedução do modo automático). Os modelos `Periodization`/`PeriodizationPhase`/`TrainingWeek`/`GenerationBatch` já contemplavam tudo que a fase pedia — **nenhuma migration foi necessária**. `Workout.trainingWeekId` agora é de fato preenchido pelo motor (o casamento por sobreposição de datas continua valendo para treinos manuais).

Escopos e modos (os dois eixos são independentes):

|               | `ASSISTED` — o treinador informa                                | `AUTOMATIC` — o motor deduz do histórico |
| ------------- | --------------------------------------------------------------- | ---------------------------------------- |
| `SINGLE_WEEK` | `POST /api/trainer/periodizations/[id]/weeks/[weekId]/generate` | idem, com `mode: "AUTOMATIC"`            |
| `FULL_CYCLE`  | `POST /api/trainer/periodizations/[id]/generate`                | idem, com `mode: "AUTOMATIC"`            |

**`AUTOMATIC` NÃO é auto-publicar.** `generationMode` descreve quem escolheu os parâmetros da prescrição, não quem decide o que o atleta enxerga. Nos dois modos e nos dois escopos todo treino nasce `DRAFT` e só é publicado por ação explícita do treinador. Não existe caminho de auto-publicação, nem atrás de flag — publicar sem revisão humana não é um recurso que falta, é uma decisão de produto contra.

`MESOCYCLE` continua fora: sem uma noção de mesociclo no modelo (as fases é que agrupam semanas), o enum existiria sem significado.

## Como funciona

`planWeek(context)` é **puro** — não conhece Prisma. Por isso as regras são testáveis por modalidade sem banco (`tests/unit/modules/periodization/generation-rules.test.ts`), e `generate-week.ts` fica sendo só persistência (coberto por `tests/integration/periodization-generation.test.ts`).

Entradas que a geração respeita:

| Entrada                      | De onde vem                                                                                                          |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Objetivo                     | `Periodization.goal`                                                                                                 |
| Fase do ciclo                | `PeriodizationPhase.name`, classificado por palavra-chave (base/build/pico/taper/transição)                          |
| Semana regenerativa          | `TrainingWeek.isRecoveryWeek`                                                                                        |
| Volume alvo                  | `TrainingWeek.targetVolume` → senão `PeriodizationPhase.targetVolumeKm` → senão padrão por nível (com confiança LOW) |
| Intensidade alvo             | `TrainingWeek.targetIntensity` / da fase — mantida como nota, não convertida em zonas                                |
| Nível                        | **requisição** — não existe no `AthleteProfile`, e **nunca é deduzido**                                              |
| Modalidade e disponibilidade | requisição (`ASSISTED`) ou deduzidas do histórico (`AUTOMATIC`)                                                      |

Nível e disponibilidade vêm na requisição de propósito: não são fato cadastral, são decisão de planejamento que muda de ciclo para ciclo. Se um dia virarem estáveis por atleta, aí vale a coluna e a migration.

Volume alvo é **sempre em km**, inclusive natação (8 → 8000 m).

O que o treinador informa **sempre vence** a dedução — mandar `modality` num pedido `AUTOMATIC` é válido, e o motor não marca esse campo como deduzido.

### O que o modo `AUTOMATIC` deduz (e o que se recusa a deduzir)

Olha os treinos dos últimos 60 dias do atleta, e só os que ele de fato assumiu (`PUBLISHED`/`COMPLETED`/`PARTIAL`/`MISSED`) — rascunho gerado pelo próprio motor não é evidência de rotina, seria o motor aprendendo com o próprio chute.

- **Modalidade**: a mais frequente do histórico.
- **Disponibilidade**: só os dias da semana que se **repetem** (≥2 vezes). Um treino solto numa terça não é rotina.
- **Nível: nunca.** Frequência não é nível — um iniciante disciplinado treina 5x/semana e um avançado em recuperação treina 3x. Deduzir daí seria inventar um dado que o sistema não tem.

Com menos de 4 treinos no histórico o motor **não deduz**: pede o dado (`ValidationError`) em vez de adivinhar. Toda dedução entra em `missingData`, é explicada na regra `automatic-inference` e **impede a confiança `HIGH`**.

No `FULL_CYCLE` a confiança do lote é a da **pior** semana, e o rationale devolvido é o dela: um ciclo não é mais confiável que a sua semana com menos dados, e é essa que o treinador precisa ver.

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

Regerar exige `replaceExisting` e **só descarta rascunho gerado e não tocado** — publicado ou editado pelo treinador (`trainerModified`) sobrevive. É `update-workout-draft.ts` que marca `trainerModified`; sem essa marca, editar e regerar perderia o trabalho do treinador.

## Custo de escrita

Um ciclo inteiro são dezenas de treinos e centenas de steps. A geração usa `persistManyWorkoutBlocks` (`modules/workouts/persist-blocks.ts`): **3 `createMany`** para blocos/steps/exercícios independente de quantos treinos entram, mais um `createMany` dos treinos — os ids são gerados no processo justamente para que os filhos referenciem os pais sem esperar retorno do banco. Os exercícios ainda vão um a um (upsert não tem forma batelada), mas deduplicados por nome em todo o lote.

Isso não é micro-otimização: com um `create` por linha, uma semana cheia já estourava os 5s padrão do Prisma num banco remoto (`Transaction not found`) — em produção, não só no teste. O teto segue em 30s porque a transação ainda apaga rascunhos e cria o lote.
