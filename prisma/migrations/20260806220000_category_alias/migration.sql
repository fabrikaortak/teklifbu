-- CategoryAlias: eski slug → kanonik Category (Vasıta Stage1 legacy-subtype-* + taxonomy SEO)
-- Table may already exist from earlier db push; IF NOT EXISTS keeps apply idempotent.

CREATE TABLE IF NOT EXISTS "CategoryAlias" (
    "id" TEXT NOT NULL,
    "oldSlug" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "redirectType" TEXT NOT NULL DEFAULT 'INTERNAL_ALIAS',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CategoryAlias_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CategoryAlias_oldSlug_key" ON "CategoryAlias"("oldSlug");
CREATE INDEX IF NOT EXISTS "CategoryAlias_categoryId_idx" ON "CategoryAlias"("categoryId");
CREATE INDEX IF NOT EXISTS "CategoryAlias_active_idx" ON "CategoryAlias"("active");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CategoryAlias_categoryId_fkey'
  ) THEN
    ALTER TABLE "CategoryAlias"
      ADD CONSTRAINT "CategoryAlias_categoryId_fkey"
      FOREIGN KEY ("categoryId") REFERENCES "Category"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
