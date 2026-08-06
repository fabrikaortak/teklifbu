/**
 * Apply complete Vasıta catalog fixes (empty brands, manual series, electric overlay).
 * Idempotent. Transactional. Preserves listing categoryIds.
 *
 * npx tsx scripts/vehicle/apply-complete-vehicle-catalog.ts --dry-run
 * npx tsx scripts/vehicle/apply-complete-vehicle-catalog.ts --apply
 */
import "dotenv/config";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const ROOT = process.cwd();
const DATA = join(ROOT, "docs/vehicle-import/data");
const STAGE1 = join(ROOT, "docs/vertical-taxonomy/vehicle-stage1-catalog.json");
const PLAN = join(ROOT, "scripts/output/complete-vehicle-catalog-plan.json");
const DEFAULT_YEARS = [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026];

type PackEntry = {
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

function packKey(e: PackEntry) {
  return `${e.categoryPaths[0]}|${e.brandSlug}|${e.modelSlug}|${e.generationCode}`;
}

async function ensureBrand(tx: PrismaClient, slug: string, name: string, isActive: boolean) {
  const existing = await tx.brand.findUnique({ where: { slug } });
  if (existing) {
    if (existing.managedBySeed === false) return existing;
    return tx.brand.update({
      where: { slug },
      data: { name, isActive, managedBySeed: true, source: "SYSTEM_SEED" },
    });
  }
  return tx.brand.create({
    data: { slug, name, isActive, managedBySeed: true, source: "SYSTEM_SEED" },
  });
}

async function ensureModel(tx: PrismaClient, brandId: string, slug: string, name: string) {
  const existing = await tx.productModel.findUnique({ where: { brandId_slug: { brandId, slug } } });
  if (existing) {
    if (existing.managedBySeed === false) return existing;
    if (existing.name !== name || !existing.isActive) {
      return tx.productModel.update({
        where: { id: existing.id },
        data: { name, isActive: true, managedBySeed: true, source: "SYSTEM_SEED" },
      });
    }
    return existing;
  }
  return tx.productModel.create({
    data: { brandId, slug, name, isActive: true, managedBySeed: true, source: "SYSTEM_SEED" },
  });
}

async function ensureCategoryLinks(tx: PrismaClient, categoryPath: string, brandId: string, modelId: string) {
  const cat = await tx.category.findFirst({
    where: { OR: [{ path: categoryPath }, { slug: categoryPath.replace(/\//g, "__") }] },
    select: { id: true },
  });
  if (!cat) throw new Error(`missing category ${categoryPath}`);
  await tx.categoryBrand.upsert({
    where: { categoryId_brandId: { categoryId: cat.id, brandId } },
    create: { categoryId: cat.id, brandId, sortOrder: 0 },
    update: {},
  });
  await tx.categoryModel.upsert({
    where: { categoryId_modelId: { categoryId: cat.id, modelId } },
    create: { categoryId: cat.id, modelId, sortOrder: 0 },
    update: {},
  });
  return cat.id;
}

async function unlinkOtherAracCategories(tx: PrismaClient, modelId: string, keepPaths: string[]) {
  const keep = new Set(keepPaths);
  const links = await tx.categoryModel.findMany({
    where: { modelId, category: { path: { startsWith: "arac/" } } },
    include: { category: { select: { path: true } } },
  });
  for (const link of links) {
    const path = link.category.path || "";
    if (!keep.has(path)) {
      await tx.categoryModel.delete({
        where: { categoryId_modelId: { categoryId: link.categoryId, modelId } },
      });
    }
  }
}

function upsertPackEntry(map: Map<string, PackEntry>, entry: PackEntry) {
  const k = packKey(entry);
  const prev = map.get(k);
  if (!prev) {
    map.set(k, entry);
    return;
  }
  const versions = [...(prev.versions || [])];
  for (const v of entry.versions || []) {
    if (!versions.find((x) => x.slug === v.slug)) versions.push(v);
  }
  const fuelTypes = [...new Set([...(prev.fuelTypes || []), ...(entry.fuelTypes || [])])];
  map.set(k, { ...prev, ...entry, versions, fuelTypes });
}

async function main() {
  const args = process.argv.slice(2);
  const doApply = args.includes("--apply");
  const dryRun = !doApply || args.includes("--dry-run");

  if (!existsSync(PLAN)) {
    throw new Error("Run plan-complete-vehicle-catalog.ts first");
  }
  const planMeta = JSON.parse(readFileSync(PLAN, "utf8"));
  if (!planMeta.plan?.applyAllowed) throw new Error("plan.applyAllowed=false");

  const emptyRes = JSON.parse(readFileSync(join(DATA, "empty-brand-resolution.json"), "utf8"));
  const electricMap = JSON.parse(readFileSync(join(DATA, "electric-canonical-map.json"), "utf8"));
  const pack = JSON.parse(readFileSync(STAGE1, "utf8").replace(/^\uFEFF/, ""));
  const packMap = new Map<string, PackEntry>();
  for (const e of pack.entries || []) upsertPackEntry(packMap, e);

  const listingBefore = await prisma.listing.findMany({
    where: { category: { path: { startsWith: "arac" } } },
    select: { id: true, categoryId: true },
  });

  const report = {
    dryRun,
    at: new Date().toISOString(),
    brandsHidden: 0,
    brandsFilled: 0,
    seriesCreated: 0,
    modelsUpdated: 0,
    electricCanonicalCreated: 0,
    electricLinked: 0,
    fuelTypeUpdated: 0,
    manualApplied: 0,
    listingCategoryIdChanges: 0,
    errors: [] as string[],
  };

  if (dryRun) {
    writeFileSync(join(ROOT, "scripts/output/complete-vehicle-catalog-apply-report.json"), JSON.stringify({ ...report, ok: true }, null, 2));
    console.log(JSON.stringify({ ok: true, dryRun: true, wouldProcess: { empty: emptyRes.brands.length, electric: electricMap.entries.length, manual: 6 } }, null, 2));
    return;
  }

  mkdirSync(join(ROOT, "docs/vehicle-import/backups"), { recursive: true });
  copyFileSync(STAGE1, join(ROOT, "docs/vehicle-import/backups", `vehicle-stage1-catalog-pre-apply-complete-${Date.now()}.json`));

  await prisma.$transaction(
    async (tx) => {
      // 1) Empty brands
      for (const b of emptyRes.brands) {
        if (b.action === "HIDE") {
          const brand = await ensureBrand(tx as unknown as PrismaClient, b.brandSlug, b.brandName, false);
          // ensure inactive
          await tx.brand.update({ where: { id: brand.id }, data: { isActive: false } });
          report.brandsHidden++;
          continue;
        }
        const brand = await ensureBrand(tx as unknown as PrismaClient, b.brandSlug, b.brandName, true);
        report.brandsFilled++;
        for (const s of b.series || []) {
          const model = await ensureModel(tx as unknown as PrismaClient, brand.id, s.slug, s.name);
          await ensureCategoryLinks(tx as unknown as PrismaClient, b.categoryPath, brand.id, model.id);
          report.seriesCreated++;
          upsertPackEntry(packMap, {
            categoryPaths: [b.categoryPath],
            brandSlug: b.brandSlug,
            brandName: b.brandName,
            modelSlug: s.slug,
            modelName: s.name,
            generationCode: "",
            generationLabel: "",
            versions: s.versions?.length ? s.versions : [{ slug: s.slug, name: s.name }],
            modelYears: DEFAULT_YEARS,
            fuelTypes: [],
            transmissions: [],
            bodyTypes: [],
            source: "empty-brand-fill-2026.08",
            verified: true,
            market: "TR",
            active: true,
          });
        }
      }

      // 2) Manual series
      const manuals = [
        { brandSlug: "cupra", seriesSlug: "formentor", brandName: "Cupra", seriesName: "Formentor", keep: ["arac/arazi-suv-pickup"] },
        { brandSlug: "mg", seriesSlug: "hs", brandName: "MG", seriesName: "HS", keep: ["arac/arazi-suv-pickup"] },
        { brandSlug: "mg", seriesSlug: "zs", brandName: "MG", seriesName: "ZS", keep: ["arac/arazi-suv-pickup"] },
        { brandSlug: "mercedes-benz", seriesSlug: "vito", brandName: "Mercedes-Benz", seriesName: "Vito", keep: ["arac/minivan-panelvan"] },
        {
          brandSlug: "iveco",
          seriesSlug: "daily",
          brandName: "Iveco",
          seriesName: "Daily",
          keep: ["arac/minivan-panelvan", "arac/ticari-araclar"],
        },
        {
          brandSlug: "volkswagen",
          seriesSlug: "crafter",
          brandName: "Volkswagen",
          seriesName: "Crafter",
          keep: ["arac/minivan-panelvan", "arac/ticari-araclar"],
        },
      ];
      for (const m of manuals) {
        const brand = await ensureBrand(tx as unknown as PrismaClient, m.brandSlug, m.brandName, true);
        const model = await ensureModel(tx as unknown as PrismaClient, brand.id, m.seriesSlug, m.seriesName);
        for (const cp of m.keep) {
          await ensureCategoryLinks(tx as unknown as PrismaClient, cp, brand.id, model.id);
          upsertPackEntry(packMap, {
            categoryPaths: [cp],
            brandSlug: m.brandSlug,
            brandName: m.brandName,
            modelSlug: m.seriesSlug,
            modelName: m.seriesName,
            generationCode: "",
            generationLabel: "",
            versions: [{ slug: m.seriesSlug, name: m.seriesName }],
            modelYears: DEFAULT_YEARS,
            fuelTypes: [],
            transmissions: [],
            bodyTypes: [],
            source: "manual-review-final-2026.08",
            verified: true,
            market: "TR",
            active: true,
          });
        }
        await unlinkOtherAracCategories(tx as unknown as PrismaClient, model.id, m.keep);
        report.manualApplied++;
      }

      // 3) Electric canonical + overlay
      const overlayEntries: Array<Record<string, unknown>> = [];
      for (const e of electricMap.entries) {
        const brand = await ensureBrand(tx as unknown as PrismaClient, e.brandSlug, e.brandName, true);
        const before = await tx.productModel.findUnique({
          where: { brandId_slug: { brandId: brand.id, slug: e.seriesSlug } },
        });
        const model = await ensureModel(tx as unknown as PrismaClient, brand.id, e.seriesSlug, e.seriesName);
        if (!before) report.electricCanonicalCreated++;
        else report.electricLinked++;
        await ensureCategoryLinks(tx as unknown as PrismaClient, e.canonicalCategoryPath, brand.id, model.id);

        const versions = e.versions?.length ? e.versions : [{ slug: e.seriesSlug, name: e.seriesName }];
        upsertPackEntry(packMap, {
          categoryPaths: [e.canonicalCategoryPath],
          brandSlug: e.brandSlug,
          brandName: e.brandName,
          modelSlug: e.seriesSlug,
          modelName: e.seriesName,
          generationCode: "",
          generationLabel: "",
          versions,
          modelYears: DEFAULT_YEARS,
          fuelTypes: ["ELECTRIC"],
          transmissions: [],
          bodyTypes: [],
          source: "electric-canonical-2026.08",
          verified: true,
          market: "TR",
          active: true,
        });
        report.fuelTypeUpdated++;

        overlayEntries.push({
          electricVehicleType: e.electricVehicleType,
          brandSlug: e.brandSlug,
          brandName: e.brandName,
          modelSlug: e.seriesSlug,
          modelName: e.seriesName,
          canonicalCategoryPath: e.canonicalCategoryPath,
          fuelTypes: ["ELECTRIC"],
          versions,
          active: true,
          selectable: true,
        });
      }

      const newPack = {
        ...pack,
        version: "vehicle-stage1-catalog-v4-complete",
        generatedAt: new Date().toISOString().slice(0, 10),
        source: "complete-vehicle-catalog-2026.08",
        notes: [
          ...(pack.notes || []),
          "v4 complete: empty brands filled/hidden, manual series finalized, electric overlay + fuelTypes ELECTRIC on pure EV series.",
        ],
        entries: [...packMap.values()],
      };

      const electricOverlay = {
        version: electricMap.version || "2026.08-complete-v1",
        generatedAt: new Date().toISOString(),
        vehicleTypes: electricMap.vehicleTypes,
        entries: overlayEntries,
      };

      await tx.systemSetting.upsert({
        where: { key: "vasita_stage1_catalog" },
        create: { key: "vasita_stage1_catalog", value: newPack, label: "Vasıta Stage1 catalog pack", group: "vasita" },
        update: { value: newPack },
      });
      await tx.systemSetting.upsert({
        where: { key: "vasita_electric_overlay" },
        create: {
          key: "vasita_electric_overlay",
          value: electricOverlay,
          label: "Vasıta electric overlay mapping",
          group: "vasita",
        },
        update: { value: electricOverlay },
      });

      writeFileSync(STAGE1, JSON.stringify(newPack, null, 2));
      writeFileSync(join(ROOT, "docs/vehicle-import/data/electric-overlay-runtime.json"), JSON.stringify(electricOverlay, null, 2));
    },
    { timeout: 600_000 }
  );

  const listingAfter = await prisma.listing.findMany({
    where: { id: { in: listingBefore.map((l) => l.id) } },
    select: { id: true, categoryId: true },
  });
  const beforeMap = new Map(listingBefore.map((l) => [l.id, l.categoryId]));
  for (const a of listingAfter) {
    if (beforeMap.get(a.id) !== a.categoryId) report.listingCategoryIdChanges++;
  }
  if (report.listingCategoryIdChanges > 0) {
    throw new Error(`Unexpected listing categoryId changes: ${report.listingCategoryIdChanges}`);
  }

  writeFileSync(join(ROOT, "scripts/output/complete-vehicle-catalog-apply-report.json"), JSON.stringify({ ok: true, ...report }, null, 2));
  console.log(JSON.stringify({ ok: true, dryRun: false, ...report }, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
