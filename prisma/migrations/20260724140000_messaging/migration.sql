-- Mensagens assíncronas atleta ↔ treinador (App do atleta §13).
-- ADITIVA: duas tabelas novas (Conversation, Message). Não altera nada existente.

CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "trainerProfileId" TEXT NOT NULL,
    "athleteProfileId" TEXT NOT NULL,
    "lastMessageAt" TIMESTAMPTZ,
    "trainerArchivedAt" TIMESTAMPTZ,
    "athleteArchivedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderUserId" TEXT NOT NULL,
    "senderRole" "Role" NOT NULL,
    "body" TEXT NOT NULL,
    "readAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "uq_conversation_pair" ON "Conversation"("organizationId", "trainerProfileId", "athleteProfileId");
CREATE INDEX "Conversation_organizationId_trainerProfileId_lastMessageAt_idx" ON "Conversation"("organizationId", "trainerProfileId", "lastMessageAt");
CREATE INDEX "Conversation_organizationId_athleteProfileId_lastMessageAt_idx" ON "Conversation"("organizationId", "athleteProfileId", "lastMessageAt");
CREATE INDEX "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt");

ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_trainerProfileId_fkey" FOREIGN KEY ("trainerProfileId") REFERENCES "TrainerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_athleteProfileId_fkey" FOREIGN KEY ("athleteProfileId") REFERENCES "AthleteProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Message" ADD CONSTRAINT "Message_senderUserId_fkey" FOREIGN KEY ("senderUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
