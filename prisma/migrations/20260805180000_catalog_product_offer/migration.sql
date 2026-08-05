-- CreateEnum
CREATE TYPE "CatalogProductRequestStatus" AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'MERGED');

-- AlterTable Product
ALTER TABLE "Product" ADD COLUMN "mainImage" TEXT,
ADD COLUMN "barcode" TEXT,
ADD COLUMN "managedByAdmin" BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX "Product_barcode_idx" ON "Product"("barcode");
CREATE INDEX "Product_name_idx" ON "Product"("name");

-- AlterTable ProductVariant
ALTER TABLE "ProductVariant" ADD COLUMN "attributesHash" TEXT NOT NULL DEFAULT '';
CREATE UNIQUE INDEX "ProductVariant_productId_attributesHash_key" ON "ProductVariant"("productId", "attributesHash");
CREATE INDEX "ProductVariant_barcode_idx" ON "ProductVariant"("barcode");

-- AlterTable SellerOffer — empty table; tighten FKs
ALTER TABLE "SellerOffer" DROP CONSTRAINT IF EXISTS "SellerOffer_variantId_fkey";
ALTER TABLE "SellerOffer" DROP CONSTRAINT IF EXISTS "SellerOffer_shopId_fkey";

ALTER TABLE "SellerOffer" ALTER COLUMN "variantId" SET NOT NULL;
ALTER TABLE "SellerOffer" ALTER COLUMN "shopId" SET NOT NULL;

ALTER TABLE "SellerOffer" ADD COLUMN "sellerSku" TEXT,
ADD COLUMN "sellerNote" TEXT,
ADD COLUMN "shippingTimeDays" INTEGER,
ADD COLUMN "shippingPrice" BIGINT,
ADD COLUMN "invoiceAvailable" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "condition" TEXT;

ALTER TABLE "SellerOffer" ADD CONSTRAINT "SellerOffer_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SellerOffer" ADD CONSTRAINT "SellerOffer_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "SellerOffer_variantId_status_idx" ON "SellerOffer"("variantId", "status");
CREATE INDEX "SellerOffer_shopId_status_idx" ON "SellerOffer"("shopId", "status");

-- Partial unique: one ACTIVE offer per shop+variant
CREATE UNIQUE INDEX "SellerOffer_shop_variant_active_uidx"
ON "SellerOffer" ("shopId", "variantId")
WHERE "status" = 'ACTIVE' AND "deletedAt" IS NULL;

-- CreateTable CatalogProductRequest
CREATE TABLE "CatalogProductRequest" (
    "id" TEXT NOT NULL,
    "requesterUserId" TEXT NOT NULL,
    "shopId" TEXT,
    "categoryId" TEXT NOT NULL,
    "brandId" TEXT,
    "modelId" TEXT,
    "proposedName" TEXT NOT NULL,
    "barcode" TEXT,
    "description" TEXT,
    "attributesJson" JSONB,
    "imageUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "CatalogProductRequestStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "mergedProductId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CatalogProductRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CatalogProductRequest_status_createdAt_idx" ON "CatalogProductRequest"("status", "createdAt");
CREATE INDEX "CatalogProductRequest_requesterUserId_idx" ON "CatalogProductRequest"("requesterUserId");
CREATE INDEX "CatalogProductRequest_categoryId_idx" ON "CatalogProductRequest"("categoryId");
CREATE INDEX "CatalogProductRequest_brandId_idx" ON "CatalogProductRequest"("brandId");
CREATE INDEX "CatalogProductRequest_mergedProductId_idx" ON "CatalogProductRequest"("mergedProductId");

ALTER TABLE "CatalogProductRequest" ADD CONSTRAINT "CatalogProductRequest_requesterUserId_fkey" FOREIGN KEY ("requesterUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CatalogProductRequest" ADD CONSTRAINT "CatalogProductRequest_mergedProductId_fkey" FOREIGN KEY ("mergedProductId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
