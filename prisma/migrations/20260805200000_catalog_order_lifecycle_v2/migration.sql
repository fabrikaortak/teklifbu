-- Catalog Order lifecycle v2: paidAt, expiresAt, idempotency, stock release idempotency
-- Faz 1 — mirror/escrow listingId değişmez

ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "paidAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "paymentId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Order_buyerId_idempotencyKey_key"
  ON "Order" ("buyerId", "idempotencyKey");

CREATE INDEX IF NOT EXISTS "Order_status_expiresAt_idx"
  ON "Order" ("status", "expiresAt");

ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "stockReleasedAt" TIMESTAMP(3);
ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "stockReservedQty" INTEGER;

ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "providerTransactionId" TEXT;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "paidAt" TIMESTAMP(3);
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "Payment_providerTransactionId_key"
  ON "Payment" ("providerTransactionId");
