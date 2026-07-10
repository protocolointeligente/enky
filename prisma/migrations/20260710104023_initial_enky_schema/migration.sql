-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPERADMIN', 'ADMIN', 'TRAINER', 'ATHLETE');

-- CreateEnum
CREATE TYPE "OrganizationRole" AS ENUM ('OWNER', 'COACH', 'ADMIN', 'SUPPORT');

-- CreateEnum
CREATE TYPE "WorkoutStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'IN_PROGRESS', 'COMPLETED', 'PARTIAL', 'MISSED', 'ARCHIVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "WorkoutCompletionSource" AS ENUM ('ATHLETE_REPORTED', 'SYSTEM_EXPIRED', 'TRAINER_MARKED');

-- CreateEnum
CREATE TYPE "SessionRpeLoadStatus" AS ENUM ('COMPLETE', 'PARTIAL', 'NOT_AVAILABLE', 'INVALID');

-- CreateEnum
CREATE TYPE "MarketplaceStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'REJECTED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "MarketplacePurchaseStatus" AS ENUM ('PENDING', 'ACTIVE', 'EXPIRED', 'CANCELLED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'REFUNDED', 'CANCELLED', 'DISPUTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('INCOMPLETE', 'TRIALING', 'ACTIVE', 'PAST_DUE', 'UNPAID', 'PAUSED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "GenerationMode" AS ENUM ('AUTOMATIC', 'ASSISTED');

-- CreateEnum
CREATE TYPE "GenerationBatchStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "GenerationScope" AS ENUM ('FULL_CYCLE', 'MESOCYCLE', 'MICROCYCLE', 'SINGLE_WEEK');

-- CreateEnum
CREATE TYPE "CalendarEventType" AS ENUM ('PROVA', 'VIAGEM', 'EXAME', 'INDISPONIBILIDADE');

-- CreateEnum
CREATE TYPE "WorkoutStepType" AS ENUM ('TIRO', 'RODAGEM', 'PAUSA_ATIVA', 'PAUSA_PASSIVA', 'PROGRESSIVO', 'SUBIDA');

-- CreateEnum
CREATE TYPE "IntensityTargetType" AS ENUM ('PACE', 'HEART_RATE_ZONE', 'POWER', 'CADENCE', 'RPE');

-- CreateEnum
CREATE TYPE "AuditActorType" AS ENUM ('USER', 'SYSTEM', 'CRON', 'SUPPORT_AGENT');

-- CreateEnum
CREATE TYPE "BillingCycle" AS ENUM ('MENSAL', 'ANUAL');

-- CreateEnum
CREATE TYPE "Modality" AS ENUM ('RUNNING', 'STRENGTH', 'FUNCTIONAL', 'CYCLING', 'SWIMMING', 'TRIATHLON');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'REVOKED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "WorkoutSource" AS ENUM ('MANUAL', 'PERIODIZATION_GENERATED', 'TEMPLATE', 'MARKETPLACE', 'IMPORTED');

-- CreateEnum
CREATE TYPE "ConfidenceLevel" AS ENUM ('LOW', 'MODERATE', 'HIGH', 'NOT_ASSESSED');

-- CreateEnum
CREATE TYPE "DerivedMetricStatus" AS ENUM ('PENDING', 'CONSOLIDATED', 'STALE', 'INSUFFICIENT_DATA', 'INVALID');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "name" TEXT NOT NULL,
    "globalRole" "Role" NOT NULL DEFAULT 'ATHLETE',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "lockVersion" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ NOT NULL,
    "revokedAt" TIMESTAMPTZ,
    "userAgent" TEXT,
    "ipAddress" TEXT,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "lockVersion" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationMembership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "role" "OrganizationRole" NOT NULL DEFAULT 'COACH',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "OrganizationMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainerProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "crefCode" TEXT,
    "companyName" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "lockVersion" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "TrainerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AthleteProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "birthDate" DATE,
    "gender" TEXT,
    "weightKg" DECIMAL(5,2),
    "heightCm" DECIMAL(5,2),
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "lockVersion" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "AthleteProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoachAthleteRelationship" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "trainerId" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "startedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMPTZ,
    "terminationReason" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "CoachAthleteRelationship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AthleteInvitation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "trainerId" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ NOT NULL,
    "isConsumed" BOOLEAN NOT NULL DEFAULT false,
    "consumedAt" TIMESTAMPTZ,
    "isRevoked" BOOLEAN NOT NULL DEFAULT false,
    "revokedAt" TIMESTAMPTZ,
    "resentCount" INTEGER NOT NULL DEFAULT 0,
    "lastSentAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "AthleteInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Periodization" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "trainerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "goal" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "lockVersion" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "Periodization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PeriodizationPhase" (
    "id" TEXT NOT NULL,
    "periodizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "targetVolumeKm" DECIMAL(10,2),
    "targetIntensity" TEXT,
    "sequence" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "lockVersion" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "PeriodizationPhase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingWeek" (
    "id" TEXT NOT NULL,
    "periodizationId" TEXT NOT NULL,
    "phaseId" TEXT,
    "sequence" INTEGER NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "focus" TEXT,
    "targetVolume" DECIMAL(10,2),
    "targetIntensity" TEXT,
    "isRecoveryWeek" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "lockVersion" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "TrainingWeek_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GenerationBatch" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "periodizationId" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "trainerId" TEXT NOT NULL,
    "requestedByUserId" TEXT NOT NULL,
    "generationMode" "GenerationMode" NOT NULL,
    "generationVersion" INTEGER NOT NULL,
    "algorithmVersion" TEXT NOT NULL,
    "generationRationaleVersion" TEXT,
    "contextSnapshot" JSONB NOT NULL,
    "scope" "GenerationScope" NOT NULL,
    "status" "GenerationBatchStatus" NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMPTZ,
    "completedAt" TIMESTAMPTZ,
    "failedAt" TIMESTAMPTZ,
    "failureCode" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "GenerationBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Workout" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "trainerId" TEXT NOT NULL,
    "periodizationId" TEXT,
    "periodizationPhaseId" TEXT,
    "trainingWeekId" TEXT,
    "generationBatchId" TEXT,
    "marketplacePurchaseId" TEXT,
    "workoutTemplateId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "modality" "Modality" NOT NULL,
    "status" "WorkoutStatus" NOT NULL DEFAULT 'DRAFT',
    "source" "WorkoutSource" NOT NULL DEFAULT 'MANUAL',
    "plannedDate" DATE NOT NULL,
    "plannedStartAt" TIMESTAMPTZ,
    "plannedEndAt" TIMESTAMPTZ,
    "timezone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
    "generationMode" "GenerationMode",
    "generationVersion" INTEGER,
    "algorithmVersion" TEXT,
    "generationRationaleVersion" TEXT,
    "confidenceLevel" "ConfidenceLevel" DEFAULT 'NOT_ASSESSED',
    "generationRationale" JSONB,
    "trainerModified" BOOLEAN NOT NULL DEFAULT false,
    "trainerModifiedAt" TIMESTAMPTZ,
    "trainerModifiedBy" TEXT,
    "modifiedFields" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "lockVersion" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "Workout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkoutTemplate" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "trainerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "modality" "Modality" NOT NULL,
    "contentSnapshot" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "lockVersion" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "WorkoutTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkoutBlock" (
    "id" TEXT NOT NULL,
    "workoutId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL DEFAULT 1,
    "name" TEXT,
    "repetitions" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "WorkoutBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkoutExercise" (
    "id" TEXT NOT NULL,
    "workoutBlockId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL DEFAULT 1,
    "sets" INTEGER NOT NULL,
    "reps" INTEGER,
    "durationSeconds" INTEGER,
    "loadKg" DECIMAL(6,2),
    "rir" INTEGER,
    "rpeTarget" DOUBLE PRECISION,
    "restSeconds" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "WorkoutExercise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkoutStep" (
    "id" TEXT NOT NULL,
    "workoutBlockId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "stepType" "WorkoutStepType" NOT NULL,
    "repetitions" INTEGER,
    "durationSeconds" INTEGER,
    "distanceMeters" INTEGER,
    "targetType" "IntensityTargetType",
    "targetMin" DECIMAL(10,2),
    "targetMax" DECIMAL(10,2),
    "recoverySeconds" INTEGER,
    "recoveryMeters" INTEGER,
    "metadata" JSONB,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "WorkoutStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Exercise" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "targetMuscles" TEXT[],
    "videoUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "archivedAt" TIMESTAMPTZ,

    CONSTRAINT "Exercise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "trainerId" TEXT,
    "eventType" "CalendarEventType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startAt" TIMESTAMPTZ NOT NULL,
    "endAt" TIMESTAMPTZ NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "lockVersion" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "CalendarEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkoutFeedback" (
    "id" TEXT NOT NULL,
    "workoutId" TEXT NOT NULL,
    "actualDurationMinutes" INTEGER,
    "actualDistanceKm" DECIMAL(10,3),
    "sessionRpe" DOUBLE PRECISION,
    "sessionRpeLoad" DECIMAL(10,2),
    "loadStatus" "SessionRpeLoadStatus" NOT NULL DEFAULT 'NOT_AVAILABLE',
    "completionSource" "WorkoutCompletionSource",
    "fatigueLevel" INTEGER,
    "recoveryLevel" INTEGER,
    "painLevel" INTEGER DEFAULT 0,
    "painLaterality" TEXT,
    "painRegion" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "WorkoutFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestResult" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "trainerId" TEXT NOT NULL,
    "testType" TEXT NOT NULL,
    "resultValue" DECIMAL(12,4) NOT NULL,
    "unit" TEXT NOT NULL,
    "protocol" TEXT,
    "calculatedMetrics" JSONB,
    "performedAt" TIMESTAMPTZ NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "lockVersion" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "TestResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DerivedMetric" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "metricKey" TEXT NOT NULL,
    "metricValue" DECIMAL(12,4) NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "formulaVersion" TEXT NOT NULL DEFAULT '1.0.0',
    "status" "DerivedMetricStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "DerivedMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "trainerId" TEXT NOT NULL,
    "status" "ReportStatus" NOT NULL DEFAULT 'DRAFT',
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "metricsSnapshot" JSONB NOT NULL,
    "insights" TEXT,
    "recommendations" TEXT,
    "limitations" TEXT,
    "content" TEXT,
    "sharedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "lockVersion" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketplacePlan" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "trainerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "modality" "Modality" NOT NULL,
    "targetLevel" TEXT NOT NULL,
    "durationWeeks" INTEGER NOT NULL,
    "status" "MarketplaceStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedVersionId" TEXT,
    "lockVersion" INTEGER NOT NULL DEFAULT 1,
    "commercialVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "MarketplacePlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketplacePlanVersion" (
    "id" TEXT NOT NULL,
    "marketplacePlanId" TEXT NOT NULL,
    "titleSnapshot" TEXT NOT NULL,
    "descriptionSnapshot" TEXT NOT NULL,
    "priceSnapshot" DECIMAL(12,2) NOT NULL,
    "commercialVersion" INTEGER NOT NULL,
    "contentSnapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketplacePlanVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketplacePurchase" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "marketplacePlanVersionId" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "status" "MarketplacePurchaseStatus" NOT NULL DEFAULT 'PENDING',
    "pricePaid" DECIMAL(12,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'BRL',
    "titleSnapshot" TEXT NOT NULL,
    "activationStartDate" DATE,
    "activatedAt" TIMESTAMPTZ,
    "activationBatchId" TEXT,
    "purchasedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockVersion" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "MarketplacePurchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscriptionPlan" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "billingCycle" "BillingCycle" NOT NULL,
    "featuresLimits" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "SubscriptionPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "subscriptionPlanId" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'INCOMPLETE',
    "gatewaySubscriptionId" TEXT,
    "currentPeriodStart" TIMESTAMPTZ,
    "currentPeriodEnd" TIMESTAMPTZ,
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "cancelledAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "lockVersion" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentTransaction" (
    "id" TEXT NOT NULL,
    "purchaseId" TEXT,
    "subscriptionId" TEXT,
    "gatewayRefId" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'BRL',
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "idempotencyKey" TEXT NOT NULL,
    "lockVersion" INTEGER NOT NULL DEFAULT 1,
    "webhookEventId" TEXT,
    "webhookEventType" TEXT,
    "webhookPayloadHash" TEXT,
    "webhookReceivedAt" TIMESTAMPTZ,
    "webhookProcessedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "PaymentTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "organizationId" TEXT,
    "action" TEXT NOT NULL,
    "entityName" TEXT NOT NULL,
    "entityId" TEXT,
    "actorType" "AuditActorType" NOT NULL DEFAULT 'USER',
    "ipAddress" TEXT,
    "requestId" TEXT,
    "correlationId" TEXT,
    "userAgent" TEXT,
    "reason" TEXT,
    "changedFields" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "previousValuesHash" TEXT,
    "newValuesHash" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE INDEX "OrganizationMembership_organizationId_idx" ON "OrganizationMembership"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationMembership_userId_organizationId_key" ON "OrganizationMembership"("userId", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "TrainerProfile_userId_key" ON "TrainerProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AthleteProfile_userId_key" ON "AthleteProfile"("userId");

-- CreateIndex
CREATE INDEX "CoachAthleteRelationship_organizationId_athleteId_idx" ON "CoachAthleteRelationship"("organizationId", "athleteId");

-- CreateIndex
CREATE UNIQUE INDEX "CoachAthleteRelationship_organizationId_trainerId_athleteId_key" ON "CoachAthleteRelationship"("organizationId", "trainerId", "athleteId");

-- CreateIndex
CREATE UNIQUE INDEX "AthleteInvitation_tokenHash_key" ON "AthleteInvitation"("tokenHash");

-- CreateIndex
CREATE INDEX "AthleteInvitation_tokenHash_idx" ON "AthleteInvitation"("tokenHash");

-- CreateIndex
CREATE INDEX "Periodization_organizationId_athleteId_idx" ON "Periodization"("organizationId", "athleteId");

-- CreateIndex
CREATE INDEX "Periodization_trainerId_idx" ON "Periodization"("trainerId");

-- CreateIndex
CREATE INDEX "PeriodizationPhase_periodizationId_startDate_idx" ON "PeriodizationPhase"("periodizationId", "startDate");

-- CreateIndex
CREATE UNIQUE INDEX "PeriodizationPhase_periodizationId_sequence_key" ON "PeriodizationPhase"("periodizationId", "sequence");

-- CreateIndex
CREATE INDEX "TrainingWeek_periodizationId_startDate_idx" ON "TrainingWeek"("periodizationId", "startDate");

-- CreateIndex
CREATE UNIQUE INDEX "TrainingWeek_periodizationId_sequence_key" ON "TrainingWeek"("periodizationId", "sequence");

-- CreateIndex
CREATE INDEX "GenerationBatch_organizationId_idx" ON "GenerationBatch"("organizationId");

-- CreateIndex
CREATE INDEX "GenerationBatch_periodizationId_idx" ON "GenerationBatch"("periodizationId");

-- CreateIndex
CREATE INDEX "GenerationBatch_athleteId_createdAt_idx" ON "GenerationBatch"("athleteId", "createdAt");

-- CreateIndex
CREATE INDEX "GenerationBatch_trainerId_createdAt_idx" ON "GenerationBatch"("trainerId", "createdAt");

-- CreateIndex
CREATE INDEX "GenerationBatch_status_idx" ON "GenerationBatch"("status");

-- CreateIndex
CREATE INDEX "Workout_organizationId_athleteId_plannedDate_idx" ON "Workout"("organizationId", "athleteId", "plannedDate");

-- CreateIndex
CREATE INDEX "Workout_trainerId_idx" ON "Workout"("trainerId");

-- CreateIndex
CREATE INDEX "Workout_generationBatchId_idx" ON "Workout"("generationBatchId");

-- CreateIndex
CREATE INDEX "WorkoutTemplate_organizationId_trainerId_idx" ON "WorkoutTemplate"("organizationId", "trainerId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkoutBlock_workoutId_sequence_key" ON "WorkoutBlock"("workoutId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "WorkoutExercise_workoutBlockId_sequence_key" ON "WorkoutExercise"("workoutBlockId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "WorkoutStep_workoutBlockId_sequence_key" ON "WorkoutStep"("workoutBlockId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "Exercise_name_organizationId_key" ON "Exercise"("name", "organizationId");

-- CreateIndex
CREATE INDEX "CalendarEvent_organizationId_athleteId_startAt_idx" ON "CalendarEvent"("organizationId", "athleteId", "startAt");

-- CreateIndex
CREATE UNIQUE INDEX "WorkoutFeedback_workoutId_key" ON "WorkoutFeedback"("workoutId");

-- CreateIndex
CREATE INDEX "TestResult_organizationId_athleteId_performedAt_idx" ON "TestResult"("organizationId", "athleteId", "performedAt");

-- CreateIndex
CREATE UNIQUE INDEX "DerivedMetric_organizationId_athleteId_metricKey_periodStar_key" ON "DerivedMetric"("organizationId", "athleteId", "metricKey", "periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "Report_organizationId_athleteId_idx" ON "Report"("organizationId", "athleteId");

-- CreateIndex
CREATE UNIQUE INDEX "MarketplacePlan_publishedVersionId_key" ON "MarketplacePlan"("publishedVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "MarketplacePlanVersion_marketplacePlanId_commercialVersion_key" ON "MarketplacePlanVersion"("marketplacePlanId", "commercialVersion");

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionPlan_name_key" ON "SubscriptionPlan"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_gatewaySubscriptionId_key" ON "Subscription"("gatewaySubscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentTransaction_gatewayRefId_key" ON "PaymentTransaction"("gatewayRefId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentTransaction_idempotencyKey_key" ON "PaymentTransaction"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentTransaction_webhookEventId_key" ON "PaymentTransaction"("webhookEventId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_correlationId_idx" ON "AuditLog"("correlationId");

-- CreateIndex
CREATE INDEX "AuditLog_organizationId_createdAt_idx" ON "AuditLog"("organizationId", "createdAt");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationMembership" ADD CONSTRAINT "OrganizationMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationMembership" ADD CONSTRAINT "OrganizationMembership_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainerProfile" ADD CONSTRAINT "TrainerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AthleteProfile" ADD CONSTRAINT "AthleteProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachAthleteRelationship" ADD CONSTRAINT "CoachAthleteRelationship_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachAthleteRelationship" ADD CONSTRAINT "CoachAthleteRelationship_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "TrainerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachAthleteRelationship" ADD CONSTRAINT "CoachAthleteRelationship_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "AthleteProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AthleteInvitation" ADD CONSTRAINT "AthleteInvitation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AthleteInvitation" ADD CONSTRAINT "AthleteInvitation_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "TrainerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AthleteInvitation" ADD CONSTRAINT "AthleteInvitation_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "AthleteProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Periodization" ADD CONSTRAINT "Periodization_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Periodization" ADD CONSTRAINT "Periodization_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "AthleteProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Periodization" ADD CONSTRAINT "Periodization_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "TrainerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeriodizationPhase" ADD CONSTRAINT "PeriodizationPhase_periodizationId_fkey" FOREIGN KEY ("periodizationId") REFERENCES "Periodization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingWeek" ADD CONSTRAINT "TrainingWeek_periodizationId_fkey" FOREIGN KEY ("periodizationId") REFERENCES "Periodization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingWeek" ADD CONSTRAINT "TrainingWeek_phaseId_fkey" FOREIGN KEY ("phaseId") REFERENCES "PeriodizationPhase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GenerationBatch" ADD CONSTRAINT "GenerationBatch_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GenerationBatch" ADD CONSTRAINT "GenerationBatch_periodizationId_fkey" FOREIGN KEY ("periodizationId") REFERENCES "Periodization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GenerationBatch" ADD CONSTRAINT "GenerationBatch_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "AthleteProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GenerationBatch" ADD CONSTRAINT "GenerationBatch_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "TrainerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GenerationBatch" ADD CONSTRAINT "GenerationBatch_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workout" ADD CONSTRAINT "Workout_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workout" ADD CONSTRAINT "Workout_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "AthleteProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workout" ADD CONSTRAINT "Workout_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "TrainerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workout" ADD CONSTRAINT "Workout_periodizationId_fkey" FOREIGN KEY ("periodizationId") REFERENCES "Periodization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workout" ADD CONSTRAINT "Workout_periodizationPhaseId_fkey" FOREIGN KEY ("periodizationPhaseId") REFERENCES "PeriodizationPhase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workout" ADD CONSTRAINT "Workout_trainingWeekId_fkey" FOREIGN KEY ("trainingWeekId") REFERENCES "TrainingWeek"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workout" ADD CONSTRAINT "Workout_generationBatchId_fkey" FOREIGN KEY ("generationBatchId") REFERENCES "GenerationBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workout" ADD CONSTRAINT "Workout_marketplacePurchaseId_fkey" FOREIGN KEY ("marketplacePurchaseId") REFERENCES "MarketplacePurchase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workout" ADD CONSTRAINT "Workout_workoutTemplateId_fkey" FOREIGN KEY ("workoutTemplateId") REFERENCES "WorkoutTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutTemplate" ADD CONSTRAINT "WorkoutTemplate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutTemplate" ADD CONSTRAINT "WorkoutTemplate_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "TrainerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutBlock" ADD CONSTRAINT "WorkoutBlock_workoutId_fkey" FOREIGN KEY ("workoutId") REFERENCES "Workout"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutExercise" ADD CONSTRAINT "WorkoutExercise_workoutBlockId_fkey" FOREIGN KEY ("workoutBlockId") REFERENCES "WorkoutBlock"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutExercise" ADD CONSTRAINT "WorkoutExercise_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutStep" ADD CONSTRAINT "WorkoutStep_workoutBlockId_fkey" FOREIGN KEY ("workoutBlockId") REFERENCES "WorkoutBlock"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exercise" ADD CONSTRAINT "Exercise_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "AthleteProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "TrainerProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutFeedback" ADD CONSTRAINT "WorkoutFeedback_workoutId_fkey" FOREIGN KEY ("workoutId") REFERENCES "Workout"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestResult" ADD CONSTRAINT "TestResult_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestResult" ADD CONSTRAINT "TestResult_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "AthleteProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestResult" ADD CONSTRAINT "TestResult_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "TrainerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DerivedMetric" ADD CONSTRAINT "DerivedMetric_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DerivedMetric" ADD CONSTRAINT "DerivedMetric_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "AthleteProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "AthleteProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "TrainerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplacePlan" ADD CONSTRAINT "MarketplacePlan_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplacePlan" ADD CONSTRAINT "MarketplacePlan_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "TrainerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplacePlan" ADD CONSTRAINT "MarketplacePlan_publishedVersionId_fkey" FOREIGN KEY ("publishedVersionId") REFERENCES "MarketplacePlanVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplacePlanVersion" ADD CONSTRAINT "MarketplacePlanVersion_marketplacePlanId_fkey" FOREIGN KEY ("marketplacePlanId") REFERENCES "MarketplacePlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplacePurchase" ADD CONSTRAINT "MarketplacePurchase_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplacePurchase" ADD CONSTRAINT "MarketplacePurchase_marketplacePlanVersionId_fkey" FOREIGN KEY ("marketplacePlanVersionId") REFERENCES "MarketplacePlanVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplacePurchase" ADD CONSTRAINT "MarketplacePurchase_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "AthleteProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_subscriptionPlanId_fkey" FOREIGN KEY ("subscriptionPlanId") REFERENCES "SubscriptionPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentTransaction" ADD CONSTRAINT "PaymentTransaction_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "MarketplacePurchase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentTransaction" ADD CONSTRAINT "PaymentTransaction_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
