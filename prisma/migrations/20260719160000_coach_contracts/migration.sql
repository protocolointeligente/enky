-- Etapa 4 §10–11 — CoachClientContract (contrato assessoria↔cliente). Tabela nova,
-- migração ADITIVA. Gerada offline; operador aplica em staging (migrate deploy).

-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('DRAFT', 'PENDING_SIGNATURE', 'ACTIVE', 'PAUSED', 'OVERDUE', 'CANCELLED', 'EXPIRED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "ContractAcceptanceMethod" AS ENUM ('MANUAL', 'CHECKBOX', 'DIGITAL_SIGNATURE_PROVIDER', 'IMPORTED');

-- CreateTable
CREATE TABLE "CoachClientContract" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "athleteId" TEXT,
    "servicePlanId" TEXT NOT NULL,
    "payerClientId" TEXT NOT NULL,
    "status" "ContractStatus" NOT NULL DEFAULT 'DRAFT',
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "billingStartDate" DATE,
    "billingDay" INTEGER NOT NULL DEFAULT 1,
    "price" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "finalPrice" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'BRL',
    "autoRenew" BOOLEAN NOT NULL DEFAULT false,
    "gracePeriodDays" INTEGER NOT NULL DEFAULT 0,
    "cancellationNoticeDays" INTEGER NOT NULL DEFAULT 0,
    "cancellationReason" TEXT,
    "cancelledAt" TIMESTAMPTZ,
    "templateCode" TEXT,
    "templateVersion" INTEGER,
    "acceptedAt" TIMESTAMPTZ,
    "acceptedBy" TEXT,
    "acceptanceMethod" "ContractAcceptanceMethod",
    "acceptanceIp" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "lockVersion" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "CoachClientContract_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CoachClientContract_organizationId_status_idx" ON "CoachClientContract"("organizationId", "status");

-- CreateIndex
CREATE INDEX "CoachClientContract_clientId_idx" ON "CoachClientContract"("clientId");

-- CreateIndex
CREATE INDEX "CoachClientContract_payerClientId_idx" ON "CoachClientContract"("payerClientId");

-- CreateIndex
CREATE INDEX "CoachClientContract_servicePlanId_idx" ON "CoachClientContract"("servicePlanId");

-- AddForeignKey
ALTER TABLE "CoachClientContract" ADD CONSTRAINT "CoachClientContract_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachClientContract" ADD CONSTRAINT "CoachClientContract_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachClientContract" ADD CONSTRAINT "CoachClientContract_payerClientId_fkey" FOREIGN KEY ("payerClientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachClientContract" ADD CONSTRAINT "CoachClientContract_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "AthleteProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachClientContract" ADD CONSTRAINT "CoachClientContract_servicePlanId_fkey" FOREIGN KEY ("servicePlanId") REFERENCES "CoachServicePlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

