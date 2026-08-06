/**
 * Dry-run for docs/vertical-taxonomy/vehicle-stage1-catalog.json → Brand/ProductModel/
 * CategoryBrand/CategoryModel. No writes. Reports what WOULD be created/updated/skipped.
 *
 * npx tsx scripts/vehicle-stage1-catalog-dry-run.ts
 */
import "dotenv/config";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type CatalogEntry = {
  categoryPaths: string[];
  brandSlug: string;
  brandName: string;
  modelSlug: string;
  modelName: string;
  verified: boolean;
  active: boolean;
};

async function main() {
  const pack = JSON.parse(
    readFileSync(join(process.cwd(), "docs/vertical-taxonomy/vehicle-stage1-catalog.json"), "utf8")
  );
  const entries: CatalogEntry[] = (pack.entries || []).filter((e: CatalogEntry) => e.verified === true);

  const brandSlugs = [...new Set(entries.map((e) => e.brandSlug))];
  const categoryPaths = [...new Set(entries.flatMap((e) => e.categoryPaths))];

  const existingBrands = await prisma.brand.findMany({
    where: { slug: { in: brandSlugs } },
    select: { slug: true, managedBySeed: true },
  });
  const existingBrandBySlug = new Map(existingBrands.map((b) => [b.slug, b]));

  const categories = await prisma.category.findMany({
    where: { path: { in: categoryPaths } },
    select: { id: true, path: true, slug: true },
  });
  const categoryByPath = new Map(categories.map((c) => [c.path, c]));

  const missingCategories = categoryPaths.filter((p) => !categoryByPath.has(p));

  const brandsToCreate: string[] = [];
  const brandsToUpdate: string[] = [];
  const brandsSkippedAdminEdited: string[] = [];
  for (const slug of brandSlugs) {
    const existing = existingBrandBySlug.get(slug);
    if (!existing) brandsToCreate.push(slug);
    else if (existing.managedBySeed === false) brandsSkippedAdminEdited.push(slug);
    else brandsToUpdate.push(slug);
  }

  let modelCount = 0;
  let categoryModelLinks = 0;
  let categoryBrandLinks = 0;
  const brandCategoryPairs = new Set<string>();
  for (const e of entries) {
    modelCount += 1;
    for (const cp of e.categoryPaths) {
      categoryModelLinks += 1;
      const pairKey = `${e.brandSlug}::${cp}`;
      if (!brandCategoryPairs.has(pairKey)) {
        brandCategoryPairs.add(pairKey);
        categoryBrandLinks += 1;
      }
    }
  }

  const report = {
    ok: missingCategories.length === 0,
    dryRun: true,
    entries: entries.length,
    uniqueBrands: brandSlugs.length,
    brandsToCreate,
    brandsToUpdate,
    brandsSkippedAdminEdited,
    uniqueModelSlugPairs: modelCount,
    plannedCategoryBrandLinks: categoryBrandLinks,
    plannedCategoryModelLinks: categoryModelLinks,
    categoryPaths,
    missingCategories,
    at: new Date().toISOString(),
  };

  mkdirSync(join(process.cwd(), "scripts/output"), { recursive: true });
  const out = join(process.cwd(), "scripts/output/vehicle-stage1-catalog-dry-run.json");
  const outAlias = join(process.cwd(), "scripts/output/vehicle-stage1-catalog-dry-run-report.json");
  writeFileSync(out, JSON.stringify(report, null, 2));
  writeFileSync(outAlias, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ...report, out }, null, 2));
  if (missingCategories.length) process.exit(1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
