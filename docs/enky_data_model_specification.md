# ENKY OS — DATA MODEL SPECIFICATION v1.2.1
**Approved for Implementation — Fonte Única de Verdade para o Banco de Dados, Relacionamentos e Restrições de Persistência**

Este documento estabelece a modelagem física e lógica final do banco de dados da plataforma ENKY, configurada estritamente para PostgreSQL utilizando Prisma ORM. Consolida isolamento multi-tenant por organização, integridade referencial, concorrência otimista, imutabilidade comercial, precisão fisiológica e políticas seguras de migração.

---

## 1. DICIONÁRIO DE ENUMS DE CONTROLE

```prisma
enum Role {
  SUPERADMIN
  ADMIN
  TRAINER
  ATHLETE
}

enum OrganizationRole {
  OWNER
  COACH
  ADMIN
  SUPPORT
}

enum WorkoutStatus {
  DRAFT
  PUBLISHED
  IN_PROGRESS // Reservado para pós-MVP
  COMPLETED
  PARTIAL
  MISSED
  ARCHIVED
  CANCELLED
}

enum WorkoutCompletionSource {
  ATHLETE_REPORTED
  SYSTEM_EXPIRED
  TRAINER_MARKED
}

enum SessionRpeLoadStatus {
  COMPLETE
  PARTIAL
  NOT_AVAILABLE
  INVALID
}

enum MarketplaceStatus {
  DRAFT
  PENDING_REVIEW
  PUBLISHED
  REJECTED
  ARCHIVED
}

enum MarketplacePurchaseStatus {
  PENDING
  ACTIVE
  EXPIRED
  CANCELLED
  REFUNDED
}

enum PaymentStatus {
  PENDING
  PAID
  FAILED
  REFUNDED
  CANCELLED
  DISPUTED
  EXPIRED
}

enum SubscriptionStatus {
  INCOMPLETE
  TRIALING
  ACTIVE
  PAST_DUE
  UNPAID
  PAUSED
  CANCELLED
  EXPIRED
}

enum GenerationMode {
  AUTOMATIC
  ASSISTED
}

enum GenerationBatchStatus {
  PENDING
  PROCESSING
  COMPLETED
  FAILED
}

enum GenerationScope {
  FULL_CYCLE
  MESOCYCLE
  MICROCYCLE
  SINGLE_WEEK
}

enum CalendarEventType {
  PROVA
  VIAGEM
  EXAME
  INDISPONIBILIDADE
}

enum WorkoutStepType {
  TIRO
  RODAGEM
  PAUSA_ATIVA
  PAUSA_PASSIVA
  PROGRESSIVO
  SUBIDA
}

enum IntensityTargetType {
  PACE
  HEART_RATE_ZONE
  POWER
  CADENCE
  RPE
}

enum AuditActorType {
  USER
  SYSTEM
  CRON
  SUPPORT_AGENT
}

enum BillingCycle {
  MENSAL
  ANUAL
}

enum Modality {
  RUNNING
  STRENGTH
  FUNCTIONAL
  CYCLING
  SWIMMING
  TRIATHLON
}

enum ReportStatus {
  DRAFT
  PUBLISHED
  REVOKED
  ARCHIVED
}

enum WorkoutSource {
  MANUAL
  PERIODIZATION_GENERATED
  TEMPLATE
  MARKETPLACE
  IMPORTED
}

enum ConfidenceLevel {
  LOW
  MODERATE
  HIGH
  NOT_ASSESSED
}

enum DerivedMetricStatus {
  PENDING
  CONSOLIDATED
  STALE
  INSUFFICIENT_DATA
  INVALID
}
```

---

## 2. ARQUITETURA MULTI-TENANT NATIVA E CONTROLE DE IDENTIDADE

```prisma
model User {
  id                         String                   @id @default(uuid())
  email                      String                   @unique
  passwordHash               String?
  name                       String
  globalRole                 Role                     @default(ATHLETE)
  isActive                   Boolean                  @default(true)
  createdAt                  DateTime                 @default(now()) @db.Timestamptz
  updatedAt                  DateTime                 @updatedAt @db.Timestamptz
  lockVersion                Int                      @default(1)

  trainerProfile             TrainerProfile?
  athleteProfile             AthleteProfile?
  memberships                OrganizationMembership[]
  requestedGenerationBatches GenerationBatch[]        @relation("GenerationRequestedBy")
  auditLogs                  AuditLog[]

  @@index([email])
}

model Organization {
  id                   String                     @id @default(uuid())
  name                 String
  slug                 String                     @unique
  timezone             String                     @default("America/Sao_Paulo")
  isActive             Boolean                    @default(true)
  createdAt            DateTime                   @default(now()) @db.Timestamptz
  updatedAt            DateTime                   @updatedAt @db.Timestamptz
  lockVersion          Int                        @default(1)

  memberships          OrganizationMembership[]
  subscriptions        Subscription[]
  invitations          AthleteInvitation[]
  relationships        CoachAthleteRelationship[]
  periodizations       Periodization[]
  workouts             Workout[]
  calendarEvents       CalendarEvent[]
  generationBatches    GenerationBatch[]
  marketplacePlans     MarketplacePlan[]
  marketplacePurchases MarketplacePurchase[]
  reports              Report[]
  exercises            Exercise[]
  testResults          TestResult[]
  derivedMetrics       DerivedMetric[]
  auditLogs            AuditLog[]
}

model OrganizationMembership {
  id             String           @id @default(uuid())
  userId         String
  organizationId String
  role           OrganizationRole @default(COACH)
  createdAt      DateTime         @default(now()) @db.Timestamptz
  updatedAt      DateTime         @updatedAt @db.Timestamptz

  user           User             @relation(fields: [userId], references: [id], onDelete: Restrict)
  organization   Organization     @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@unique([userId, organizationId])
  @@index([organizationId])
}

model TrainerProfile {
  id                String                     @id @default(uuid())
  userId            String                     @unique
  crefCode          String?
  companyName       String?
  createdAt         DateTime                   @default(now()) @db.Timestamptz
  updatedAt         DateTime                   @updatedAt @db.Timestamptz
  lockVersion       Int                        @default(1)

  user              User                       @relation(fields: [userId], references: [id], onDelete: Restrict)
  relationships     CoachAthleteRelationship[]
  workouts          Workout[]
  periodizations    Periodization[]
  calendarEvents    CalendarEvent[]
  generationBatches GenerationBatch[]
  marketplacePlans  MarketplacePlan[]
  invitations       AthleteInvitation[]
  testResults       TestResult[]
  reports           Report[]
}

model AthleteProfile {
  id                String                     @id @default(uuid())
  userId            String?                    @unique
  birthDate         DateTime?                  @db.Date
  gender            String?
  weightKg          Decimal?                   @db.Decimal(5, 2)
  heightCm          Decimal?                   @db.Decimal(5, 2)
  createdAt         DateTime                   @default(now()) @db.Timestamptz
  updatedAt         DateTime                   @updatedAt @db.Timestamptz
  lockVersion       Int                        @default(1)

  user              User?                      @relation(fields: [userId], references: [id], onDelete: Restrict)
  relationships     CoachAthleteRelationship[]
  periodizations    Periodization[]
  workouts          Workout[]
  calendarEvents    CalendarEvent[]
  generationBatches GenerationBatch[]
  testResults       TestResult[]
  derivedMetrics    DerivedMetric[]
  reports           Report[]
  purchases         MarketplacePurchase[]
  invitations       AthleteInvitation[]
}

model CoachAthleteRelationship {
  id                String         @id @default(uuid())
  organizationId    String
  trainerId         String
  athleteId         String
  isActive          Boolean        @default(true)
  startedAt         DateTime       @default(now()) @db.Timestamptz
  endedAt           DateTime?      @db.Timestamptz
  terminationReason String?
  createdAt         DateTime       @default(now()) @db.Timestamptz
  updatedAt         DateTime       @updatedAt @db.Timestamptz

  organization      Organization   @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  trainer           TrainerProfile @relation(fields: [trainerId], references: [id], onDelete: Restrict)
  athlete           AthleteProfile @relation(fields: [athleteId], references: [id], onDelete: Restrict)

  @@unique([organizationId, trainerId, athleteId])
  @@index([organizationId, athleteId])
}

model AthleteInvitation {
  id             String         @id @default(uuid())
  organizationId String
  trainerId      String
  athleteId      String
  email          String
  tokenHash      String         @unique
  expiresAt      DateTime       @db.Timestamptz
  isConsumed     Boolean        @default(false)
  consumedAt     DateTime?      @db.Timestamptz
  isRevoked      Boolean        @default(false)
  revokedAt      DateTime?      @db.Timestamptz
  resentCount    Int            @default(0)
  lastSentAt     DateTime?      @db.Timestamptz
  createdAt      DateTime       @default(now()) @db.Timestamptz
  updatedAt      DateTime       @updatedAt @db.Timestamptz

  organization   Organization   @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  trainer        TrainerProfile @relation(fields: [trainerId], references: [id], onDelete: Restrict)
  athlete        AthleteProfile @relation(fields: [athleteId], references: [id], onDelete: Cascade)

  @@index([tokenHash])
}
```

---

## 3. CORE ESTRATÉGICO: PERIODIZAÇÃO E MICROCICLOS

```prisma
model Periodization {
  id                String               @id @default(uuid())
  organizationId    String
  athleteId         String
  trainerId         String
  title             String
  goal              String
  startDate         DateTime             @db.Date
  endDate           DateTime             @db.Date
  createdAt         DateTime             @default(now()) @db.Timestamptz
  updatedAt         DateTime             @updatedAt @db.Timestamptz
  lockVersion       Int                  @default(1)

  organization      Organization         @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  athlete           AthleteProfile       @relation(fields: [athleteId], references: [id], onDelete: Restrict)
  trainer           TrainerProfile       @relation(fields: [trainerId], references: [id], onDelete: Restrict)
  phases            PeriodizationPhase[]
  weeks             TrainingWeek[]
  workouts          Workout[]
  generationBatches GenerationBatch[]

  @@index([organizationId, athleteId])
  @@index([trainerId])
}

model PeriodizationPhase {
  id               String         @id @default(uuid())
  periodizationId  String
  name             String
  startDate        DateTime       @db.Date
  endDate          DateTime       @db.Date
  targetVolumeKm   Decimal?       @db.Decimal(10, 2)
  targetIntensity  String?
  sequence         Int
  createdAt        DateTime       @default(now()) @db.Timestamptz
  updatedAt        DateTime       @updatedAt @db.Timestamptz
  lockVersion      Int            @default(1)

  periodization    Periodization  @relation(fields: [periodizationId], references: [id], onDelete: Cascade)
  weeks            TrainingWeek[]
  workouts         Workout[]

  @@unique([periodizationId, sequence])
  @@index([periodizationId, startDate])
}

model TrainingWeek {
  id               String              @id @default(uuid())
  periodizationId  String
  phaseId          String?
  sequence         Int
  startDate        DateTime            @db.Date
  endDate          DateTime            @db.Date
  focus            String?
  targetVolume     Decimal?            @db.Decimal(10, 2)
  targetIntensity  String?
  isRecoveryWeek   Boolean             @default(false)
  createdAt        DateTime            @default(now()) @db.Timestamptz
  updatedAt        DateTime            @updatedAt @db.Timestamptz
  lockVersion      Int                 @default(1)

  periodization    Periodization       @relation(fields: [periodizationId], references: [id], onDelete: Cascade)
  phase            PeriodizationPhase? @relation(fields: [phaseId], references: [id], onDelete: SetNull)
  workouts         Workout[]

  @@unique([periodizationId, sequence])
  @@index([periodizationId, startDate])
}
```

---

## 4. PIPELINE DE AUTOMAÇÃO EM LOTE

```prisma
model GenerationBatch {
  id                         String                @id @default(uuid())
  organizationId             String
  periodizationId            String
  athleteId                  String
  trainerId                  String
  requestedByUserId          String
  generationMode             GenerationMode
  generationVersion          Int
  algorithmVersion           String
  generationRationaleVersion String?
  contextSnapshot            Json
  scope                      GenerationScope
  status                     GenerationBatchStatus @default(PENDING)
  startedAt                  DateTime?             @db.Timestamptz
  completedAt                DateTime?             @db.Timestamptz
  failedAt                   DateTime?             @db.Timestamptz
  failureCode                String?
  createdAt                  DateTime              @default(now()) @db.Timestamptz
  updatedAt                  DateTime              @updatedAt @db.Timestamptz

  organization               Organization          @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  periodization              Periodization         @relation(fields: [periodizationId], references: [id], onDelete: Cascade)
  athlete                    AthleteProfile        @relation(fields: [athleteId], references: [id], onDelete: Restrict)
  trainer                    TrainerProfile        @relation(fields: [trainerId], references: [id], onDelete: Restrict)
  requestedByUser            User                  @relation("GenerationRequestedBy", fields: [requestedByUserId], references: [id], onDelete: Restrict)
  workouts                   Workout[]

  @@index([organizationId])
  @@index([periodizationId])
  @@index([athleteId, createdAt])
  @@index([trainerId, createdAt])
  @@index([status])
}
```

---

## 5. CORE OPERACIONAL: CALENDÁRIO, PRESCRIÇÃO E SESSÕES MULTIESPORTE

> [!IMPORTANT]
> **Diretriz temporal:**
> - `plannedDate` representa data civil no fuso do atleta.
> - `plannedStartAt` e `plannedEndAt` representam instantes UTC.
> - `plannedDate` nunca deve ser convertido utilizando o fuso físico do servidor.

```prisma
model Workout {
  id                         String              @id @default(uuid())
  organizationId             String
  athleteId                  String
  trainerId                  String
  periodizationId            String?
  periodizationPhaseId       String?
  trainingWeekId             String?
  generationBatchId          String?
  marketplacePurchaseId      String?
  title                      String
  description                String?
  modality                   Modality
  status                     WorkoutStatus       @default(DRAFT)
  source                     WorkoutSource       @default(MANUAL)
  plannedDate                DateTime            @db.Date
  plannedStartAt             DateTime?           @db.Timestamptz
  plannedEndAt               DateTime?           @db.Timestamptz
  timezone                   String              @default("America/Sao_Paulo")
  generationMode             GenerationMode?
  generationVersion          Int?
  algorithmVersion           String?
  generationRationaleVersion String?
  confidenceLevel            ConfidenceLevel?    @default(NOT_ASSESSED)
  generationRationale        Json?
  trainerModified            Boolean             @default(false)
  trainerModifiedAt          DateTime?           @db.Timestamptz
  trainerModifiedBy          String?
  modifiedFields             String[]            @default([])
  createdAt                  DateTime            @default(now()) @db.Timestamptz
  updatedAt                  DateTime            @updatedAt @db.Timestamptz
  lockVersion                Int                 @default(1)

  organization               Organization        @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  athlete                    AthleteProfile      @relation(fields: [athleteId], references: [id], onDelete: Restrict)
  trainer                    TrainerProfile      @relation(fields: [trainerId], references: [id], onDelete: Restrict)
  periodization              Periodization?      @relation(fields: [periodizationId], references: [id], onDelete: Restrict)
  phase                      PeriodizationPhase? @relation(fields: [periodizationPhaseId], references: [id], onDelete: Restrict)
  trainingWeek               TrainingWeek?       @relation(fields: [trainingWeekId], references: [id], onDelete: SetNull)
  generationBatch            GenerationBatch?    @relation(fields: [generationBatchId], references: [id], onDelete: SetNull)
  marketplacePurchase        MarketplacePurchase? @relation(fields: [marketplacePurchaseId], references: [id], onDelete: SetNull)
  blocks                     WorkoutBlock[]
  feedback                   WorkoutFeedback?

  @@index([organizationId, athleteId, plannedDate])
  @@index([trainerId])
  @@index([generationBatchId])
}

model WorkoutBlock {
  id          String            @id @default(uuid())
  workoutId   String
  sequence    Int               @default(1)
  name        String?
  repetitions Int               @default(1)
  createdAt   DateTime          @default(now()) @db.Timestamptz
  updatedAt   DateTime          @updatedAt @db.Timestamptz
  workout     Workout           @relation(fields: [workoutId], references: [id], onDelete: Cascade)
  exercises   WorkoutExercise[]
  steps       WorkoutStep[]

  @@unique([workoutId, sequence])
}

model WorkoutExercise {
  id              String       @id @default(uuid())
  workoutBlockId  String
  exerciseId      String
  sequence        Int          @default(1)
  sets            Int
  reps            Int?
  durationSeconds Int?
  loadKg          Decimal?     @db.Decimal(6, 2)
  rir             Int?
  rpeTarget       Float?
  restSeconds     Int?
  notes           String?
  createdAt       DateTime     @default(now()) @db.Timestamptz
  updatedAt       DateTime     @updatedAt @db.Timestamptz
  block           WorkoutBlock @relation(fields: [workoutBlockId], references: [id], onDelete: Cascade)
  exercise        Exercise     @relation(fields: [exerciseId], references: [id], onDelete: Restrict)

  @@unique([workoutBlockId, sequence])
}

model WorkoutStep {
  id              String              @id @default(uuid())
  workoutBlockId  String
  sequence        Int
  stepType        WorkoutStepType
  repetitions     Int?
  durationSeconds Int?
  distanceMeters  Int?
  targetType      IntensityTargetType?
  targetMin       Decimal?            @db.Decimal(10, 2)
  targetMax       Decimal?            @db.Decimal(10, 2)
  recoverySeconds Int?
  recoveryMeters  Int?
  metadata        Json?
  createdAt       DateTime            @default(now()) @db.Timestamptz
  updatedAt       DateTime            @updatedAt @db.Timestamptz
  block           WorkoutBlock        @relation(fields: [workoutBlockId], references: [id], onDelete: Cascade)

  @@unique([workoutBlockId, sequence])
}

model Exercise {
  id               String            @id @default(uuid())
  organizationId   String?
  name             String
  category         String
  targetMuscles    String[]
  videoUrl         String?
  isActive         Boolean           @default(true)
  createdAt        DateTime          @default(now()) @db.Timestamptz
  updatedAt        DateTime          @updatedAt @db.Timestamptz
  archivedAt       DateTime?         @db.Timestamptz
  organization     Organization?     @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  workoutExercises WorkoutExercise[]

  @@unique([name, organizationId])
}

model CalendarEvent {
  id             String            @id @default(uuid())
  organizationId String
  athleteId      String
  trainerId      String?
  eventType      CalendarEventType
  title          String
  description    String?
  startAt        DateTime          @db.Timestamptz
  endAt          DateTime          @db.Timestamptz
  timezone       String            @default("America/Sao_Paulo")
  createdAt      DateTime          @default(now()) @db.Timestamptz
  updatedAt      DateTime          @updatedAt @db.Timestamptz
  lockVersion    Int               @default(1)
  organization   Organization      @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  athlete        AthleteProfile    @relation(fields: [athleteId], references: [id], onDelete: Restrict)
  trainer        TrainerProfile?   @relation(fields: [trainerId], references: [id], onDelete: SetNull)

  @@index([organizationId, athleteId, startAt])
}
```

---

## 6. SINTOMAS E EQUAÇÃO DE CARGA SUBJETIVA REALIZADA

O frontend nunca calcula nem envia `sessionRpeLoad`. O backend calcula o valor na mesma transação e ignora qualquer valor enviado pelo cliente.

**Fórmula obrigatória:**
$$\text{sessionRpeLoad} = \text{actualDurationMinutes} \times \text{sessionRpe}$$

O resultado é armazenado em unidades arbitrárias (UA), com precisão de duas casas decimais. Se uma das variáveis estiver ausente, `sessionRpeLoad` permanece null. Zero não representa dado ausente.

```prisma
model WorkoutFeedback {
  id                    String                  @id @default(uuid())
  workoutId             String                  @unique
  actualDurationMinutes Int?
  actualDistanceKm      Decimal?                @db.Decimal(10, 3)
  sessionRpe            Float?
  sessionRpeLoad        Decimal?                @db.Decimal(10, 2)
  loadStatus            SessionRpeLoadStatus    @default(NOT_AVAILABLE)
  completionSource      WorkoutCompletionSource?
  fatigueLevel          Int?
  recoveryLevel         Int?
  painLevel             Int?                    @default(0)
  painLaterality        String?
  painRegion            String?
  notes                 String?
  createdAt             DateTime                @default(now()) @db.Timestamptz
  updatedAt             DateTime                @updatedAt @db.Timestamptz
  workout               Workout                 @relation(fields: [workoutId], references: [id], onDelete: Cascade)
}
```

---

## 7. INTELIGÊNCIA ESPORTIVA, TESTES E RELATÓRIOS

```prisma
model TestResult {
  id                String          @id @default(uuid())
  organizationId    String
  athleteId         String
  trainerId         String
  testType          String
  resultValue       Decimal         @db.Decimal(12, 4)
  unit              String
  protocol          String?
  calculatedMetrics Json?
  performedAt       DateTime        @db.Timestamptz
  createdAt         DateTime        @default(now()) @db.Timestamptz
  updatedAt         DateTime        @updatedAt @db.Timestamptz
  lockVersion       Int             @default(1)
  organization      Organization    @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  athlete           AthleteProfile  @relation(fields: [athleteId], references: [id], onDelete: Restrict)
  trainer           TrainerProfile  @relation(fields: [trainerId], references: [id], onDelete: Restrict)

  @@index([organizationId, athleteId, performedAt])
}

model DerivedMetric {
  id             String              @id @default(uuid())
  organizationId String
  athleteId      String
  metricKey      String
  metricValue    Decimal             @db.Decimal(12, 4)
  periodStart    DateTime            @db.Date
  periodEnd      DateTime            @db.Date
  formulaVersion String              @default("1.0.0")
  status         DerivedMetricStatus @default(PENDING)
  createdAt      DateTime            @default(now()) @db.Timestamptz
  updatedAt      DateTime            @updatedAt @db.Timestamptz
  organization   Organization        @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  athlete        AthleteProfile      @relation(fields: [athleteId], references: [id], onDelete: Cascade)

  @@unique([organizationId, athleteId, metricKey, periodStart, periodEnd])
}

model Report {
  id              String         @id @default(uuid())
  organizationId  String
  athleteId       String
  trainerId       String
  status          ReportStatus   @default(DRAFT)
  periodStart     DateTime       @db.Date
  periodEnd       DateTime       @db.Date
  metricsSnapshot Json
  insights        String?
  recommendations String?
  limitations     String?
  content         String?
  sharedAt        DateTime?      @db.Timestamptz
  createdAt       DateTime       @default(now()) @db.Timestamptz
  updatedAt       DateTime       @updatedAt @db.Timestamptz
  lockVersion     Int            @default(1)
  organization    Organization   @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  athlete         AthleteProfile @relation(fields: [athleteId], references: [id], onDelete: Restrict)
  trainer         TrainerProfile @relation(fields: [trainerId], references: [id], onDelete: Restrict)

  @@index([organizationId, athleteId])
}
```

---

## 8. INFRAESTRUTURA FINANCEIRA, ASSINATURAS E MARKETPLACE IMUTÁVEL

O checkout usa exclusivamente `MarketplacePlanVersion.priceSnapshot` da versão publicada. `MarketplacePlan.price` representa o valor em edição para a próxima versão.

```prisma
model MarketplacePlan {
  id                 String                   @id @default(uuid())
  organizationId     String
  trainerId          String
  title              String
  description        String
  price              Decimal                  @db.Decimal(12, 2)
  modality           Modality
  targetLevel        String
  durationWeeks      Int
  status             MarketplaceStatus        @default(DRAFT)
  publishedVersionId String?                  @unique
  lockVersion        Int                      @default(1)
  commercialVersion  Int                      @default(1)
  createdAt          DateTime                 @default(now()) @db.Timestamptz
  updatedAt          DateTime                 @updatedAt @db.Timestamptz
  organization       Organization             @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  trainer            TrainerProfile           @relation(fields: [trainerId], references: [id], onDelete: Restrict)
  versions           MarketplacePlanVersion[] @relation("PlanVersions")
  publishedVersion   MarketplacePlanVersion?  @relation("PublishedPlanVersion", fields: [publishedVersionId], references: [id], onDelete: SetNull)
}

model MarketplacePlanVersion {
  id                  String                @id @default(uuid())
  marketplacePlanId   String
  titleSnapshot       String
  descriptionSnapshot String
  priceSnapshot       Decimal               @db.Decimal(12, 2)
  commercialVersion   Int
  contentSnapshot     Json
  createdAt           DateTime              @default(now()) @db.Timestamptz
  plan                MarketplacePlan       @relation("PlanVersions", fields: [marketplacePlanId], references: [id], onDelete: Cascade)
  publishedByPlans    MarketplacePlan?      @relation("PublishedPlanVersion")
  purchases           MarketplacePurchase[]

  @@unique([marketplacePlanId, commercialVersion])
}

model MarketplacePurchase {
  id                       String                    @id @default(uuid())
  organizationId           String
  marketplacePlanVersionId String
  athleteId                String
  status                   MarketplacePurchaseStatus @default(PENDING)
  pricePaid                Decimal                   @db.Decimal(12, 2)
  currency                 String                    @default("BRL") @db.VarChar(3)
  titleSnapshot            String
  activationStartDate      DateTime?                 @db.Date
  activatedAt              DateTime?                 @db.Timestamptz
  activationBatchId        String?
  purchasedAt              DateTime                  @default(now()) @db.Timestamptz
  lockVersion              Int                       @default(1)
  organization             Organization              @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  version                  MarketplacePlanVersion    @relation(fields: [marketplacePlanVersionId], references: [id], onDelete: Restrict)
  athlete                  AthleteProfile            @relation(fields: [athleteId], references: [id], onDelete: Restrict)
  transactions             PaymentTransaction[]
  workouts                 Workout[]
}

model SubscriptionPlan {
  id             String         @id @default(uuid())
  name           String         @unique
  price          Decimal        @db.Decimal(12, 2)
  billingCycle   BillingCycle
  featuresLimits Json
  isActive       Boolean        @default(true)
  subscriptions  Subscription[]
}

model Subscription {
  id                    String             @id @default(uuid())
  organizationId        String
  subscriptionPlanId    String
  status                SubscriptionStatus @default(INCOMPLETE)
  gatewaySubscriptionId String?            @unique
  currentPeriodStart    DateTime?          @db.Timestamptz
  currentPeriodEnd      DateTime?          @db.Timestamptz
  cancelAtPeriodEnd     Boolean            @default(false)
  cancelledAt           DateTime?          @db.Timestamptz
  createdAt             DateTime           @default(now()) @db.Timestamptz
  updatedAt             DateTime           @updatedAt @db.Timestamptz
  lockVersion           Int                @default(1)
  organization          Organization       @relation(fields: [organizationId], references: [id], onDelete: Restrict)
  plan                  SubscriptionPlan   @relation(fields: [subscriptionPlanId], references: [id], onDelete: Restrict)
  transactions          PaymentTransaction[]
}

model PaymentTransaction {
  id                 String               @id @default(uuid())
  purchaseId         String?
  subscriptionId     String?
  gatewayRefId       String?              @unique
  amount             Decimal              @db.Decimal(12, 2)
  currency           String               @default("BRL") @db.VarChar(3)
  status             PaymentStatus        @default(PENDING)
  idempotencyKey     String               @unique
  lockVersion        Int                  @default(1)
  webhookEventId     String?              @unique
  webhookEventType   String?
  webhookPayloadHash String?
  webhookReceivedAt  DateTime?            @db.Timestamptz
  webhookProcessedAt DateTime?            @db.Timestamptz
  createdAt          DateTime             @default(now()) @db.Timestamptz
  updatedAt          DateTime             @updatedAt @db.Timestamptz
  purchase           MarketplacePurchase? @relation(fields: [purchaseId], references: [id], onDelete: Restrict)
  subscription       Subscription?        @relation(fields: [subscriptionId], references: [id], onDelete: Restrict)
}
```

---

## 9. AUDITORIA MINIMIZADA

```prisma
model AuditLog {
  id                 String         @id @default(uuid())
  userId             String?
  organizationId     String?
  action             String
  entityName         String
  entityId           String?
  actorType          AuditActorType @default(USER)
  ipAddress          String?
  requestId          String?
  correlationId      String?
  userAgent          String?
  reason             String?
  changedFields      String[]       @default([])
  previousValuesHash String?
  newValuesHash      String?
  createdAt          DateTime       @default(now()) @db.Timestamptz
  user               User?          @relation(fields: [userId], references: [id], onDelete: SetNull)
  organization       Organization?  @relation(fields: [organizationId], references: [id], onDelete: SetNull)

  @@index([action])
  @@index([correlationId])
  @@index([organizationId, createdAt])
}
```

---

## 10. CROSS-ENTITY TENANT AND OWNERSHIP INVARIANTS

As entidades `TrainingWeek` e `PeriodizationPhase` herdam o tenant por meio da `Periodization`. Elas não possuem `organizationId` próprio.

**Invariante de linhagem de tenant:**
$$\text{periodization.organizationId} == \text{workout.organizationId} == \text{generationBatch.organizationId} == \text{marketplacePurchase.organizationId} == \text{report.organizationId}$$

$$\text{trainingWeek.periodization.organizationId} == \text{workout.organizationId}$$
$$\text{periodizationPhase.periodization.organizationId} == \text{workout.organizationId}$$

**Invariante estratégica:**
$$\text{trainingWeek.periodizationId} == \text{workout.periodizationId}$$
$$\text{periodizationPhase.periodizationId} == \text{trainingWeek.periodizationId} == \text{workout.periodizationId}$$
$$\text{generationBatch.periodizationId} == \text{workout.periodizationId}$$

**Invariante de vínculo esportivo:**
- O `TrainerProfile` deve possuir `OrganizationMembership` ativo na `organizationId` do `Workout`.
- O `AthleteProfile` deve possuir `CoachAthleteRelationship` ativo na mesma organização.

**Invariante comercial:**
$$\text{MarketplacePlan.publishedVersion.marketplacePlanId} == \text{MarketplacePlan.id}$$

---

## 11. LIFECYCLE, SOFT DELETE E LGPD

- Entidades financeiras, relatórios, testes, workouts executados e feedbacks nunca sofrem hard delete.
- Exclusão operacional utiliza estados, arquivamento ou timestamps de desativação.
- Solicitações LGPD removem associações nominais e anonimizam identificadores pessoais, preservando registros financeiros e estatísticos quando houver base legal.
- `AuditLog` permanece append-only. Em anonimização, perde a associação nominal direta, mas preserva estrutura e hashes.

---

## 12. POLÍTICA DE MIGRATIONS EM PRODUÇÃO

**Comandos proibidos em produção:**
- `prisma migrate reset`
- `db push --force-reset`
- alterações que implementem rename por drop + create sem plano de transição
- seeds destrutivos

**Pipeline obrigatório:**
1.  Auditoria do schema existente.
2.  Backup integral do banco.
3.  Migration aditiva.
4.  Backfill controlado.
5.  Validação de integridade.
6.  Ativação gradual por feature flags.
7.  Conversão posterior de campos opcionais para obrigatórios.
8.  Plano de rollback documentado.

---

## 13. CONSTRAINTS NATIVAS DO POSTGRESQL

```sql
ALTER TABLE "WorkoutFeedback" ADD CONSTRAINT "chk_feedback_ranges" CHECK (
  ("sessionRpe" IS NULL OR "sessionRpe" BETWEEN 1 AND 10) AND
  ("fatigueLevel" IS NULL OR "fatigueLevel" BETWEEN 0 AND 10) AND
  ("recoveryLevel" IS NULL OR "recoveryLevel" BETWEEN 0 AND 10) AND
  ("painLevel" IS NULL OR "painLevel" BETWEEN 0 AND 10) AND
  ("actualDurationMinutes" IS NULL OR "actualDurationMinutes" > 0)
);

ALTER TABLE "WorkoutFeedback" ADD CONSTRAINT "chk_workload_consistency" CHECK (
  ("loadStatus" = 'COMPLETE' AND "actualDurationMinutes" IS NOT NULL AND "sessionRpe" IS NOT NULL AND "sessionRpeLoad" IS NOT NULL) OR
  ("loadStatus" <> 'COMPLETE' AND "sessionRpeLoad" IS NULL)
);

ALTER TABLE "WorkoutExercise" ADD CONSTRAINT "chk_strength_ranges" CHECK (
  "sets" > 0 AND
  ("reps" IS NULL OR "reps" >= 0) AND
  ("rpeTarget" IS NULL OR "rpeTarget" BETWEEN 1 AND 10) AND
  ("rir" IS NULL OR "rir" >= 0)
);

ALTER TABLE "Workout" ADD CONSTRAINT "chk_workout_time" CHECK (
  "plannedStartAt" IS NULL OR "plannedEndAt" IS NULL OR "plannedEndAt" > "plannedStartAt"
);

ALTER TABLE "Periodization" ADD CONSTRAINT "chk_periodization_dates" CHECK ("endDate" >= "startDate");
ALTER TABLE "PeriodizationPhase" ADD CONSTRAINT "chk_phase_dates" CHECK ("endDate" >= "startDate");
ALTER TABLE "TrainingWeek" ADD CONSTRAINT "chk_week_dates" CHECK ("endDate" >= "startDate");
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "chk_event_time" CHECK ("endAt" > "startAt");

CREATE UNIQUE INDEX "uq_global_exercise_name" ON "Exercise" (LOWER("name")) WHERE "organizationId" IS NULL;
CREATE UNIQUE INDEX "uq_organization_exercise_name" ON "Exercise" ("organizationId", LOWER("name")) WHERE "organizationId" IS NOT NULL;
CREATE UNIQUE INDEX "uq_active_subscription_per_organization" ON "Subscription" ("organizationId") WHERE "status" IN ('TRIALING', 'ACTIVE', 'PAST_DUE', 'INCOMPLETE');
CREATE UNIQUE INDEX "uq_user_email_lowercase" ON "User" (LOWER("email"));
```

---

## 14. HIERARQUIA DOCUMENTAL

1.  **ENKY 00 — Constitution**
2.  **ENKY OS — Product & Engineering Specification v1.0**
3.  **ENKY OS — Interface Architecture & Screen Specifications v1.4**
4.  **ENKY OS — Data Model Specification v1.2.1 — Approved for Implementation**
5.  Documentos técnicos específicos
6.  **ENKY 24 — Prompt Master para Claude/Codex**

**Status final: Approved for Implementation.**
