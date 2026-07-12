-- CreateEnum
CREATE TYPE "InsightStatus" AS ENUM ('PENDING', 'ACCEPTED', 'IGNORED');

-- CreateTable
CREATE TABLE "Insight" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "trainerId" TEXT NOT NULL,
    "engine" TEXT NOT NULL,
    "risk" TEXT NOT NULL,
    "rulesetVersion" TEXT NOT NULL DEFAULT '1.0.0',
    "fingerprint" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "status" "InsightStatus" NOT NULL DEFAULT 'PENDING',
    "outcome" TEXT,
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "lockVersion" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "Insight_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Insight_organizationId_trainerId_status_idx" ON "Insight"("organizationId", "trainerId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "uq_insight_scope_fingerprint" ON "Insight"("organizationId", "trainerId", "fingerprint");

-- AddForeignKey
ALTER TABLE "Insight" ADD CONSTRAINT "Insight_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Insight" ADD CONSTRAINT "Insight_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "AthleteProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Insight" ADD CONSTRAINT "Insight_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "TrainerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Insight" ADD CONSTRAINT "Insight_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
