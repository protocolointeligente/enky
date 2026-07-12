-- CreateTable
CREATE TABLE "ReadinessCheckIn" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "checkInDate" DATE NOT NULL,
    "sleepHours" DECIMAL(4,2),
    "sleepQuality" INTEGER,
    "fatigue" INTEGER,
    "soreness" INTEGER,
    "stress" INTEGER,
    "motivation" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "lockVersion" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "ReadinessCheckIn_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReadinessCheckIn_organizationId_athleteId_checkInDate_idx" ON "ReadinessCheckIn"("organizationId", "athleteId", "checkInDate");

-- CreateIndex
CREATE UNIQUE INDEX "uq_readiness_athlete_day" ON "ReadinessCheckIn"("athleteId", "checkInDate");

-- AddForeignKey
ALTER TABLE "ReadinessCheckIn" ADD CONSTRAINT "ReadinessCheckIn_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReadinessCheckIn" ADD CONSTRAINT "ReadinessCheckIn_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "AthleteProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
