-- Avaliações do atleta (etapa feat/athlete-assessments-prescription-zones).
-- Migração ADITIVA: novos enums + nova tabela. Não altera nem apaga nada
-- existente (TestResult/DerivedMetric permanecem intactos).

CREATE TYPE "AssessmentStatus" AS ENUM ('DRAFT', 'VALID', 'SUPERSEDED', 'EXPIRED', 'INVALID');
CREATE TYPE "AssessmentSource" AS ENUM ('MEASURED', 'ESTIMATED', 'IMPORTED', 'MANUAL', 'DEVICE', 'LAB', 'FIELD_TEST');

CREATE TABLE "Assessment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "assessmentType" TEXT NOT NULL,
    "modality" "Modality",
    "protocolCode" TEXT NOT NULL,
    "protocolVersion" TEXT NOT NULL DEFAULT '1.0.0',
    "assessmentDate" DATE NOT NULL,
    "performedByUserId" TEXT,
    "source" "AssessmentSource" NOT NULL DEFAULT 'MANUAL',
    "status" "AssessmentStatus" NOT NULL DEFAULT 'DRAFT',
    "confidence" "ConfidenceLevel" NOT NULL DEFAULT 'NOT_ASSESSED',
    "validUntil" DATE,
    "measurements" JSONB NOT NULL,
    "derivedMetrics" JSONB,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "lockVersion" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "Assessment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_assessment_athlete_type_date" ON "Assessment"("organizationId", "athleteId", "assessmentType", "assessmentDate");
CREATE INDEX "idx_assessment_athlete_status" ON "Assessment"("organizationId", "athleteId", "status");

ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "AthleteProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_performedByUserId_fkey" FOREIGN KEY ("performedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
