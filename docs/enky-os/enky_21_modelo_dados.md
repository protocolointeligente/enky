# ENKY 21 - MODELO DE DADOS E ENTIDADES
**Versão 1.0** — Entidades, relacionamentos, persistência e expansão

---

## Princípio

> Todo dado precisa ter dono, contexto, finalidade e rastreabilidade.

---

## Entidades Principais (35+)

### Core
- **User** — id, name, email, role (SUPERADMIN/ADMIN/TRAINER/ATHLETE), status, timestamps
- **Organization** — assessorias, equipes, studios (ownerUserId, type, status)
- **Membership** — User↔Organization com papel interno (owner/manager/coach/assistant/athlete/viewer)
- **TrainerProfile** — dados profissionais, especialidades, marketplace
- **AthleteProfile** — dados esportivos (pode existir antes do User ativo)
- **CoachAthleteRelationship** — vínculo com status (active/invited/pending/paused/ended)
- **AthleteGroup** — agrupamento para prescrição em grupo

### Treinamento
- **Periodization** → PeriodizationPhase → TrainingWeek
- **Workout** — sessão prescrita (athleteId, trainerId, modality, status, source, isPublished)
- **WorkoutBlock** — blocos internos (aquecimento, principal, volta calma, séries)
- **Exercise** — biblioteca (nome, grupo muscular, padrão motor, equipamento, mídia)
- **WorkoutExercise** — exercício vinculado a treino com parâmetros (sets, reps, load, RPE/RIR)
- **WorkoutTemplate** — modelos reutilizáveis
- **CalendarEvent** — representação temporal (workout/competition/test/rest/unavailable)

### Feedback & Métricas
- **WorkoutFeedback** — resposta do atleta (completedStatus, RPE, pain, readiness, notes)
- **MetricRecord** — métricas brutas flexíveis (metricKey, value, unit, sourceType)
- **DerivedMetric** — métricas calculadas (adherence, session-RPE, readiness, data quality)
- **Assessment** — avaliações por tipo (JSON estruturado por tipo no MVP)
- **TestResult** — testes de performance (Cooper, FTP, 1RM, ritmo/100m)

### Intelligence
- **AthleteInsight** — insights gerados (type, severity, confidence, status)
- **AIRecommendation** — recomendações com log completo (input, output, accepted/edited/ignored)

### Relatórios & Comunicação
- **Report** — relatórios gerados (type, metrics, insights, sharedWithAthlete)
- **Notification** — notificações por tipo e prioridade
- **Message/Comment** — comunicação contextual

### Marketplace & Pagamentos
- **MarketplacePlan** — plano vendável (status: draft/pending/published/rejected/archived)
- **MarketplacePurchase** — compra vinculada a buyer, athlete, plan, payment
- **SubscriptionPlan** — planos SaaS com limites
- **Subscription** — assinatura ativa (status: trialing/active/past_due/cancelled)
- **PaymentTransaction** — pagamentos (type: subscription/marketplace/refund/commission)

### Sistema
- **AuditLog** — ações sensíveis (actor, action, entity, before/after)
- **SystemSetting** — configurações globais
- **FileAttachment** — mídia e anexos
- **ProductEvent** — eventos analíticos de uso

---

## Relacionamentos Chave

```
User → TrainerProfile / AthleteProfile
TrainerProfile ←→ AthleteProfile (via CoachAthleteRelationship)
Workout → Athlete + Trainer + Periodization? + Calendar
Workout → WorkoutBlocks + WorkoutExercises
WorkoutFeedback → Workout
MetricRecord → Workout / Feedback / Assessment
MarketplacePlan → Trainer
MarketplacePurchase → Buyer + Plan + Payment
```

---

## MVP do Modelo

User, TrainerProfile, AthleteProfile, CoachAthleteRelationship, Workout, WorkoutBlock, WorkoutFeedback, CalendarEvent, Assessment, MetricRecord, Report, MarketplacePlan, MarketplacePurchase, PaymentTransaction, Subscription, Notification, AuditLog, AIRecommendation

---

## Regras

- Soft delete (archivedAt/deletedAt) em vez de exclusão definitiva
- JSON para flexibilidade (avaliações, metadata), relacional para dados centrais
- Índices em: email, role, trainerId, athleteId, plannedDate, status, metricKey
- Preparar multitenancy (organizationId)
- Preparar expansão multiesporte (modality + metadata + WorkoutBlock)
