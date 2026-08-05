-- CreateEnum
CREATE TYPE "CatalogModelMode" AS ENUM ('REQUIRED', 'OPTIONAL', 'DISABLED');

-- CreateEnum
CREATE TYPE "BrandInheritanceMode" AS ENUM ('NONE', 'MERGE', 'OVERRIDE');

-- CreateEnum
CREATE TYPE "CatalogRecordSource" AS ENUM ('SYSTEM_SEED', 'ADMIN');

-- AlterTable
ALTER TABLE "Category" ADD COLUMN "modelMode" "CatalogModelMode" NOT NULL DEFAULT 'OPTIONAL',
ADD COLUMN "brandInheritanceMode" "BrandInheritanceMode" NOT NULL DEFAULT 'NONE',
ADD COLUMN "managedBySeed" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "source" "CatalogRecordSource" NOT NULL DEFAULT 'SYSTEM_SEED';

-- AlterTable
ALTER TABLE "Brand" ADD COLUMN "managedBySeed" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "source" "CatalogRecordSource" NOT NULL DEFAULT 'SYSTEM_SEED';

-- AlterTable
ALTER TABLE "ProductModel" ADD COLUMN "managedBySeed" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "source" "CatalogRecordSource" NOT NULL DEFAULT 'SYSTEM_SEED';

-- AlterTable
ALTER TABLE "Attribute" ADD COLUMN "managedBySeed" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "source" "CatalogRecordSource" NOT NULL DEFAULT 'SYSTEM_SEED';

-- CreateIndex
CREATE INDEX "Category_managedBySeed_idx" ON "Category"("managedBySeed");

-- CreateIndex
CREATE INDEX "Brand_managedBySeed_idx" ON "Brand"("managedBySeed");

-- CreateIndex
CREATE INDEX "Attribute_managedBySeed_idx" ON "Attribute"("managedBySeed");
