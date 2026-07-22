-- CreateEnum
CREATE TYPE "MarketplaceProductType" AS ENUM ('TRAINING_PLAN', 'COACHING_SERVICE', 'ASSESSMENT_SERVICE', 'PERIODIZATION_TEMPLATE', 'WORKOUT_TEMPLATE_PACK', 'EXERCISE_LIBRARY_PACK', 'EDUCATIONAL_CONTENT', 'CONSULTATION', 'EVENT_PROGRAM');

-- CreateEnum
CREATE TYPE "MarketplaceProductStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'APPROVED', 'PUBLISHED', 'REJECTED', 'SUSPENDED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "MarketplaceVisibility" AS ENUM ('PUBLIC', 'UNLISTED', 'PRIVATE');

-- CreateEnum
CREATE TYPE "MarketplaceDeliveryType" AS ENUM ('DIGITAL_AUTOMATIC', 'COACH_ASSIGNED', 'MANUAL_SCHEDULING', 'HYBRID');

-- CreateEnum
CREATE TYPE "MarketplaceSellerStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'VERIFIED', 'PUBLISHED', 'SUSPENDED', 'REJECTED');

-- CreateEnum
CREATE TYPE "MarketplaceSellerKind" AS ENUM ('TRAINER', 'ASSESSORIA', 'ENKY_OFFICIAL');

-- CreateEnum
CREATE TYPE "MarketplaceOrderStatus" AS ENUM ('DRAFT', 'PENDING_PAYMENT', 'PAID', 'PROCESSING', 'COMPLETED', 'CANCELLED', 'REFUNDED', 'PARTIALLY_REFUNDED', 'FAILED');

-- CreateEnum
CREATE TYPE "MarketplaceDeliveryStatus" AS ENUM ('PENDING', 'PROCESSING', 'DELIVERED', 'FAILED');

-- CreateEnum
CREATE TYPE "MarketplaceEntitlementStatus" AS ENUM ('PENDING', 'ACTIVE', 'EXPIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "MarketplaceReviewStatus" AS ENUM ('PENDING', 'PUBLISHED', 'HIDDEN', 'REJECTED');

-- CreateEnum
CREATE TYPE "MarketplaceLedgerEntryType" AS ENUM ('SALE', 'PLATFORM_FEE', 'GATEWAY_FEE', 'REFUND', 'CHARGEBACK', 'PAYOUT', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "MarketplaceLedgerEntryStatus" AS ENUM ('PENDING', 'AVAILABLE', 'HELD', 'PAID', 'REVERSED');

-- CreateEnum
CREATE TYPE "MarketplaceRefundPolicy" AS ENUM ('NON_REFUNDABLE', 'REFUND_WITHIN_DAYS', 'REFUND_BEFORE_DELIVERY', 'MANUAL_REVIEW');

-- CreateEnum
CREATE TYPE "MarketplaceCouponType" AS ENUM ('PERCENTAGE', 'FIXED');

-- AlterTable
ALTER TABLE "PaymentTransaction" ADD COLUMN     "marketplaceOrderId" TEXT;

-- CreateTable
CREATE TABLE "MarketplaceSellerProfile" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT,
    "kind" "MarketplaceSellerKind" NOT NULL DEFAULT 'TRAINER',
    "displayName" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "headline" TEXT,
    "bio" TEXT,
    "profileImageUrl" TEXT,
    "coverImageUrl" TEXT,
    "modalities" "Modality"[] DEFAULT ARRAY[]::"Modality"[],
    "specialties" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "experienceYears" INTEGER,
    "certifications" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "location" TEXT,
    "remoteService" BOOLEAN NOT NULL DEFAULT true,
    "languages" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "website" TEXT,
    "socialLinks" JSONB,
    "averageRating" DECIMAL(3,2) NOT NULL DEFAULT 0,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "salesCount" INTEGER NOT NULL DEFAULT 0,
    "status" "MarketplaceSellerStatus" NOT NULL DEFAULT 'DRAFT',
    "verificationNotes" TEXT,
    "verifiedByUserId" TEXT,
    "verifiedAt" TIMESTAMPTZ,
    "rejectedAt" TIMESTAMPTZ,
    "rejectionReason" TEXT,
    "lockVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "MarketplaceSellerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketplaceProduct" (
    "id" TEXT NOT NULL,
    "sellerProfileId" TEXT NOT NULL,
    "sellerOrganizationId" TEXT NOT NULL,
    "sellerUserId" TEXT,
    "productType" "MarketplaceProductType" NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "shortDescription" TEXT,
    "fullDescription" TEXT,
    "modality" "Modality",
    "level" TEXT,
    "goal" TEXT,
    "durationWeeks" INTEGER,
    "sessionsPerWeek" INTEGER,
    "deliveryType" "MarketplaceDeliveryType" NOT NULL DEFAULT 'DIGITAL_AUTOMATIC',
    "price" DECIMAL(12,2) NOT NULL,
    "compareAtPrice" DECIMAL(12,2),
    "currency" VARCHAR(3) NOT NULL DEFAULT 'BRL',
    "status" "MarketplaceProductStatus" NOT NULL DEFAULT 'DRAFT',
    "visibility" "MarketplaceVisibility" NOT NULL DEFAULT 'PUBLIC',
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "isEnkyOfficial" BOOLEAN NOT NULL DEFAULT false,
    "officialCode" TEXT,
    "requiresCoachApproval" BOOLEAN NOT NULL DEFAULT false,
    "requiresAthleteProfile" BOOLEAN NOT NULL DEFAULT false,
    "refundPolicy" "MarketplaceRefundPolicy" NOT NULL DEFAULT 'NON_REFUNDABLE',
    "refundWindowDays" INTEGER,
    "thumbnailUrl" TEXT,
    "coverImageUrl" TEXT,
    "previewVideoUrl" TEXT,
    "averageRating" DECIMAL(3,2) NOT NULL DEFAULT 0,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "salesCount" INTEGER NOT NULL DEFAULT 0,
    "publishedVersionId" TEXT,
    "commercialVersion" INTEGER NOT NULL DEFAULT 1,
    "lockVersion" INTEGER NOT NULL DEFAULT 1,
    "publishedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "MarketplaceProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketplaceProductVariant" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DECIMAL(12,2) NOT NULL,
    "compareAtPrice" DECIMAL(12,2),
    "currency" VARCHAR(3) NOT NULL DEFAULT 'BRL',
    "durationWeeks" INTEGER,
    "sessionsPerWeek" INTEGER,
    "supportLevel" TEXT,
    "maxAthletes" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "MarketplaceProductVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketplaceProductVersion" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "commercialVersion" INTEGER NOT NULL,
    "titleSnapshot" TEXT NOT NULL,
    "priceSnapshot" DECIMAL(12,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'BRL',
    "contentSnapshot" JSONB NOT NULL,
    "changeLog" TEXT,
    "createdByUserId" TEXT,
    "publishedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketplaceProductVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketplaceCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "parentId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketplaceCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketplaceProductCategory" (
    "productId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,

    CONSTRAINT "MarketplaceProductCategory_pkey" PRIMARY KEY ("productId","categoryId")
);

-- CreateTable
CREATE TABLE "MarketplaceOrder" (
    "id" TEXT NOT NULL,
    "buyerUserId" TEXT NOT NULL,
    "buyerOrganizationId" TEXT,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'BRL',
    "subtotal" DECIMAL(12,2) NOT NULL,
    "discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "platformFee" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "gatewayFee" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "sellerAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL,
    "status" "MarketplaceOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "deliveryStatus" "MarketplaceDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "gateway" TEXT,
    "gatewayReference" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "couponId" TEXT,
    "lockVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "paidAt" TIMESTAMPTZ,
    "cancelledAt" TIMESTAMPTZ,
    "refundedAt" TIMESTAMPTZ,

    CONSTRAINT "MarketplaceOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketplaceOrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT,
    "productVersionId" TEXT,
    "variantId" TEXT,
    "sellerProfileId" TEXT,
    "sellerOrganizationId" TEXT NOT NULL,
    "sellerUserId" TEXT,
    "title" TEXT NOT NULL,
    "productType" "MarketplaceProductType" NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "platformFee" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "sellerAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "commissionSnapshot" JSONB,
    "deliveryPayload" JSONB,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketplaceOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketplaceCart" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'BRL',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "expiresAt" TIMESTAMPTZ,

    CONSTRAINT "MarketplaceCart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketplaceCartItem" (
    "id" TEXT NOT NULL,
    "cartId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketplaceCartItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketplaceEntitlement" (
    "id" TEXT NOT NULL,
    "buyerUserId" TEXT NOT NULL,
    "buyerOrganizationId" TEXT,
    "orderId" TEXT,
    "orderItemId" TEXT,
    "productId" TEXT,
    "productVersionId" TEXT,
    "entitlementType" "MarketplaceProductType" NOT NULL,
    "status" "MarketplaceEntitlementStatus" NOT NULL DEFAULT 'PENDING',
    "deliveryPayload" JSONB,
    "startsAt" TIMESTAMPTZ,
    "expiresAt" TIMESTAMPTZ,
    "revokedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "MarketplaceEntitlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketplaceReview" (
    "id" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "orderId" TEXT,
    "productId" TEXT NOT NULL,
    "sellerProfileId" TEXT,
    "reviewerUserId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "title" TEXT,
    "comment" TEXT,
    "status" "MarketplaceReviewStatus" NOT NULL DEFAULT 'PENDING',
    "verifiedPurchase" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "MarketplaceReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketplaceReviewResponse" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "responderUserId" TEXT NOT NULL,
    "comment" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "MarketplaceReviewResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketplaceCommissionRule" (
    "id" TEXT NOT NULL,
    "sellerKind" "MarketplaceSellerKind",
    "productType" "MarketplaceProductType",
    "percentage" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "fixedFee" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'BRL',
    "effectiveFrom" TIMESTAMPTZ NOT NULL,
    "effectiveUntil" TIMESTAMPTZ,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketplaceCommissionRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketplaceLedgerEntry" (
    "id" TEXT NOT NULL,
    "sellerProfileId" TEXT NOT NULL,
    "sellerOrganizationId" TEXT NOT NULL,
    "orderId" TEXT,
    "orderItemId" TEXT,
    "type" "MarketplaceLedgerEntryType" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'BRL',
    "status" "MarketplaceLedgerEntryStatus" NOT NULL DEFAULT 'PENDING',
    "availableAt" TIMESTAMPTZ,
    "description" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketplaceLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketplaceSellerBalance" (
    "id" TEXT NOT NULL,
    "sellerProfileId" TEXT NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'BRL',
    "pendingAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "availableAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "paidAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "lockVersion" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "MarketplaceSellerBalance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketplacePaymentEvent" (
    "id" TEXT NOT NULL,
    "gateway" TEXT NOT NULL,
    "externalEventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RECEIVED',
    "orderId" TEXT,
    "processedAt" TIMESTAMPTZ,
    "failureReason" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketplacePaymentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketplaceCoupon" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "discountType" "MarketplaceCouponType" NOT NULL,
    "discountValue" DECIMAL(12,2) NOT NULL,
    "minimumAmount" DECIMAL(12,2),
    "maximumDiscount" DECIMAL(12,2),
    "currency" VARCHAR(3) NOT NULL DEFAULT 'BRL',
    "startsAt" TIMESTAMPTZ,
    "endsAt" TIMESTAMPTZ,
    "usageLimit" INTEGER,
    "usageLimitPerUser" INTEGER,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "sellerOrganizationId" TEXT,
    "productId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketplaceCoupon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketplaceCouponRedemption" (
    "id" TEXT NOT NULL,
    "couponId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orderId" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketplaceCouponRedemption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceSellerProfile_slug_key" ON "MarketplaceSellerProfile"("slug");

-- CreateIndex
CREATE INDEX "MarketplaceSellerProfile_organizationId_idx" ON "MarketplaceSellerProfile"("organizationId");

-- CreateIndex
CREATE INDEX "MarketplaceSellerProfile_userId_idx" ON "MarketplaceSellerProfile"("userId");

-- CreateIndex
CREATE INDEX "MarketplaceSellerProfile_status_idx" ON "MarketplaceSellerProfile"("status");

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceProduct_slug_key" ON "MarketplaceProduct"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceProduct_officialCode_key" ON "MarketplaceProduct"("officialCode");

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceProduct_publishedVersionId_key" ON "MarketplaceProduct"("publishedVersionId");

-- CreateIndex
CREATE INDEX "MarketplaceProduct_sellerOrganizationId_idx" ON "MarketplaceProduct"("sellerOrganizationId");

-- CreateIndex
CREATE INDEX "MarketplaceProduct_status_visibility_idx" ON "MarketplaceProduct"("status", "visibility");

-- CreateIndex
CREATE INDEX "MarketplaceProduct_productType_idx" ON "MarketplaceProduct"("productType");

-- CreateIndex
CREATE INDEX "MarketplaceProductVariant_productId_idx" ON "MarketplaceProductVariant"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceProductVersion_productId_commercialVersion_key" ON "MarketplaceProductVersion"("productId", "commercialVersion");

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceCategory_slug_key" ON "MarketplaceCategory"("slug");

-- CreateIndex
CREATE INDEX "MarketplaceCategory_parentId_idx" ON "MarketplaceCategory"("parentId");

-- CreateIndex
CREATE INDEX "MarketplaceProductCategory_categoryId_idx" ON "MarketplaceProductCategory"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceOrder_idempotencyKey_key" ON "MarketplaceOrder"("idempotencyKey");

-- CreateIndex
CREATE INDEX "MarketplaceOrder_buyerUserId_idx" ON "MarketplaceOrder"("buyerUserId");

-- CreateIndex
CREATE INDEX "MarketplaceOrder_buyerOrganizationId_idx" ON "MarketplaceOrder"("buyerOrganizationId");

-- CreateIndex
CREATE INDEX "MarketplaceOrder_status_idx" ON "MarketplaceOrder"("status");

-- CreateIndex
CREATE INDEX "MarketplaceOrderItem_orderId_idx" ON "MarketplaceOrderItem"("orderId");

-- CreateIndex
CREATE INDEX "MarketplaceOrderItem_sellerOrganizationId_idx" ON "MarketplaceOrderItem"("sellerOrganizationId");

-- CreateIndex
CREATE INDEX "MarketplaceCart_userId_idx" ON "MarketplaceCart"("userId");

-- CreateIndex
CREATE INDEX "MarketplaceCartItem_cartId_idx" ON "MarketplaceCartItem"("cartId");

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceCartItem_cartId_productId_variantId_key" ON "MarketplaceCartItem"("cartId", "productId", "variantId");

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceEntitlement_orderItemId_key" ON "MarketplaceEntitlement"("orderItemId");

-- CreateIndex
CREATE INDEX "MarketplaceEntitlement_buyerUserId_idx" ON "MarketplaceEntitlement"("buyerUserId");

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceReview_orderItemId_key" ON "MarketplaceReview"("orderItemId");

-- CreateIndex
CREATE INDEX "MarketplaceReview_productId_status_idx" ON "MarketplaceReview"("productId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceReviewResponse_reviewId_key" ON "MarketplaceReviewResponse"("reviewId");

-- CreateIndex
CREATE INDEX "MarketplaceCommissionRule_sellerKind_productType_isActive_idx" ON "MarketplaceCommissionRule"("sellerKind", "productType", "isActive");

-- CreateIndex
CREATE INDEX "MarketplaceLedgerEntry_sellerProfileId_status_idx" ON "MarketplaceLedgerEntry"("sellerProfileId", "status");

-- CreateIndex
CREATE INDEX "MarketplaceLedgerEntry_orderId_idx" ON "MarketplaceLedgerEntry"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceSellerBalance_sellerProfileId_key" ON "MarketplaceSellerBalance"("sellerProfileId");

-- CreateIndex
CREATE INDEX "MarketplacePaymentEvent_orderId_idx" ON "MarketplacePaymentEvent"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "MarketplacePaymentEvent_gateway_externalEventId_key" ON "MarketplacePaymentEvent"("gateway", "externalEventId");

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceCoupon_code_key" ON "MarketplaceCoupon"("code");

-- CreateIndex
CREATE INDEX "MarketplaceCoupon_code_idx" ON "MarketplaceCoupon"("code");

-- CreateIndex
CREATE INDEX "MarketplaceCouponRedemption_couponId_userId_idx" ON "MarketplaceCouponRedemption"("couponId", "userId");

-- AddForeignKey
ALTER TABLE "PaymentTransaction" ADD CONSTRAINT "PaymentTransaction_marketplaceOrderId_fkey" FOREIGN KEY ("marketplaceOrderId") REFERENCES "MarketplaceOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceSellerProfile" ADD CONSTRAINT "MarketplaceSellerProfile_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceProduct" ADD CONSTRAINT "MarketplaceProduct_sellerProfileId_fkey" FOREIGN KEY ("sellerProfileId") REFERENCES "MarketplaceSellerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceProduct" ADD CONSTRAINT "MarketplaceProduct_publishedVersionId_fkey" FOREIGN KEY ("publishedVersionId") REFERENCES "MarketplaceProductVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceProductVariant" ADD CONSTRAINT "MarketplaceProductVariant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "MarketplaceProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceProductVersion" ADD CONSTRAINT "MarketplaceProductVersion_productId_fkey" FOREIGN KEY ("productId") REFERENCES "MarketplaceProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceCategory" ADD CONSTRAINT "MarketplaceCategory_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "MarketplaceCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceProductCategory" ADD CONSTRAINT "MarketplaceProductCategory_productId_fkey" FOREIGN KEY ("productId") REFERENCES "MarketplaceProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceProductCategory" ADD CONSTRAINT "MarketplaceProductCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "MarketplaceCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceOrder" ADD CONSTRAINT "MarketplaceOrder_buyerUserId_fkey" FOREIGN KEY ("buyerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceOrder" ADD CONSTRAINT "MarketplaceOrder_buyerOrganizationId_fkey" FOREIGN KEY ("buyerOrganizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceOrder" ADD CONSTRAINT "MarketplaceOrder_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "MarketplaceCoupon"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceOrderItem" ADD CONSTRAINT "MarketplaceOrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "MarketplaceOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceOrderItem" ADD CONSTRAINT "MarketplaceOrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "MarketplaceProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceOrderItem" ADD CONSTRAINT "MarketplaceOrderItem_productVersionId_fkey" FOREIGN KEY ("productVersionId") REFERENCES "MarketplaceProductVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceOrderItem" ADD CONSTRAINT "MarketplaceOrderItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "MarketplaceProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceCart" ADD CONSTRAINT "MarketplaceCart_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceCartItem" ADD CONSTRAINT "MarketplaceCartItem_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "MarketplaceCart"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceCartItem" ADD CONSTRAINT "MarketplaceCartItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "MarketplaceProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceCartItem" ADD CONSTRAINT "MarketplaceCartItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "MarketplaceProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceEntitlement" ADD CONSTRAINT "MarketplaceEntitlement_buyerUserId_fkey" FOREIGN KEY ("buyerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceEntitlement" ADD CONSTRAINT "MarketplaceEntitlement_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "MarketplaceOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceEntitlement" ADD CONSTRAINT "MarketplaceEntitlement_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "MarketplaceOrderItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceEntitlement" ADD CONSTRAINT "MarketplaceEntitlement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "MarketplaceProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceEntitlement" ADD CONSTRAINT "MarketplaceEntitlement_productVersionId_fkey" FOREIGN KEY ("productVersionId") REFERENCES "MarketplaceProductVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceReview" ADD CONSTRAINT "MarketplaceReview_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "MarketplaceOrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceReview" ADD CONSTRAINT "MarketplaceReview_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "MarketplaceOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceReview" ADD CONSTRAINT "MarketplaceReview_productId_fkey" FOREIGN KEY ("productId") REFERENCES "MarketplaceProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceReview" ADD CONSTRAINT "MarketplaceReview_reviewerUserId_fkey" FOREIGN KEY ("reviewerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceReviewResponse" ADD CONSTRAINT "MarketplaceReviewResponse_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "MarketplaceReview"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceLedgerEntry" ADD CONSTRAINT "MarketplaceLedgerEntry_sellerProfileId_fkey" FOREIGN KEY ("sellerProfileId") REFERENCES "MarketplaceSellerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceLedgerEntry" ADD CONSTRAINT "MarketplaceLedgerEntry_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "MarketplaceOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceLedgerEntry" ADD CONSTRAINT "MarketplaceLedgerEntry_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "MarketplaceOrderItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceSellerBalance" ADD CONSTRAINT "MarketplaceSellerBalance_sellerProfileId_fkey" FOREIGN KEY ("sellerProfileId") REFERENCES "MarketplaceSellerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplacePaymentEvent" ADD CONSTRAINT "MarketplacePaymentEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "MarketplaceOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceCoupon" ADD CONSTRAINT "MarketplaceCoupon_sellerOrganizationId_fkey" FOREIGN KEY ("sellerOrganizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceCouponRedemption" ADD CONSTRAINT "MarketplaceCouponRedemption_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "MarketplaceCoupon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

