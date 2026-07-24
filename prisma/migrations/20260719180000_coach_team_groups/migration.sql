-- Etapa 4 §18–20 — carteira (papel/assignedBy no vínculo), membership.isActive,
-- e grupos (CoachGroup + CoachGroupMember). Migração ADITIVA. Gerada offline.

-- CreateEnum
CREATE TYPE "CoachAthleteRole" AS ENUM ('PRIMARY', 'ASSISTANT', 'TEMPORARY', 'VIEW_ONLY');

-- CreateEnum
CREATE TYPE "CoachGroupStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- AlterTable
ALTER TABLE "OrganizationMembership" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "CoachAthleteRelationship" ADD COLUMN     "assignedByUserId" TEXT,
ADD COLUMN     "role" "CoachAthleteRole" NOT NULL DEFAULT 'PRIMARY';

-- CreateTable
CREATE TABLE "CoachGroup" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "modality" "Modality",
    "level" TEXT,
    "coachId" TEXT,
    "status" "CoachGroupStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "lockVersion" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "CoachGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoachGroupMember" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "addedByUserId" TEXT,
    "addedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoachGroupMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CoachGroup_organizationId_status_idx" ON "CoachGroup"("organizationId", "status");

-- CreateIndex
CREATE INDEX "CoachGroupMember_organizationId_idx" ON "CoachGroupMember"("organizationId");

-- CreateIndex
CREATE INDEX "CoachGroupMember_athleteId_idx" ON "CoachGroupMember"("athleteId");

-- CreateIndex
CREATE UNIQUE INDEX "uq_group_member" ON "CoachGroupMember"("groupId", "athleteId");

-- AddForeignKey
ALTER TABLE "CoachAthleteRelationship" ADD CONSTRAINT "CoachAthleteRelationship_assignedByUserId_fkey" FOREIGN KEY ("assignedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachGroup" ADD CONSTRAINT "CoachGroup_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachGroup" ADD CONSTRAINT "CoachGroup_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "TrainerProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachGroupMember" ADD CONSTRAINT "CoachGroupMember_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachGroupMember" ADD CONSTRAINT "CoachGroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "CoachGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachGroupMember" ADD CONSTRAINT "CoachGroupMember_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "AthleteProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachGroupMember" ADD CONSTRAINT "CoachGroupMember_addedByUserId_fkey" FOREIGN KEY ("addedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

