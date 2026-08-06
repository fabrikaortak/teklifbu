/**
 * Applies docs/vertical-taxonomy/vehicle-stage1-catalog.json:
 *  - upserts Brand (by slug; skips if managedBySeed=false — admin-edited)
 *  - upserts ProductModel (by [brandId, slug])
 *  - links CategoryBrand (brand → Category resolved by path, e.g. arac/otomobil → arac__otomobil)
 *  - links CategoryModel (model → same Category)
 *  - stores the full catalog pack (+ generations/versions/years) in SystemSetting key
 *    `vasita_stage1_catalog` for the runtime cascade API (/api/vasita/catalog).
 * Only verified:true entries are applied. Idempotent.
 *
 * npx tsx scripts/vehicle-stage1-catalog-apply.ts
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
  generationCode: string;
  generationLabel: string;
  versions: Array<{ slug: string; name: string }>;
  modelYears: number[];
  fuelTypes: string[];
  transmissions: string[];
  bodyTypes: string[];
  source: string;
  verified: boolean;
  market: string;
  active: boolean;
};

function dbSlugFromPath(path: string): string {
  return path.includes("/") ? path.replace(/\//g, "__") : path;
}

async function main() {
  const pack = JSON.parse(
    readFileSync(join(process.cwd(), "docs/vertical-taxonomy/vehicle-stage1-catalog.json"), "utf8")
  );
  const entries: CatalogEntry[] = (pack.entries || []).filter((e: CatalogEntry) => e.verified === true);

  const report = {
    brandsCreated: [] as string[],
    brandsUpdated: [] as string[],
    brandsSkippedAdminEdited: [] as string[],
    modelsCreated: [] as string[],
    modelsUpdated: [] as string[],
    categoryBrandLinks: [] as string[],
    categoryModelLinks: [] as string[],
    missingCategories: [] as string[],
    errors: [] as string[],
  };

  const brandIdBySlug = new Map<string, string>();
  const categoryIdByPath = new Map<string, string>();

  const brandSlugs = [...new Set(entries.map((e) => e.brandSlug))];
  for (const slug of brandSlugs) {
    const nameFor = entries.find((e) => e.brandSlug === slug)!.brandName;
    const existing = await prisma.brand.findUnique({ where: { slug } });
    if (existing) {
      brandIdBySlug.set(slug, existing.id);
      if (existing.managedBySeed === false) {
        report.brandsSkippedAdminEdited.push(slug);
        continue;
      }
      await prisma.brand.update({
        where: { slug },
        data: { name: nameFor, isActive: true, managedBySeed: true, source: "SYSTEM_SEED" },
      });
      report.brandsUpdated.push(slug);
    } else {
      const created = await prisma.brand.create({
        data: { slug, name: nameFor, isActive: true, managedBySeed: true, source: "SYSTEM_SEED" },
      });
      brandIdBySlug.set(slug, created.id);
      report.brandsCreated.push(slug);
    }
  }

  const categoryPaths = [...new Set(entries.flatMap((e) => e.categoryPaths))];
  for (const path of categoryPaths) {
    const cat = await prisma.category.findFirst({
      where: { OR: [{ path }, { slug: dbSlugFromPath(path) }] },
      select: { id: true },
    });
    if (!cat) {
      report.missingCategories.push(path);
      continue;
    }
    categoryIdByPath.set(path, cat.id);
  }

  const brandCategoryLinked = new Set<string>();

  for (const e of entries) {
    try {
      const brandId = brandIdBySlug.get(e.brandSlug);
      if (!brandId) {
        report.errors.push(`${e.brandSlug}/${e.modelSlug}: brand not resolved (admin-edited skip?)`);
        continue;
      }

      const existingModel = await prisma.productModel.findUnique({
        where: { brandId_slug: { brandId, slug: e.modelSlug } },
      });
      let modelId: string;
      if (existingModel) {
        if (existingModel.managedBySeed === false) {
          modelId = existingModel.id;
        } else {
          const updated = await prisma.productModel.update({
            where: { id: existingModel.id },
            data: { name: e.modelName, isActive: true, managedBySeed: true, source: "SYSTEM_SEED" },
          });
          modelId = updated.id;
          report.modelsUpdated.push(`${e.brandSlug}/${e.modelSlug}`);
        }
      } else {
        const created = await prisma.productModel.create({
          data: {
            brandId,
            slug: e.modelSlug,
            name: e.modelName,
            isActive: true,
            managedBySeed: true,
            source: "SYSTEM_SEED",
          },
        });
        modelId = created.id;
        report.modelsCreated.push(`${e.brandSlug}/${e.modelSlug}`);
      }

      for (const categoryPath of e.categoryPaths) {
        const categoryId = categoryIdByPath.get(categoryPath);
        if (!categoryId) continue;

        const brandCatKey = `${brandId}::${categoryId}`;
        if (!brandCategoryLinked.has(brandCatKey)) {
          brandCategoryLinked.add(brandCatKey);
          await prisma.categoryBrand.upsert({
            where: { categoryId_brandId: { categoryId, brandId } },
            create: { categoryId, brandId, sortOrder: 0 },
            update: {},
          });
          report.categoryBrandLinks.push(`${e.brandSlug} → ${categoryPath}`);
        }

        await prisma.categoryModel.upsert({
          where: { categoryId_modelId: { categoryId, modelId } },
          create: { categoryId, modelId, sortOrder: 0 },
          update: {},
        });
        report.categoryModelLinks.push(`${e.brandSlug}/${e.modelSlug} → ${categoryPath}`);
      }
    } catch (err) {
      report.errors.push(`${e.brandSlug}/${e.modelSlug}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Runtime cascade pack (generations/versions/years) — read by /api/vasita/catalog.
  await prisma.systemSetting.upsert({
    where: { key: "vasita_stage1_catalog" },
    create: {
      key: "vasita_stage1_catalog",
      value: pack,
      label: "Vasıta Stage1 curated catalog pack",
      group: "vasita",
    },
    update: {
      value: pack,
      label: "Vasıta Stage1 curated catalog pack",
      group: "vasita",
    },
  });

  mkdirSync(join(process.cwd(), "scripts/output"), { recursive: true });
  const payload = { ...report, entriesApplied: entries.length, at: new Date().toISOString() };
  const out = join(process.cwd(), "scripts/output/vehicle-stage1-catalog-apply.json");
  const outAlias = join(process.cwd(), "scripts/output/vehicle-stage1-catalog-apply-report.json");
  writeFileSync(out, JSON.stringify(payload, null, 2));
  writeFileSync(outAlias, JSON.stringify(payload, null, 2));
  console.log(
    JSON.stringify(
      {
        ok: report.errors.length === 0 && report.missingCategories.length === 0,
        out,
        entriesApplied: entries.length,
        brandsCreated: report.brandsCreated.length,
        brandsUpdated: report.brandsUpdated.length,
        brandsSkippedAdminEdited: report.brandsSkippedAdminEdited.length,
        modelsCreated: report.modelsCreated.length,
        modelsUpdated: report.modelsUpdated.length,
        categoryBrandLinks: report.categoryBrandLinks.length,
        categoryModelLinks: report.categoryModelLinks.length,
        missingCategories: report.missingCategories,
        errors: report.errors,
      },
      null,
      2
    )
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
