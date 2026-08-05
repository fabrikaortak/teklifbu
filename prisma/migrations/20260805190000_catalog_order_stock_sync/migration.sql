-- SellerOfferStatus: PENDING_REVIEW, REJECTED
ALTER TYPE "SellerOfferStatus" ADD VALUE IF NOT EXISTS 'PENDING_REVIEW';
ALTER TYPE "SellerOfferStatus" ADD VALUE IF NOT EXISTS 'REJECTED';

-- OrderStatus
CREATE TYPE "OrderStatus" AS ENUM (
  'PENDING_PAYMENT',
  'PAID',
  'SHIPPED',
  'COMPLETED',
  'CANCELLED',
  'REFUNDED',
  'DISPUTED'
);

-- SellerOffer moderation fields
ALTER TABLE "SellerOffer" ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3);
ALTER TABLE "SellerOffer" ADD COLUMN IF NOT EXISTS "approvedBy" TEXT;
CREATE INDEX IF NOT EXISTS "SellerOffer_approvedAt_idx" ON "SellerOffer"("approvedAt");

-- Order
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "orderNo" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "currency" TEXT NOT NULL DEFAULT 'TRY',
    "subtotal" BIGINT NOT NULL,
    "shippingTotal" BIGINT NOT NULL DEFAULT 0,
    "discountTotal" BIGINT NOT NULL DEFAULT 0,
    "taxTotal" BIGINT NOT NULL DEFAULT 0,
    "grandTotal" BIGINT NOT NULL,
    "escrowDealId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "cancelledAt" TIMESTAMP(3),

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Order_orderNo_key" ON "Order"("orderNo");
CREATE UNIQUE INDEX "Order_escrowDealId_key" ON "Order"("escrowDealId");
CREATE INDEX "Order_buyerId_createdAt_idx" ON "Order"("buyerId", "createdAt");
CREATE INDEX "Order_status_idx" ON "Order"("status");

-- OrderItem
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT,
    "variantId" TEXT,
    "sellerOfferId" TEXT NOT NULL,
    "listingId" TEXT,
    "shopId" TEXT,
    "sellerId" TEXT NOT NULL,
    "productNameSnapshot" TEXT NOT NULL,
    "variantTitleSnapshot" TEXT,
    "sellerNameSnapshot" TEXT NOT NULL,
    "shopNameSnapshot" TEXT,
    "sellerSkuSnapshot" TEXT,
    "productImageSnapshot" TEXT,
    "barcodeSnapshot" TEXT,
    "categoryPathSnapshot" TEXT,
    "invoiceAvailableSnapshot" BOOLEAN,
    "conditionSnapshot" TEXT,
    "unitPriceSnapshot" BIGINT NOT NULL,
    "discountedPriceSnapshot" BIGINT,
    "effectiveUnitPriceSnapshot" BIGINT NOT NULL,
    "shippingPriceSnapshot" BIGINT NOT NULL DEFAULT 0,
    "warrantyTypeSnapshot" TEXT,
    "warrantyMonthsSnapshot" INTEGER,
    "taxRateSnapshot" DOUBLE PRECISION,
    "quantity" INTEGER NOT NULL,
    "lineSubtotal" BIGINT NOT NULL,
    "lineShipping" BIGINT NOT NULL DEFAULT 0,
    "lineTax" BIGINT NOT NULL DEFAULT 0,
    "lineTotal" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");
CREATE INDEX "OrderItem_sellerOfferId_idx" ON "OrderItem"("sellerOfferId");
CREATE INDEX "OrderItem_sellerId_idx" ON "OrderItem"("sellerId");
CREATE INDEX "OrderItem_listingId_idx" ON "OrderItem"("listingId");
CREATE INDEX "OrderItem_productId_idx" ON "OrderItem"("productId");
CREATE INDEX "OrderItem_variantId_idx" ON "OrderItem"("variantId");

ALTER TABLE "Order" ADD CONSTRAINT "Order_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_escrowDealId_fkey" FOREIGN KEY ("escrowDealId") REFERENCES "EscrowDeal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_sellerOfferId_fkey" FOREIGN KEY ("sellerOfferId") REFERENCES "SellerOffer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
