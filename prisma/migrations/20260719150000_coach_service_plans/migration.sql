-- Etapa 4 §9 — CoachServicePlan (produto comercial da assessoria). Tabela nova,
-- migração ADITIVA. Gerada offline; operador aplica em staging (migrate deploy).

-- CreateEnum
CREATE TYPE "CoachBillingType" AS ENUM ('RECURRING', 'ONE_TIME', 'PACKAGE', 'FREE', 'CUSTOM');

-- CreateEnum
CREATE TYPE "CoachBillingInterval" AS ENUM ('WEEKLY', 'MONTHLY', 'QUARTERLY', 'SEMIANNUAL', 'ANNUAL', 'CUSTOM');

-- CreateTable
CREATE TABLE "CoachServicePlan" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "modality" "Modality",
    "billingType" "CoachBillingType" NOT NULL DEFAULT 'RECURRING',
    "price" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'BRL',
    "billingInterval" "CoachBillingInterval",
    "durationMonths" INTEGER,
    "trialDays" INTEGER NOT NULL DEFAULT 0,
    "maxSessionsPerWeek" INTEGER,
    "includedAssessments" INTEGER,
    "includedReports" BOOLEAN NOT NULL DEFAULT false,
    "includedCommunication" BOOLEAN NOT NULL DEFAULT false,
    "includedFeatures" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "lockVersion" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "CoachServicePlan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CoachServicePlan_organizationId_isActive_idx" ON "CoachServicePlan"("organizationId", "isActive");

-- AddForeignKey
ALTER TABLE "CoachServicePlan" ADD CONSTRAINT "CoachServicePlan_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

