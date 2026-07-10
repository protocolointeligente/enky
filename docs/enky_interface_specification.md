# ENKY OS — INTERFACE ARCHITECTURE & SCREEN SPECIFICATIONS v1.4
**Approved for Implementation — Fonte Única de Verdade para Frontend, Rotas e Estados de UI**

**STATUS DO DOCUMENTO:**  
Versão oficial congelada para implementação.  
Este documento deve ser utilizado como fonte principal para frontend, rotas, navegação, componentes, estados de UI e integração visual com as regras de domínio da ENKY.

---

## 1. FUNDAÇÕES DA ARQUITETURA TÉCNICA DA INTERFACE

Todas as interfaces e fluxos devem obedecer estritamente às diretrizes de arquitetura, segurança e integridade de dados estabelecidas a seguir.

### A. Lógica temporal, fuso horário e persistência canônica

Hierarquia de resolução de timezone:
1.  Timezone salva no perfil do usuário;
2.  Timezone da organização ou assessoria vinculada;
3.  Timezone detectada no dispositivo como fallback.

Quando houver divergência entre o dispositivo e o perfil, a interface deve sugerir atualização de forma discreta.

*Treinos com horário definido:*
- `plannedStartAt` e `plannedEndAt` armazenados em UTC.

*Treinos sem horário definido:*
- `plannedDate` representa a data civil;
- `timezone` armazena a string IANA usada na criação;
- o backend calcula a janela local do dia sem deslocar a data civil.

### B. Estratégia de processamento e cache de métricas

No MVP, `DerivedMetric` pode ser atualizado sincronamente em eventos de domínio, especialmente:
- envio ou modificação de `WorkoutFeedback`;
- publicação de `Workout`;
- alteração quantitativa relevante de `Workout`;
- remoção de `Workout`.

*Cache:*
- cache transiente em memória ou Redis;
- TTL máximo recomendado de 24 horas;
- invalidação imediata em mutações relevantes do domínio;
- alteração de título ou descrição não recalcula histórico de carga;
- movimentação dentro do mesmo microciclo não recalcula séries históricas completas, salvo quando alterar agregações da janela temporal.

### C. Concorrência e optimistic locking

Entidades críticas devem conter:
- `version`: inteiro incremental;
- `updatedAt`: timestamp UTC.

Payloads de mutação devem enviar a versão conhecida pelo cliente. Caso a versão esteja desatualizada:
- abortar transação;
- retornar HTTP 409 Conflict;
- informar ao usuário que os dados foram modificados por outro operador.

### D. Segurança de dados de pagamento

A ENKY não recebe, processa, persiste nem registra:
- número completo do cartão;
- CVV;
- validade;
- senha;
- dados brutos sensíveis.

O frontend usa exclusivamente componentes tokenizados do gateway, como Hosted Fields ou iFrames isolados.

### E. Pipeline transacional, modular e idempotente

A arquitetura adota monólito modular, baixo acoplamento e transações atômicas. Webhooks e operações críticas devem usar:
- assinatura validada;
- idempotency key;
- controle de reprocessamento;
- logs apenas em mudanças reais de estado.

### F. Restrição por inadimplência

A inadimplência deve bloquear mutações no backend, nunca apenas na interface. Dados históricos não podem ser apagados. A interface deve comunicar a restrição e encaminhar para regularização.

---

## 2. ENUMS OFICIAIS DE CONTROLE DE ESTADO

### A. WorkoutStatus

*   `DRAFT` — rascunho invisível para o atleta.
*   `PUBLISHED` — treino publicado e visível ao atleta.
*   `IN_PROGRESS` — treino em andamento quando houver controle de execução.
*   `COMPLETED` — treino realizado integralmente.
*   `PARTIAL` — treino realizado parcialmente.
*   `MISSED` — treino marcado como não realizado pelo atleta ou encerrado por regra de domínio sem execução registrada.
*   `ARCHIVED` — treino removido do fluxo ativo, preservando histórico.
*   `CANCELLED` — treino cancelado explicitamente pelo treinador.

### B. SessionRpeLoadStatus

*   `COMPLETE` — duração real e RPE da sessão válidos; carga calculada.
*   `PARTIAL` — uma das variáveis obrigatórias está ausente; `sessionRpeLoad` deve permanecer null e não entra em agregações.
*   `NOT_AVAILABLE` — treino não realizado ou feedback não iniciado.
*   `INVALID` — payload inválido; registro isolado dos cálculos agregados.

---

## 3. ÁREA PÚBLICA

### Rotas obrigatórias:
- `/`
- `/sobre`
- `/cadastro`
- `/precos`
- `/treinadores`
- `/atletas`
- `/marketplace`
- `/marketplace/[slug]`
- `/checkout`
- `/checkout/pendente`
- `/checkout/sucesso`
- `/checkout/falha`
- `/login`
- `/recuperar-senha`
- `/redefinir-senha`
- `/verificar-email`
- `/verificar-email/reenviar`
- `/onboarding/treinador`
- `/onboarding/atleta`
- `/convite/ativar`
- `/convite/expirado`
- `/termos-de-uso`
- `/politica-privacidade`

### Diretrizes principais:
- Home orientada à conversão e ao princípio central da ENKY;
- Página sobre com foco comercial e filosófico;
- Cadastro com escolha entre treinador e atleta;
- Páginas de preços e marketplace com dados reais;
- Checkout tokenizado;
- Página de sucesso consulta o backend e nunca confirma pagamento por parâmetros do frontend;
- Página de falha usa mensagens traduzidas e seguras;
- Recuperação de senha evita enumeração de usuários;
- Onboarding complementa perfis existentes;
- Atleta convidado ativa `User` vinculado ao `AthleteProfile` já existente;
- Termos e privacidade devem ser acessíveis publicamente.

---

## 4. ÁREA DO TREINADOR

### Rotas obrigatórias:
- `/treinador/dashboard`
- `/treinador/atletas`
- `/treinador/atletas/[id]`
- `/treinador/calendario`
- `/treinador/periodizacao`
- `/treinador/periodizacao/criar`
- `/treinador/periodizacao/[id]/editar`
- `/treinador/periodizacao/[id]/gerar-treinos`
- `/treinador/periodizacao/[id]/revisar-geracao`
- `/treinador/periodizacao/[id]/regenerar`
- `/treinador/feedbacks`
- `/treinador/analises`
- `/treinador/relatorios`
- `/treinador/biblioteca`
- `/treinador/marketplace/planos`
- `/treinador/marketplace/planos/criar`
- `/treinador/marketplace/planos/[id]/editar`
- `/treinador/marketplace/vendas`
- `/treinador/marketplace/vendas/[id]`
- `/treinador/financeiro`
- `/treinador/configuracoes`

### Dashboard:
- Responder o que o treinador precisa fazer agora;
- Alertas dinâmicos da **ENKY Intelligence**;
- Treinos do dia, feedbacks pendentes, atletas sem prescrição, dados insuficientes;
- Busca global com atalhos para perfil, calendário, prescrição e alertas.

### Perfil do atleta:
- Visão geral, histórico de prescrição, avaliações e monitoramento de sintomas, insights e recomendações;
- `TestResult` extensível com `testType`, `resultValue`, `unit`, `protocol`, `calculatedMetrics` e `date`.

### Calendário:
- Coração operacional da prescrição;
- Visualização semanal e mensal;
- Drag and drop com `Workout` como fonte temporal principal;
- `CalendarEvent` para eventos não classificados como treino;
- Movimentação de `DRAFT` gera histórico operacional;
- Alteração de `PUBLISHED` exige confirmação e `AuditLog`;
- Atleta não pode mover treino.

### Periodização:
- Coração estratégico;
- Timeline estável no MVP;
- Criação e edição por formulário;
- Drag and drop de limites de fase apenas pós-MVP.

---

## 5. GERAÇÃO AUTOMÁTICA ASSISTIDA DE TREINOS

A `PeriodizationGenerationEngine` é o serviço de domínio responsável por converter a estratégia da periodização em proposta operacional de treinos.

> **A periodização define a estratégia.**  
> **O calendário recebe a execução.**  
> **A ENKY sugere.**  
> **O treinador valida, edita e publica.**

*Regra central:* **Nenhum treino gerado nasce publicado.**

### 5.1 Camadas do motor

*   **Camada determinística rule-based:** Datas e distribuição temporal, janelas de descanso, eventos e provas, avaliações, volume e intensidade, restrições, conflitos e estrutura base do microciclo.
*   **Camada assistida generativa:** Descrição e instruções, sugestões complementares, rationale em linguagem natural e organização textual.

*Regra:* A camada generativa nunca pode alterar silenciosamente os targets estruturais definidos pela camada determinística.

### 5.2 Reprodutibilidade

Com o mesmo `generationContextSnapshot` e `algorithmVersion`, a camada determinística deve gerar a mesma estrutura, datas, volume e intensidade. A camada textual pode variar no estilo, mas deve manter os mesmos dados objetivos.

### 5.3 Versionamento

- `algorithmVersion` — versão do algoritmo e regras do motor.
- `generationVersion` — número incremental de tentativas de geração daquele planejamento.
- `generationRationaleVersion` — versão do schema da justificativa.
- `generationBatchId` — UUID comum a todos os treinos criados no mesmo lote.

### 5.4 generationContextSnapshot

O snapshot deve armazenar, no mínimo:
- `athleteProfile`;
- `modalityToken`;
- `mainObjectives`;
- `weeklyAvailability`;
- `testResultSnapshots`;
- `derivedMetricSnapshots`;
- `periodizationParameters`;
- `algorithmVersion`;
- restrições relevantes;
- conflitos identificados;
- timestamp da captura.

### 5.5 Rotas de geração

*   `/treinador/periodizacao/[id]/gerar-treinos` — Resumo da periodização, seleção de escopo, dias disponíveis, duração máxima, sessões-chave, semanas regenerativas, conflitos, dados insuficientes, confiança, botão Gerar Rascunhos.
*   `/treinador/periodizacao/[id]/revisar-geracao` — Lista dos treinos sugeridos, aceitar, editar, excluir, trocar dia, alterar volume e intensidade, trocar exercícios, substituir por template, regenerar, abrir no calendário.
*   `/treinador/periodizacao/[id]/regenerar` — Regeneração por semana, microciclo ou ciclo; preservação obrigatória de publicados, executados, feedbacks e treinos modificados; opção de substituir apenas rascunhos não editados; opção de criar nova versão; cancelamento seguro.

### 5.6 Ancoragem de treinos modificados

Treinos alterados pelo treinador atuam como âncoras. Na regeneração do microciclo:
- não podem ser sobrescritos;
- volume e intensidade restantes podem ser redistribuídos entre os demais dias;
- conflitos precisam ser explicitados.

### 5.7 Campos obrigatórios dos treinos gerados

- `athleteId`, `trainerId`, `periodizationId`, `periodizationPhaseId`, `trainingWeekId`, `generationBatchId`;
- `modality`, `plannedDate`;
- `status` = `DRAFT`;
- `source` = `PERIODIZATION_GENERATED`;
- `generationMode`, `generationVersion`, `algorithmVersion`, `generationRationaleVersion`, `generatedAt`, `generationContextSnapshot`, `confidenceLevel`, `generationRationale`.

*Rastreabilidade humana:* `trainerModified`, `trainerModifiedAt`, `trainerModifiedBy`, `modifiedFields`.

### 5.8 Explicabilidade

A justificativa deve conter:
- telemetria objetiva;
- regras determinísticas utilizadas;
- dados considerados;
- dados ausentes;
- confiança;
- síntese textual assistida;
- ponto recomendado para revisão humana.

O texto gerado não pode contradizer a telemetria estruturada.

### 5.9 Publicação em lote

Escopos permitidos:
- sessão individual;
- microciclo semanal;
- `generationBatchId`.

Toda publicação exige validação de permissão e gera notificação ao atleta.

---

## 6. PRESCRIÇÃO MANUAL

O flyout do calendário é o formulário único de prescrição manual.

*Corrida:* distância, duração, pace, zona de FC, tipo de treino, blocos, repetições, intensidade, recuperação.

*Musculação e funcional:* `Exercise`, séries, repetições ou tempo, carga, percentual de 1RM, RIR, RPE alvo, intervalo, vídeo, reordenação de blocos.

---

## 7. FEEDBACK DO ATLETA E CARGA DA SESSÃO

Na rota `/atleta/treinos/[id]`, o atleta informa:
- status de conclusão;
- `actualDurationMinutes`;
- distância real quando aplicável;
- `sessionRpe`, fadiga, recuperação, dor (localização, intensidade), observações.

*`actualDurationMinutes`:*
- inteiro positivo em minutos completos;
- validado no backend;
- o cliente pode arredondar para exibição, mas o backend é a autoridade final.

**Fórmula oficial:**
$$\text{sessionRpeLoad} = \text{actualDurationMinutes} \times \text{sessionRpe}$$
*Unidade:* unidades arbitrárias — UA.

**Regras:**
- calcular somente quando duração real e RPE forem válidos;
- `PARTIAL`, `NOT_AVAILABLE` e `INVALID` mantêm `sessionRpeLoad` = null;
- somente `COMPLETE` entra em agregações de carga;
- duração planejada nunca substitui silenciosamente a duração real.

---

## 8. ÁREA DO ATLETA

**Rotas:** `/atleta/dashboard`, `/atleta/calendario`, `/atleta/treinos/[id]`, `/atleta/evolucao`, `/atleta/relatorios`, `/atleta/planos`, `/atleta/perfil`

*Diretrizes:* mobile-first, treino do dia em destaque, leitura de prescrições, envio de feedback, nenhum drag and drop, nenhum controle de edição da prescrição, evolução sem scores alarmistas, acesso apenas aos próprios dados.

---

## 9. ÁREA ADMINISTRATIVA

**Rotas:** `/admin/dashboard`, `/admin/usuarios`, `/admin/treinadores`, `/admin/atletas`, `/admin/marketplace`, `/admin/planos`, `/admin/pagamentos`, `/admin/assinaturas`, `/admin/configuracoes`, `/admin/logs`

*Diretrizes:* acesso mínimo necessário, dados sensíveis ocultados a admins comuns (exige justificativa e `AuditLog`), feature flags críticas restritas a `SUPERADMIN`, segredos mascarados nos logs e nunca salvos em `SystemSetting` comum.

---

## 10. ENDPOINT DE PAGAMENTO

`/api/webhooks/payment-provider`

**Responsabilidades:** validar assinatura/segredo, aplicar idempotência, atualizar `PaymentTransaction` e `MarketplacePurchase`, liberar acesso somente após confirmação e gerar log financeiro em mudança real de estado. Nunca confiar no frontend.

---

## 11. PIPELINE DE CONVITE DE ATLETA

1.  Treinador cria `AthleteProfile`.
2.  Sistema cria `CoachAthleteRelationship`.
3.  Sistema gera token único e expirável, e envia o convite.
4.  Atleta acessa `/convite/ativar` e o backend valida o token.
5.  `User` é criado e vinculado ao `AthleteProfile` preexistente.
6.  Onboarding complementa os campos sem duplicar o perfil.

---

## 12. MODAL GLOBAL DE CONFIRMAÇÃO

Nenhuma chamada de mutação deve ser iniciada antes da confirmação do usuário.

**Fluxo:**
1.  Usuário solicita ação → Modal abre.
2.  Cancelar preserva o estado (nenhuma mutação enviada).
3.  Confirmar envia a requisição.
4.  Backend valida permissão e regra de negócio.
5.  Transação atômica é executada e `AuditLog` é registrado.

**Texto padrão:**
> **ATENÇÃO: AÇÃO CRÍTICA EXIGE CONFIRMAÇÃO**  
> Você está prestes a executar uma alteração sensível que pode impactar dados reais ou a experiência do atleta.  
> *Detalhe da operação:* [descrição dinâmica]  
> Tem certeza de que deseja prosseguir?  
> `[Cancelar operação]` `[Confirmar e salvar]`

---

## 13. MATRIZ DE CONFORMIDADE RESUMIDA

*   **Público:** acesso `VISITANTE`, sem mutações sensíveis, marketplace filtra apenas `PUBLISHED`.
*   **Treinador:** acesso `TRAINER`, apenas atletas vinculados, alterações em publicados exigem confirmação/log, geração cria `DRAFT`, regeneração preserva dados consolidados.
*   **Atleta:** acesso `ATHLETE`, apenas dados próprios, sem edição de prescrição, feedback obrigatoriamente vinculado ao `Workout` correto.
*   **Admin:** acesso `ADMIN` ou `SUPERADMIN` auditável, restrição de acesso a dados de saúde por privilégio mínimo.

---

## 14. HIERARQUIA DOCUMENTAL

1.  **ENKY 00 — Constitution**
2.  **ENKY OS — Product & Engineering Specification v1.0**
3.  **ENKY OS — Interface Architecture & Screen Specifications v1.4 — Approved for Implementation**
4.  Documentos técnicos específicos
5.  **ENKY 24 — Prompt Master para Claude/Codex**

---

## 15. DECLARAÇÃO FINAL

A v1.4 está aprovada para implementação e deve ser mantida como versão oficial de interface. Detalhes de banco, APIs e testes são tratados nos documentos satélites.

> **A periodização é o coração estratégico.**  
> **O calendário é o coração operacional.**  
> **A geração assistida é a ponte entre estratégia e execução.**  
> **A ENKY sugere.**  
> **O treinador decide.**
