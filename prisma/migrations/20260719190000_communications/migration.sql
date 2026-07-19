-- Etapa 4 §22 — CommunicationLog (livro-razão de comunicações). Tabela nova,
-- migração ADITIVA. Gerada offline; operador aplica em staging.

-- CreateEnum
CREATE TYPE "CommunicationRecipientType" AS ENUM ('CLIENT', 'LEAD', 'ATHLETE');

-- CreateEnum
CREATE TYPE "CommunicationChannel" AS ENUM ('EMAIL', 'IN_APP', 'MANUAL');

-- CreateEnum
CREATE TYPE "CommunicationStatus" AS ENUM ('LOGGED', 'SENT', 'FAILED');

-- CreateTable
CREATE TABLE "CommunicationLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "recipientType" "CommunicationRecipientType" NOT NULL,
    "recipientId" TEXT NOT NULL,
    "channel" "CommunicationChannel" NOT NULL DEFAULT 'MANUAL',
    "templateCode" TEXT,
    "subject" TEXT,
    "body" TEXT,
    "status" "CommunicationStatus" NOT NULL DEFAULT 'LOGGED',
    "sentAt" TIMESTAMPTZ,
    "failureReason" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunicationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CommunicationLog_organizationId_createdAt_idx" ON "CommunicationLog"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "CommunicationLog_organizationId_recipientType_recipientId_idx" ON "CommunicationLog"("organizationId", "recipientType", "recipientId");

-- AddForeignKey
ALTER TABLE "CommunicationLog" ADD CONSTRAINT "CommunicationLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationLog" ADD CONSTRAINT "CommunicationLog_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

