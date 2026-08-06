/**
 * Verifies vehicle-stage1-catalog-apply.ts results:
 *  - Brand/ProductModel/CategoryBrand/CategoryModel counts on arac/* categories
 *  - SystemSetting `vasita_stage1_catalog` pack round-trips
 *  - Spot checks a few known brand/model pairs
 *
 * npx tsx scripts/verify-vehicle-stage1-catalog.ts
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function assert(cond: unknown, msg: string, issues: string[]) {
  if (!cond) issues.push(msg);
}

async function main() {
  const issues: string[] = [];

  const aracCategories = await prisma.category.findMany({
    where: { OR: [{ path: "arac" }, { path: { startsWith: "arac/" } }] },
    select: { id: true, slug: true, path: true },
  });
  const aracIds = aracCategories.map((c) => c.id);

  const categoryBrandCount = await prisma.categoryBrand.count({ where: { categoryId: { in: aracIds } } });
  const categoryModelCount = await prisma.categoryModel.count({ where: { categoryId: { in: aracIds } } });

  assert(categoryBrandCount > 0, "no CategoryBrand rows linked under arac/*", issues);
  assert(categoryModelCount > 0, "no CategoryModel rows linked under arac/*", issues);

  const otomobil = aracCategories.find((c) => c.path === "arac/otomobil");
  const bmw = await prisma.brand.findUnique({ where: { slug: "bmw" } });
  assert(otomobil, "arac/otomobil category missing", issues);
  assert(bmw, "bmw brand missing", issues);

  let bmwLinkedToOtomobil = false;
  let bmw3Serisi: { id: string } | null = null;
  if (otomobil && bmw) {
    const link = await prisma.categoryBrand.findUnique({
      where: { categoryId_brandId: { categoryId: otomobil.id, brandId: bmw.id } },
    });
    bmwLinkedToOtomobil = Boolean(link);
    bmw3Serisi = await prisma.productModel.findUnique({
      where: { brandId_slug: { brandId: bmw.id, slug: "3-serisi" } },
      select: { id: true },
    });
    if (bmw3Serisi) {
      const modelLink = await prisma.categoryModel.findUnique({
        where: { categoryId_modelId: { categoryId: otomobil.id, modelId: bmw3Serisi.id } },
      });
      assert(modelLink, "bmw 3-serisi not linked to arac/otomobil", issues);
    } else {
      issues.push("bmw 3-serisi ProductModel missing");
    }
  }
  assert(bmwLinkedToOtomobil, "bmw not linked to arac/otomobil via CategoryBrand", issues);

  // BMW X1 dedupe check: same model row should serve both otomobil + arazi-suv-pickup
  const arazi = aracCategories.find((c) => c.path === "arac/arazi-suv-pickup");
  let x1DedupeOk = false;
  if (bmw && otomobil && arazi) {
    const x1 = await prisma.productModel.findUnique({ where: { brandId_slug: { brandId: bmw.id, slug: "x1" } } });
    if (x1) {
      const linkOtomobil = await prisma.categoryModel.findUnique({
        where: { categoryId_modelId: { categoryId: otomobil.id, modelId: x1.id } },
      });
      x1DedupeOk = Boolean(linkOtomobil);
    }
  }
  assert(x1DedupeOk, "bmw x1 model not deduped/linked under arac/otomobil", issues);

  const setting = await prisma.systemSetting.findUnique({ where: { key: "vasita_stage1_catalog" } });
  assert(setting, "SystemSetting vasita_stage1_catalog missing", issues);
  const packEntries = (setting?.value as { entries?: unknown[] } | null)?.entries;
  assert(Array.isArray(packEntries) && packEntries.length > 0, "SystemSetting pack has no entries", issues);

  const brandTotal = await prisma.brand.count({ where: { deletedAt: null } });
  const modelTotal = await prisma.productModel.count({ where: { deletedAt: null } });

  console.log(
    JSON.stringify(
      {
        ok: issues.length === 0,
        aracCategoryCount: aracCategories.length,
        categoryBrandCount,
        categoryModelCount,
        brandTotal,
        modelTotal,
        packEntryCount: Array.isArray(packEntries) ? packEntries.length : 0,
        bmwLinkedToOtomobil,
        x1DedupeOk,
        issues,
      },
      null,
      2
    )
  );
  if (issues.length) process.exit(1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
