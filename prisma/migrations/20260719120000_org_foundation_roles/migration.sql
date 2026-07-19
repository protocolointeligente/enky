-- Etapa 4 §3/§4 — Fundação da organização como assessoria + papéis organizacionais.
-- Migração ADITIVA: só ADD VALUE / ADD COLUMN (nullable). Nada é removido nem
-- reescrito; linhas existentes seguem válidas (Organization.name/slug intactos,
-- memberships OWNER intactas). Aplicar em staging via `prisma migrate deploy`.

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.
ALTER TYPE "OrganizationRole" ADD VALUE 'MANAGER';
ALTER TYPE "OrganizationRole" ADD VALUE 'HEAD_COACH';
ALTER TYPE "OrganizationRole" ADD VALUE 'ASSISTANT_COACH';
ALTER TYPE "OrganizationRole" ADD VALUE 'FINANCE';
ALTER TYPE "OrganizationRole" ADD VALUE 'VIEWER';

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "document" TEXT,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "legalName" TEXT,
ADD COLUMN     "logoUrl" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "website" TEXT;
