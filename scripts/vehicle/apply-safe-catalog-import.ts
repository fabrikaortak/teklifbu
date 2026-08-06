/**
 * Apply only CREATE_SAFE / UPDATE_NAME_SAFE / MOVE_SAFE (+ ensure KEEP links)
 * from scripts/output/vehicle-catalog-import-plan.json + planned pack.
 *
 * - Idempotent
 * - Single interactive transaction (rollback on error)
 * - Never truncates / never deletes listings / never touches MANUAL_REVIEW or CONFLICT
 * - Preserves Brand/ProductModel IDs (upsert by slug)
 *
 * npx tsx scripts/vehicle/apply-safe-catalog-import.ts --dry-run
 * npx tsx scripts/vehicle/apply-safe-catalog-import.ts --apply
 */
import "dotenv/config";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const ROOT = process.cwd();
const PLAN_PATH = join(ROOT, "scripts/output/vehicle-catalog-import-plan.json");
const PACK_PATH = join(ROOT, "scripts/output/vehicle-catalog-import-planned-pack.json");
const PLAN_CSV = join(ROOT, "docs/vehicle-import/catalog-import-plan.csv");
const STAGE1_PATH = join(ROOT, "docs/vertical-taxonomy/vehicle-stage1-catalog.json");

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

type PlanDecisionRow = {
  brand: string;
  series: string;
  decision: string;
  categoryPath?: string;
  brandSlug?: string;
  modelSlug?: string;
  existingId?: string;
  targetPath?: string;
};

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean);
  const headers = lines[0].split(",");
  // naive — plan CSV may contain commas in quoted fields; use prior JSON decisions preferentially
  return lines.slice(1).map((line) => {
    const cols = line.match(/("([^"]|"")*"|[^,]*)/g) || [];
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      let v = (cols[i] || "").trim();
      if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1).replace(/""/g, '"');
      obj[h] = v;
    });
    return obj;
  });
}

function dbSlugFromPath(path: string): string {
  return path.includes("/") ? path.replace(/\//g, "__") : path;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run") || !args.includes("--apply");
  if (!existsSync(PLAN_PATH) || !existsSync(PACK_PATH)) {
    throw new Error("Run validate-and-plan-catalog-import.ts first");
  }

  const planMeta = JSON.parse(readFileSync(PLAN_PATH, "utf8"));
  if (!planMeta.applyAllowed) {
    throw new Error("Plan applyAllowed=false — refusing to write");
  }
  if (planMeta.counts?.conflictTotal > 0) {
    console.warn(`[apply] conflictTotal=${planMeta.counts.conflictTotal} — those rows are skipped`);
  }

  const pack = JSON.parse(readFileSync(PACK_PATH, "utf8"));
  const entries: CatalogEntry[] = (pack.entries || []).filter((e: CatalogEntry) => e.verified === true);

  // Integrity: no fake generations
  for (const e of entries) {
    if (e.generationCode?.toLowerCase() === "default") {
      throw new Error(`Fake generationCode on ${e.brandSlug}/${e.modelSlug}`);
    }
    const gl = (e.generationLabel || "").toLowerCase();
    if (gl === "standart" || gl === "default" || gl === "genel") {
      throw new Error(`Fake generationLabel on ${e.brandSlug}/${e.modelSlug}`);
    }
  }

  const csvRows = existsSync(PLAN_CSV) ? parseCsv(readFileSync(PLAN_CSV, "utf8")) : [];
  const blockedKeys = new Set(
    csvRows
      .filter((r) => ["MANUAL_REVIEW", "CONFLICT", "SOURCE_INVALID", "SKIP_OVERLAY"].includes(r.decision))
      .map((r) => `${r.brand}|${r.series}`.toLocaleLowerCase("tr-TR"))
  );
  const moveKeys = new Set(
    csvRows.filter((r) => r.decision === "MOVE_SAFE").map((r) => `${r.brand}|${r.series}`.toLocaleLowerCase("tr-TR"))
  );

  const applyEntries = entries.filter((e) => {
    const k = `${e.brandName}|${e.modelName}`.toLocaleLowerCase("tr-TR");
    return !blockedKeys.has(k);
  });

  // Snapshot listing categoryIds (must not change)
  const listingSnap = await prisma.listing.findMany({
    where: { category: { path: { startsWith: "arac" } } },
    select: { id: true, categoryId: true },
  });

  const report = {
    dryRun,
    at: new Date().toISOString(),
    entriesInPack: entries.length,
    entriesApplied: applyEntries.length,
    brandsCreated: [] as string[],
    brandsUpdated: [] as string[],
    brandsSkippedAdmin: [] as string[],
    modelsCreated: [] as string[],
    modelsUpdated: [] as string[],
    modelsSkippedAdmin: [] as string[],
    categoryBrandLinks: 0,
    categoryModelLinks: 0,
    movesApplied: 0,
    missingCategories: [] as string[],
    listingCategoryIdChanges: 0,
    errors: [] as string[],
  };

  if (dryRun) {
    mkdirSync(join(ROOT, "scripts/output"), { recursive: true });
    writeFileSync(join(ROOT, "scripts/output/vehicle-catalog-import-apply-report.json"), JSON.stringify({ ...report, ok: true, note: "dry-run — no DB writes" }, null, 2));
    console.log(JSON.stringify({ ok: true, dryRun: true, wouldApply: applyEntries.length, brands: new Set(applyEntries.map((e) => e.brandSlug)).size }, null, 2));
    return;
  }

  // Preload categories
  const categoryPaths = [...new Set(applyEntries.flatMap((e) => e.categoryPaths))];
  const categoryIdByPath = new Map<string, string>();
  for (const path of categoryPaths) {
    const cat = await prisma.category.findFirst({
      where: { OR: [{ path }, { slug: dbSlugFromPath(path) }] },
      select: { id: true },
    });
    if (!cat) report.missingCategories.push(path);
    else categoryIdByPath.set(path, cat.id);
  }
  if (report.missingCategories.length) {
    throw new Error(`Missing categories: ${report.missingCategories.join(", ")}`);
  }

  // Backup stage1 before overwrite
  mkdirSync(join(ROOT, "docs/vehicle-import/backups"), { recursive: true });
  if (existsSync(STAGE1_PATH)) {
    copyFileSync(STAGE1_PATH, join(ROOT, "docs/vehicle-import/backups", `vehicle-stage1-catalog-pre-apply-${Date.now()}.json`));
  }

  await prisma.$transaction(
    async (tx) => {
      const brandIdBySlug = new Map<string, string>();
      const brandSlugs = [...new Set(applyEntries.map((e) => e.brandSlug))];

      for (const slug of brandSlugs) {
        const nameFor = applyEntries.find((e) => e.brandSlug === slug)!.brandName;
        const existing = await tx.brand.findUnique({ where: { slug } });
        if (existing) {
          brandIdBySlug.set(slug, existing.id);
          if (existing.managedBySeed === false) {
            report.brandsSkippedAdmin.push(slug);
            continue;
          }
          await tx.brand.update({
            where: { slug },
            data: { name: nameFor, isActive: true, managedBySeed: true, source: "SYSTEM_SEED" },
          });
          report.brandsUpdated.push(slug);
        } else {
          const created = await tx.brand.create({
            data: { slug, name: nameFor, isActive: true, managedBySeed: true, source: "SYSTEM_SEED" },
          });
          brandIdBySlug.set(slug, created.id);
          report.brandsCreated.push(slug);
        }
      }

      const brandCatLinked = new Set<string>();

      for (const e of applyEntries) {
        const brandId = brandIdBySlug.get(e.brandSlug);
        if (!brandId) {
          report.errors.push(`${e.brandSlug}: skipped (admin brand)`);
          continue;
        }

        const existingModel = await tx.productModel.findUnique({
          where: { brandId_slug: { brandId, slug: e.modelSlug } },
        });

        let modelId: string;
        if (existingModel) {
          modelId = existingModel.id;
          if (existingModel.managedBySeed === false) {
            report.modelsSkippedAdmin.push(`${e.brandSlug}/${e.modelSlug}`);
          } else if (existingModel.name !== e.modelName) {
            await tx.productModel.update({
              where: { id: existingModel.id },
              data: { name: e.modelName, isActive: true, managedBySeed: true, source: "SYSTEM_SEED" },
            });
            report.modelsUpdated.push(`${e.brandSlug}/${e.modelSlug}`);
          }
        } else {
          const created = await tx.productModel.create({
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

        const moveKey = `${e.brandName}|${e.modelName}`.toLocaleLowerCase("tr-TR");
        const isMove = moveKeys.has(moveKey);

        for (const categoryPath of e.categoryPaths) {
          const categoryId = categoryIdByPath.get(categoryPath);
          if (!categoryId) continue;

          const bk = `${brandId}::${categoryId}`;
          if (!brandCatLinked.has(bk)) {
            brandCatLinked.add(bk);
            await tx.categoryBrand.upsert({
              where: { categoryId_brandId: { categoryId, brandId } },
              create: { categoryId, brandId, sortOrder: 0 },
              update: {},
            });
            report.categoryBrandLinks++;
          }

          await tx.categoryModel.upsert({
            where: { categoryId_modelId: { categoryId, modelId } },
            create: { categoryId, modelId, sortOrder: 0 },
            update: {},
          });
          report.categoryModelLinks++;
        }

        if (isMove) {
          // Remove other arac/* CategoryModel links except targets (safe: relationCount gate already in plan)
          const targets = new Set(e.categoryPaths);
          const links = await tx.categoryModel.findMany({
            where: { modelId, category: { path: { startsWith: "arac/" } } },
            include: { category: { select: { path: true } } },
          });
          for (const link of links) {
            const path = link.category.path || "";
            if (!targets.has(path)) {
              await tx.categoryModel.delete({
                where: { categoryId_modelId: { categoryId: link.categoryId, modelId } },
              });
              report.movesApplied++;
            }
          }
        }
      }

      await tx.systemSetting.upsert({
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
    },
    { timeout: 300_000 }
  );

  writeFileSync(STAGE1_PATH, JSON.stringify(pack, null, 2), "utf8");

  const after = await prisma.listing.findMany({
    where: { id: { in: listingSnap.map((l) => l.id) } },
    select: { id: true, categoryId: true },
  });
  const beforeMap = new Map(listingSnap.map((l) => [l.id, l.categoryId]));
  for (const a of after) {
    if (beforeMap.get(a.id) !== a.categoryId) report.listingCategoryIdChanges++;
  }
  if (report.listingCategoryIdChanges > 0) {
    throw new Error(`Listing categoryId changed for ${report.listingCategoryIdChanges} rows — unexpected`);
  }

  writeFileSync(join(ROOT, "scripts/output/vehicle-catalog-import-apply-report.json"), JSON.stringify({ ok: true, ...report }, null, 2));
  console.log(
    JSON.stringify(
      {
        ok: true,
        dryRun: false,
        brandsCreated: report.brandsCreated.length,
        brandsUpdated: report.brandsUpdated.length,
        modelsCreated: report.modelsCreated.length,
        modelsUpdated: report.modelsUpdated.length,
        categoryBrandLinks: report.categoryBrandLinks,
        categoryModelLinks: report.categoryModelLinks,
        movesApplied: report.movesApplied,
        listingCategoryIdChanges: report.listingCategoryIdChanges,
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
