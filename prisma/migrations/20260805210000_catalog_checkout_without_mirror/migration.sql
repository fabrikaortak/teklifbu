-- Faz 1.5: catalog checkout without mirror
-- EscrowDeal.listingId nullable + orderId/sellerOfferId
-- CatalogProjectionJob retry table
-- Soft backfill EscrowDeal.orderId / sellerOfferId
-- XOR constraint YOK

-- EscrowDeal columns
ALTER TABLE "EscrowDeal" ALTER COLUMN "listingId" DROP NOT NULL;

ALTER TABLE "EscrowDeal" ADD COLUMN IF NOT EXISTS "orderId" TEXT;
ALTER TABLE "EscrowDeal" ADD COLUMN IF NOT EXISTS "sellerOfferId" TEXT;

-- Drop old cascade FK on listingId and recreate as SET NULL
DO $$
DECLARE
  fk_name text;
BEGIN
  SELECT tc.constraint_name INTO fk_name
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
  WHERE tc.table_name = 'EscrowDeal'
    AND tc.constraint_type = 'FOREIGN KEY'
    AND kcu.column_name = 'listingId'
  LIMIT 1;
  IF fk_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE "EscrowDeal" DROP CONSTRAINT %I', fk_name);
  END IF;
END $$;

ALTER TABLE "EscrowDeal"
  ADD CONSTRAINT "EscrowDeal_listingId_fkey"
  FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS "EscrowDeal_orderId_key"
  ON "EscrowDeal" ("orderId");

CREATE INDEX IF NOT EXISTS "EscrowDeal_sellerOfferId_idx"
  ON "EscrowDeal" ("sellerOfferId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'EscrowDeal_orderId_fkey'
  ) THEN
    ALTER TABLE "EscrowDeal"
      ADD CONSTRAINT "EscrowDeal_orderId_fkey"
      FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'EscrowDeal_sellerOfferId_fkey'
  ) THEN
    ALTER TABLE "EscrowDeal"
      ADD CONSTRAINT "EscrowDeal_sellerOfferId_fkey"
      FOREIGN KEY ("sellerOfferId") REFERENCES "SellerOffer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Soft backfill: Order.escrowDealId → EscrowDeal.orderId
UPDATE "EscrowDeal" e
SET "orderId" = o.id
FROM "Order" o
WHERE o."escrowDealId" = e.id
  AND e."orderId" IS NULL;

-- Soft backfill sellerOfferId when exactly one consistent OrderItem
UPDATE "EscrowDeal" e
SET "sellerOfferId" = sub."sellerOfferId"
FROM (
  SELECT oi."orderId", MIN(oi."sellerOfferId") AS "sellerOfferId"
  FROM "OrderItem" oi
  GROUP BY oi."orderId"
  HAVING COUNT(*) = 1
     AND COUNT(DISTINCT oi."sellerOfferId") = 1
) sub
WHERE e."orderId" = sub."orderId"
  AND e."sellerOfferId" IS NULL;

-- CatalogProjectionJob
DO $$ BEGIN
  CREATE TYPE "CatalogProjectionJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "CatalogProjectionJob" (
  "id" TEXT NOT NULL,
  "jobType" TEXT NOT NULL,
  "sellerOfferId" TEXT,
  "listingId" TEXT,
  "payloadJson" JSONB,
  "status" "CatalogProjectionJobStatus" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 5,
  "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "CatalogProjectionJob_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CatalogProjectionJob_status_nextAttemptAt_idx"
  ON "CatalogProjectionJob" ("status", "nextAttemptAt");

CREATE INDEX IF NOT EXISTS "CatalogProjectionJob_sellerOfferId_jobType_status_idx"
  ON "CatalogProjectionJob" ("sellerOfferId", "jobType", "status");

CREATE INDEX IF NOT EXISTS "CatalogProjectionJob_listingId_idx"
  ON "CatalogProjectionJob" ("listingId");
