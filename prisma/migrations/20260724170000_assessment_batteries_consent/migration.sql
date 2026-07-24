-- Baterias de avaliação + registros de consentimento (trabalho de outro agente,
-- finalizado: back-relations e migração). ADITIVA: enums + 3 tabelas novas.
-- Não altera nada existente.

CREATE TYPE "BatteryStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');
CREATE TYPE "ConsentStatus" AS ENUM ('GRANTED', 'REVOKED', 'EXPIRED');

CREATE TABLE "AssessmentBattery" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "BatteryStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "AssessmentBattery_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AssessmentBatteryItem" (
    "id" TEXT NOT NULL,
    "batteryId" TEXT NOT NULL,
    "protocolCode" TEXT NOT NULL,
    "protocolVersion" TEXT NOT NULL DEFAULT '1.0.0',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isOptional" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    CONSTRAINT "AssessmentBatteryItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ConsentRecord" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "grantedByUserId" TEXT NOT NULL,
    "recordedByUserId" TEXT,
    "status" "ConsentStatus" NOT NULL DEFAULT 'GRANTED',
    "consentVersion" TEXT NOT NULL DEFAULT '1.0',
    "consentText" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "notes" TEXT,
    "revokedReason" TEXT,
    "validUntil" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ConsentRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AssessmentBattery_organizationId_status_idx" ON "AssessmentBattery"("organizationId", "status");
CREATE INDEX "AssessmentBattery_organizationId_createdByUserId_idx" ON "AssessmentBattery"("organizationId", "createdByUserId");
CREATE UNIQUE INDEX "AssessmentBatteryItem_batteryId_protocolCode_protocolVersion_key" ON "AssessmentBatteryItem"("batteryId", "protocolCode", "protocolVersion");
CREATE INDEX "AssessmentBatteryItem_batteryId_sortOrder_idx" ON "AssessmentBatteryItem"("batteryId", "sortOrder");
CREATE INDEX "ConsentRecord_organizationId_athleteId_createdAt_idx" ON "ConsentRecord"("organizationId", "athleteId", "createdAt");
CREATE INDEX "ConsentRecord_organizationId_athleteId_status_idx" ON "ConsentRecord"("organizationId", "athleteId", "status");

ALTER TABLE "AssessmentBattery" ADD CONSTRAINT "AssessmentBattery_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssessmentBattery" ADD CONSTRAINT "AssessmentBattery_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssessmentBatteryItem" ADD CONSTRAINT "AssessmentBatteryItem_batteryId_fkey" FOREIGN KEY ("batteryId") REFERENCES "AssessmentBattery"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConsentRecord" ADD CONSTRAINT "ConsentRecord_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConsentRecord" ADD CONSTRAINT "ConsentRecord_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "AthleteProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ConsentRecord" ADD CONSTRAINT "ConsentRecord_grantedByUserId_fkey" FOREIGN KEY ("grantedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ConsentRecord" ADD CONSTRAINT "ConsentRecord_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
