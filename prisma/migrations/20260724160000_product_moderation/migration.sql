-- Moderação de produtos do marketplace (Superadmin §16.1).
-- ADITIVA: enum + tabela de histórico. Não altera nada existente.

CREATE TYPE "ProductModerationAction" AS ENUM ('APPROVE', 'REJECT', 'SUSPEND', 'REINSTATE', 'ARCHIVE');

CREATE TABLE "ProductModerationEvent" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "action" "ProductModerationAction" NOT NULL,
    "fromStatus" "MarketplaceProductStatus" NOT NULL,
    "toStatus" "MarketplaceProductStatus" NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProductModerationEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProductModerationEvent_productId_createdAt_idx" ON "ProductModerationEvent"("productId", "createdAt");

ALTER TABLE "ProductModerationEvent" ADD CONSTRAINT "ProductModerationEvent_productId_fkey" FOREIGN KEY ("productId") REFERENCES "MarketplaceProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductModerationEvent" ADD CONSTRAINT "ProductModerationEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
