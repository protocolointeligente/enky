# ENKY 25 — PERIODIZAÇÃO: ARQUITETURA, FLUXOS E GERAÇÃO DE TREINOS
**Versão 1.0** — Diretrizes de Planejamento Estratégico, Geração Automática Assistida e Métricas de Periodização da ENKY

---

## 1. OBJETIVO DESTE DOCUMENTO

Este documento define como a periodização deve funcionar dentro da plataforma ENKY.

A periodização é a camada estratégica do planejamento. O calendário é o centro operacional da prescrição. A prescrição define o conteúdo das sessões. O feedback fecha o ciclo de adaptação.

A relação correta é:
$$\text{Objetivo do atleta} \rightarrow \text{Periodização} \rightarrow \text{Fases} \rightarrow \text{Microciclos} \rightarrow \text{Sessões} \rightarrow \text{Calendário} \rightarrow \text{Execução} \rightarrow \text{Feedback} \rightarrow \text{Análise} \rightarrow \text{Ajuste}$$

Este documento estabelece:
- estrutura hierárquica da periodização;
- fluxo de criação manual;
- fluxo de criação assistida pela ENKY Intelligence;
- geração de semanas e treinos;
- integração com calendário;
- integração com modalidades;
- regras de alteração e versionamento;
- periodização individual e por grupo;
- critérios de pronto;
- limites do MVP;
- regras para Claude Code/Codex.

---

## 2. PRINCÍPIO CENTRAL

A periodização define direção. O calendário transforma essa direção em ações concretas.

Nenhuma periodização deve existir apenas como uma timeline visual desconectada dos treinos reais. Nenhum treino gerado por periodização deve existir fora do calendário.

*Regra central:* Toda sessão derivada da periodização deve ser criada como `Workout` vinculado à fase e ao microciclo de origem, inserida no calendário como rascunho editável (`DRAFT`) e publicada somente após validação do treinador.

---

## 3. PAPEL DA PERIODIZAÇÃO NA ENKY

A periodização deve ajudar o treinador a organizar:
- objetivo principal e datas-alvo;
- provas e eventos;
- fases de treinamento;
- prioridades fisiológicas e técnicas;
- frequência semanal;
- distribuição de volume e intensidade;
- semanas regenerativas;
- treinos-chave;
- avaliações e testes;
- polimento, competição, transição;
- alterações decorrentes de feedback e contexto.

A periodização não substitui o julgamento do treinador. Ela organiza, estrutura e documenta o raciocínio do planejamento.

---

## 4. HIERARQUIA CONCEITUAL

A arquitetura deve permitir a seguinte hierarquia:

```
Periodization (Macrocycle)
├── PeriodizationPhase (Mesociclo)
│   ├── TrainingWeek (Microciclo)
│   │   ├── Workout (Sessão de Treino)
│   │   ├── Workout
│   │   └── Workout
│   └── TrainingWeek
└── TargetEvent (Evento-alvo)
```

No MVP, a entidade `Periodization` representa o macrociclo principal. As fases representam blocos estratégicos ou mesociclos. As `TrainingWeeks` representam microciclos semanais. Os `Workouts` representam sessões reais no calendário.

---

## 5. ENTIDADE PERIODIZATION

Campos mínimos:
- `id`;
- `athleteId` ou `groupId`;
- `trainerId`;
- `organizationId`;
- `title`, `modality`, `secondaryModalities`, `goal`, `level`;
- `startDate`, `endDate`;
- `targetEventId` (opcional), `targetEventName`, `targetDate`;
- `weeklyFrequency`, `currentWeeklyVolume`, `preferredTrainingDays`, `unavailableDays`;
- `status` (`DRAFT`, `ACTIVE`, `PAUSED`, `COMPLETED`, `ARCHIVED`, `SUPERSEDED`);
- `generationMode` (`MANUAL`, `ASSISTED`, `AUTOMATIC_DRAFT`);
- `notes`, `version`, `createdAt`, `updatedAt`, `archivedAt`.

---

## 6. ENTIDADE PERIODIZATION PHASE

Objetivo: Representar uma fase estratégica do ciclo (mesociclo).

Campos:
- `id`, `periodizationId`, `name`, `startDate`, `endDate`, `sequence` (order);
- `phaseType` (`ADAPTATION`, `GENERAL_PREPARATION`, `BASE`, `DEVELOPMENT`, `SPECIFIC`, `COMPETITION`, `TAPER`, `TRANSITION`, `RECOVERY`, `RETURN_TO_TRAINING`, `CUSTOM`);
- `objective`, `volumeFocus`, `intensityFocus`, `modalityDistribution`, `weeklyFrequencyTarget`, `keySessionsTarget`, `recoveryStrategy`, `notes`, `createdAt`, `updatedAt`.

---

## 7. ENTIDADE TRAINING WEEK

Objetivo: Representar o microciclo semanal.

Campos:
- `id`, `periodizationId`, `phaseId`, `sequence` (weekNumber), `startDate`, `endDate`;
- `focus`, `plannedFrequency`, `plannedVolume`, `plannedDuration`, `plannedLoad`, `intensityDistribution`, `modalityDistribution`;
- `isRecoveryWeek`, `isCompetitionWeek`, `keyWorkoutCount`, `status`, `notes`, `generationStatus` (`NOT_GENERATED`, `PARTIALLY_GENERATED`, `GENERATED_DRAFT`, `REVIEWED`, `PUBLISHED`, `MODIFIED_AFTER_GENERATION`);
- `createdAt`, `updatedAt`.

---

## 8. VÍNCULO DO WORKOUT COM A PERIODIZAÇÃO

> **Reconciliado na Fase 01.5 (achado F3):** esta seção usava valores de `source`
> (`PERIODIZATION_MANUAL`, `PERIODIZATION_ASSISTED`, `PERIODIZATION_AUTOMATIC`) e
> nomes de campo (`phaseId`, `isGenerated`, `generationReason`) que não existem no
> enum `WorkoutSource` nem no modelo `Workout` do Data Model Specification v1.2.1
> — documento de maior hierarquia. Corrigido abaixo para usar exatamente o
> contrato aprovado.

O contrato canônico de origem é:

```prisma
enum WorkoutSource {
  MANUAL
  PERIODIZATION_GENERATED
  TEMPLATE
  MARKETPLACE
  IMPORTED
}

enum GenerationMode {
  AUTOMATIC
  ASSISTED
}
```

- **Prescrição manual vinculada a uma periodização** (fluxo "Não gerar sessões" do §15, modo 1): `source = MANUAL`. O treino ainda carrega `periodizationId`/`periodizationPhaseId`/`trainingWeekId` para contexto, mas não foi produzido pelo motor de geração.
- **Qualquer treino produzido pela `PeriodizationGenerationEngine`** (modos 2–4 do §15): `source = PERIODIZATION_GENERATED`. A distinção entre sugestão assistida e rascunho automático completo fica em `generationMode` (`AUTOMATIC` | `ASSISTED`), nunca em um novo valor de `source`.
- Não criar valores de origem redundantes com `generationMode` — a pergunta "veio da periodização?" é `source`; a pergunta "com quanto automatismo?" é `generationMode`.

Todo `Workout` derivado da periodização deve conter, com os nomes de campo exatamente como no Data Model Specification v1.2.1 §5:
- `periodizationId`, `periodizationPhaseId`, `trainingWeekId`, `athleteId`, `trainerId`;
- `plannedDate`, `modality`;
- `source` (ver acima) e, quando `PERIODIZATION_GENERATED`, `generationMode`;
- `generationBatchId`, `generationVersion`, `algorithmVersion`, `generationRationale` (não existe campo separado `isGenerated`/`generationReason` — a origem já é dada por `source`, e a justificativa textual por `generationRationale`).

*Regra:* Alterar um `Workout` não deve apagar o vínculo com a periodização. O sistema deve registrar que o treino foi modificado após a geração (`trainerModified = true`, `trainerModifiedAt`, `trainerModifiedBy`, `modifiedFields`).

---

## 9. ROTAS PRINCIPAIS

- `/treinador/periodizacao`
- `/treinador/periodizacao/criar`
- `/treinador/periodizacao/[id]`
- `/treinador/periodizacao/[id]/editar`
- `/treinador/periodizacao/[id]/semanas/[weekId]`
- `/treinador/periodizacao/[id]/gerar-treinos`
- `/treinador/periodizacao/[id]/historico`

---

## 10. TELA /TREINADOR/PERIODIZACAO

Objetivo: Listar periodizações e mostrar a situação do planejamento.

Componentes:
- seletor de atleta ou grupo;
- filtros por status e modalidade;
- botão Criar Periodização;
- cards ou tabela de ciclos com indicador de fase atual, data-alvo, semanas restantes, status de geração de treinos e aderência resumida;
- atalhos para calendário filtrado, edição e geração de semanas/treinos.

*Estado vazio:* "Este atleta ainda não possui uma periodização ativa. Crie um planejamento para estruturar fases, semanas e sessões no calendário."

---

## 11. CRIAÇÃO DE PERIODIZAÇÃO — ETAPA 1: CONTEXTO

O treinador deve informar:
- atleta ou grupo;
- modalidade principal e complementares;
- nível, objetivo principal, evento ou prova-alvo, data-alvo, data de início;
- disponibilidade semanal, dias preferenciais, tempo disponível por sessão;
- volume atual, histórico recente, limitações e observações.

O sistema deve carregar automaticamente dados existentes do perfil do atleta, sem obrigar repetição.

---

## 12. CRIAÇÃO — ETAPA 2: ESTRUTURA DO CICLO

O treinador escolhe:
1.  **Construção manual:** O treinador define fases, datas e objetivos.
2.  **Sugestão assistida:** A ENKY Intelligence sugere fases e distribuição, explicando o raciocínio.
3.  **Estrutura automática em rascunho:** O sistema propõe uma estrutura completa inicial (status `DRAFT`).

---

## 13. CRIAÇÃO — ETAPA 3: DEFINIÇÃO DAS FASES

Para cada fase, informar:
- nome, tipo, data inicial, data final, objetivo;
- prioridade fisiológica/técnica, foco de volume, foco de intensidade;
- frequência semanal, treinos-chave previstos, estratégia de recuperação, observações.

*Validações:*
- fases não podem se sobrepor sem justificativa explícita;
- fases devem estar dentro do período total do macrociclo;
- não pode haver lacuna não explicada entre fases;
- data-alvo deve estar dentro ou imediatamente após a fase final.

---

## 14. CRIAÇÃO — ETAPA 4: GERAÇÃO DOS MICROCICLOS

O sistema cria `TrainingWeeks` entre a data inicial e final. Cada semana recebe:
- número de sequência, fase associada, foco, volume planejado, frequência;
- intensidade predominante, modalidade/distribuição;
- indicação de semana regenerativa ou semana de competição/teste.

O treinador pode ajustar os valores semanais antes de gerar sessões.

---

## 15. CRIAÇÃO — ETAPA 5: GERAÇÃO DE SESSÕES

Modos:
1.  **Não gerar sessões:** A periodização serve apenas como direção estratégica. O treinador prescreve manualmente no calendário.
2.  **Gerar semana selecionada:** O sistema gera rascunhos somente para um microciclo.
3.  **Gerar intervalo de semanas:** O treinador escolhe um período limitado.
4.  **Gerar ciclo completo:** Disponível apenas quando houver dados suficientes e confirmação explícita.

*Recomendação MVP:* Priorizar geração de uma semana ou pequeno intervalo, reduzindo risco de criar dezenas de sessões inadequadas.

---

## 16. POSICIONAMENTO DAS SESSÕES NO CALENDÁRIO

A geração deve considerar:
- dias disponíveis e preferenciais;
- duração permitida;
- treinos-chave, recuperação entre intensidades;
- modalidade, conflitos com eventos, treinos já existentes;
- provas, testes e restrições cadastradas.

Todos os `Workouts` entram como `DRAFT`. O treinador revisa, edita, move ou exclui no calendário, e publica individualmente ou em lote.

---

## 17. FORMULÁRIO ÚNICO DE PRESCRIÇÃO

Ao abrir ou editar uma sessão gerada na periodização, o sistema deve utilizar o mesmo módulo de prescrição do calendário (flyout). Isso garante consistência de validação, campos, persistência e evita duplicação de código.

---

## 18. PERIODIZAÇÃO MANUAL

Fluxo:
1.  Treinador cria periodização, define fases e semanas, sem gerar sessões.
2.  Prescreve treinos manualmente no calendário, vinculando cada sessão à fase e à semana correspondente.
3.  O calendário exibe o contexto de periodização (fase atual, foco, volume planejado, etc.).

---

## 19. PERIODIZAÇÃO ASSISTIDA

A ENKY Intelligence sugere a estrutura (fases, semanas regenerativas, progressão de volume/intensidade, testes, polimento e sessões de treino), sempre apresentando:
- dados utilizados, observação, interpretação e justificativa;
- nível de confiança, limitações de dados;
- opção de aceitar, editar ou rejeitar.

---

## 20. DADOS MÍNIMOS PARA GERAÇÃO ASSISTIDA

*   **Mínimos:** modalidade, objetivo, nível, datas (início e alvo), disponibilidade semanal, volume atual aproximado e histórico básico.
*   **Recomendados:** testes recentes, zonas, feedbacks de carga, histórico de aderência, restrições e preferências do treinador.

Se os dados forem insuficientes, a ENKY deve reduzir a confiança do insight e evitar gerar o ciclo completo.

---

## 21. REGRAS DE PROGRESSÃO

A plataforma não impõe fórmulas universais. A progressão depende da modalidade, nível do atleta, histórico de carga e tolerância individual. A ENKY alerta sobre aumentos abruptos de volume/intensidade ou baixa recuperação, mas o treinador mantém a decisão final.

---

## 22. SEMANA REGENERATIVA

A periodização permite marcar uma semana como regenerativa (`isRecoveryWeek = true`). Atributos:
- redução de volume planejada e intensidade controlada;
- menor número de sessões-chave;
- foco explícito em recuperação fisiológica.

---

## 23. TREINOS-CHAVE

O treinador define treinos-chave semanais (ex: longão, ritmo de prova, intervalado principal, simulado, teste de força). Os treinos-chave ganham destaque visual no calendário e nos relatórios de conformidade.

---

## 24. TESTES E AVALIAÇÕES NA PERIODIZAÇÃO

Permite posicionar `TestResult` planejados ou `CalendarEvent` de teste. O resultado do teste atualiza zonas e ritmos de referência para os próximos microciclos, sem alterar retroativamente treinos já concluídos.

---

## 25. ALTERAÇÃO DA DATA-ALVO

Quando a prova-alvo muda, o sistema pergunta se deve:
- manter fases e deslocar datas;
- recalcular semanas futuras;
- criar nova versão ou encerrar o ciclo atual.

*Regra:* Treinos concluídos ou com feedback são preservados. Treinos futuros publicados exigem confirmação antes de mover.

---

## 26. ALTERAÇÃO DE FASE COM TREINOS JÁ GERADOS

Ao alterar as datas de uma fase ativa, o sistema gerencia o impacto nos rascunhos e treinos publicados. Nunca move treinos publicados de forma automática sem a confirmação explícita do treinador.

---

## 27. VERSIONAMENTO

A periodização possui versão (`version`). Cria-se uma nova versão (`status = SUPERSEDED` na antiga) em alterações profundas de datas, objetivos ou fuso de faturamento. Versões anteriores permanecem disponíveis para auditoria.

---

## 28. DUPLICAÇÃO DE PERIODIZAÇÃO

Permite duplicar um planejamento para servir de modelo/template. A cópia cria novos identificadores de ciclo, remove feedbacks, execuções, dores ou dados pessoais do atleta anterior, e permite ajustar datas e vincular a um novo atleta/grupo.

---

## 29. PERIODIZAÇÃO POR GRUPO

Permite planejar para equipes/grupos:
- cria-se a periodização base do grupo;
- geram-se as semanas comuns;
- geram-se sessões individualizadas para cada membro do grupo para coleta de feedbacks individuais.

---

## 30. PERIODIZAÇÃO E MARKETPLACE

Planos do marketplace podem conter estruturas periodizadas completas. Ao adquirir:
- o plano original do marketplace permanece imutável e versionado;
- gera-se uma instância de aplicação no calendário do atleta como rascunhos editáveis pelo treinador associado.

---

## 31. ESPECIFICIDADES POR MODALIDADE

- **Corrida:** Prova-alvo, distância-alvo, volume semanal (km), longões, zonas de FC/pace, testes de referência e polimento.
- **Ciclismo:** Duração semanal (min), potência/FTP, zonas de potência/FC, cadência, indoor/outdoor e sessões específicas.
- **Natação:** Metragem semanal (metros), séries e educativos, ritmo por 100m, tipo de piscina/águas abertas.
- **Triatlo:** Distribuição integrada de volumes (corrida, ciclismo, natação), treinos brick (transição), fadiga integrada.
- **Musculação e Funcional:** Foco (força, hipertrofia, potência, complementar), divisão de treino, volume por grupo muscular, séries, repetições, RPE/RIR, deload.

---

## 32. CRITÉRIOS DE PRONTO E REGRAS PARA AGENTES

Uma periodização só está "pronta" para execução no MVP quando:
- salva no banco PostgreSQL via Prisma, com integridade referencial completa;
- vincula treinos ao calendário como `DRAFT` na semana correta;
- utiliza o formulário único de prescrição do calendário;
- respeita as invariantes de tenant e RBAC do treinador e atleta;
- não altera treinos concluídos nem move treinos publicados sem confirmação.

> **A periodização é o coração estratégico.**  
> **O calendário é o coração operacional.**  
> **A ENKY sugere. O treinador decide.**
