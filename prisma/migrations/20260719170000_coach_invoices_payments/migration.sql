-- Etapa 4 §12–14 — CoachInvoice + CoachPayment (mensalidades e baixas). Tabelas
-- novas, migração ADITIVA. Gerada offline; operador aplica em staging.

-- CreateEnum
CREATE TYPE "CoachInvoiceStatus" AS ENUM ('DRAFT', 'PENDING', 'PAID', 'OVERDUE', 'PARTIALLY_PAID', 'CANCELLED', 'REFUNDED', 'FAILED');

-- CreateEnum
CREATE TYPE "CoachPaymentMethod" AS ENUM ('PIX', 'CREDIT_CARD', 'DEBIT_CARD', 'BANK_SLIP', 'TRANSFER', 'CASH', 'OTHER');

-- CreateTable
CREATE TABLE "CoachInvoice" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "payerClientId" TEXT NOT NULL,
    "referencePeriod" TEXT NOT NULL,
    "dueDate" DATE NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "interest" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "penalty" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "finalAmount" DECIMAL(12,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'BRL',
    "status" "CoachInvoiceStatus" NOT NULL DEFAULT 'PENDING',
    "paymentMethod" "CoachPaymentMethod",
    "paidAt" TIMESTAMPTZ,
    "cancelledAt" TIMESTAMPTZ,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "lockVersion" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "CoachInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoachPayment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "paidAt" TIMESTAMPTZ NOT NULL,
    "method" "CoachPaymentMethod" NOT NULL,
    "externalReference" TEXT,
    "notes" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoachPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CoachInvoice_organizationId_status_idx" ON "CoachInvoice"("organizationId", "status");

-- CreateIndex
CREATE INDEX "CoachInvoice_organizationId_dueDate_idx" ON "CoachInvoice"("organizationId", "dueDate");

-- CreateIndex
CREATE INDEX "CoachInvoice_payerClientId_idx" ON "CoachInvoice"("payerClientId");

-- CreateIndex
CREATE UNIQUE INDEX "uq_invoice_contract_period" ON "CoachInvoice"("contractId", "referencePeriod");

-- CreateIndex
CREATE INDEX "CoachPayment_invoiceId_idx" ON "CoachPayment"("invoiceId");

-- CreateIndex
CREATE INDEX "CoachPayment_organizationId_idx" ON "CoachPayment"("organizationId");

-- AddForeignKey
ALTER TABLE "CoachInvoice" ADD CONSTRAINT "CoachInvoice_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachInvoice" ADD CONSTRAINT "CoachInvoice_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "CoachClientContract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachInvoice" ADD CONSTRAINT "CoachInvoice_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachInvoice" ADD CONSTRAINT "CoachInvoice_payerClientId_fkey" FOREIGN KEY ("payerClientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachPayment" ADD CONSTRAINT "CoachPayment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachPayment" ADD CONSTRAINT "CoachPayment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "CoachInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachPayment" ADD CONSTRAINT "CoachPayment_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

