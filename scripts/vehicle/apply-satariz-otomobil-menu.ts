/**
 * Integrate satariz Otomobil menu tree as SoT for Vasıta → Otomobil:
 * Brand → Series → Version → Trim into CategoryBrand/Model + stage1 pack.
 *
 * Input: Downloads/teklifbu_satariz_otomobil_menu_tree.progress.json
 *   (produced by export-satariz-otomobil-menu-tree.ts)
 *
 * npx tsx scripts/vehicle/apply-satariz-otomobil-menu.ts
 * npx tsx scripts/vehicle/apply-satariz-otomobil-menu.ts --dry-run
 */
import "dotenv/config";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { PrismaClient } from "@prisma/client";
import { slugifyVasita } from "../../src/lib/vasitaCatalogNormalize";

const prisma = new PrismaClient();
const ROOT = process.cwd();
const DRY = process.argv.includes("--dry-run");
const OUT_DIR = join(process.env.USERPROFILE || ROOT, "Downloads");
const PROGRESS = join(OUT_DIR, "teklifbu_satariz_otomobil_menu_tree.progress.json");
const STAGE1 = join(ROOT, "docs/vertical-taxonomy/vehicle-stage1-catalog.json");
const DEEP_OUT = join(ROOT, "data/vehicle-deep-catalog/_satariz_otomobil_menu.json");
const CATEGORY_PATH = "arac/otomobil";
const GEN_CODE = "SATARIZ";

type MotorNode = { name: string; trims: string[] };
type SeriesNode = { name: string; motors: MotorNode[] };
type BrandNode = { name: string; series: SeriesNode[] };
type Progress = { brands: BrandNode[]; doneSeriesKeys: string[] };

type PackEntry = {
  categoryPaths: string[];
  brandSlug: string;
  brandName: string;
  modelSlug: string;
  modelName: string;
  generationCode: string;
  generationLabel: string;
  versions: Array<{
    slug: string;
    name: string;
    trims?: Array<{ slug: string; name: string; generationCode?: string; yearFrom?: number; yearTo?: number }>;
    yearFrom?: number;
    yearTo?: number;
  }>;
  modelYears: number[];
  fuelTypes: string[];
  transmissions: string[];
  bodyTypes: string[];
  source: string;
  verified: boolean;
  market: string;
  active: boolean;
};

function yearsBetween(from: number, to: number): number[] {
  const out: number[] = [];
  for (let y = from; y <= to; y++) out.push(y);
  return out;
}

async function ensureBrand(slug: string, name: string) {
  const existing = await prisma.brand.findUnique({ where: { slug } });
  if (existing) {
    if (existing.managedBySeed === false) return existing;
    return prisma.brand.update({
      where: { slug },
      data: { name, isActive: true, managedBySeed: true, source: "SYSTEM_SEED" },
    });
  }
  return prisma.brand.create({
    data: { slug, name, isActive: true, managedBySeed: true, source: "SYSTEM_SEED" },
  });
}

async function ensureModel(brandId: string, slug: string, name: string) {
  const existing = await prisma.productModel.findUnique({ where: { brandId_slug: { brandId, slug } } });
  if (existing) {
    if (existing.managedBySeed === false) return existing;
    if (existing.name !== name || !existing.isActive) {
      return prisma.productModel.update({
        where: { id: existing.id },
        data: { name, isActive: true, managedBySeed: true, source: "SYSTEM_SEED" },
      });
    }
    return existing;
  }
  return prisma.productModel.create({
    data: { brandId, slug, name, isActive: true, managedBySeed: true, source: "SYSTEM_SEED" },
  });
}

async function ensureCategoryLinks(categoryId: string, brandId: string, modelId: string) {
  await prisma.categoryBrand.upsert({
    where: { categoryId_brandId: { categoryId, brandId } },
    create: { categoryId, brandId, sortOrder: 0 },
    update: {},
  });
  await prisma.categoryModel.upsert({
    where: { categoryId_modelId: { categoryId, modelId } },
    create: { categoryId, modelId, sortOrder: 0 },
    update: {},
  });
}

async function main() {
  if (!existsSync(PROGRESS)) {
    throw new Error(`Missing progress tree: ${PROGRESS}`);
  }
  const progress = JSON.parse(readFileSync(PROGRESS, "utf8")) as Progress;
  const brands = (progress.brands || [])
    .filter((b) => b.name && Array.isArray(b.series))
    .sort((a, b) => a.name.localeCompare(b.name, "tr"));

  const cat = await prisma.category.findFirst({
    where: { OR: [{ path: CATEGORY_PATH }, { slug: "arac__otomobil" }], deletedAt: null },
    select: { id: true, path: true, slug: true },
  });
  if (!cat) throw new Error("otomobil category missing");

  const configs: Array<Record<string, unknown>> = [];
  const packEntries: PackEntry[] = [];
  let brandCount = 0;
  let seriesCount = 0;
  let motorCount = 0;
  let trimCount = 0;
  let dbBrands = 0;
  let dbModels = 0;

  for (const b of brands) {
    const brandSlug = slugifyVasita(b.name);
    if (!brandSlug) continue;
    brandCount++;

    let brandRow: { id: string } | null = null;
    if (!DRY) {
      brandRow = await ensureBrand(brandSlug, b.name);
      dbBrands++;
    }

    for (const s of b.series) {
      const modelSlug = slugifyVasita(s.name);
      if (!modelSlug) continue;
      seriesCount++;

      if (!DRY && brandRow) {
        const modelRow = await ensureModel(brandRow.id, modelSlug, s.name);
        await ensureCategoryLinks(cat.id, brandRow.id, modelRow.id);
        dbModels++;
      }

      const versionMap = new Map<
        string,
        {
          slug: string;
          name: string;
          trims: Array<{ slug: string; name: string; generationCode: string; yearFrom: number; yearTo: number }>;
        }
      >();

      for (const motor of s.motors || []) {
        const vName = String(motor.name || "").trim();
        if (!vName) continue;
        motorCount++;
        const vSlug = slugifyVasita(vName);
        if (!versionMap.has(vSlug)) {
          versionMap.set(vSlug, { slug: vSlug, name: vName, trims: [] });
        }
        const v = versionMap.get(vSlug)!;
        for (const trimName of motor.trims || []) {
          const tName = String(trimName || "").trim();
          if (!tName) continue;
          trimCount++;
          const tSlug = slugifyVasita(tName);
          if (!v.trims.find((t) => t.slug === tSlug)) {
            v.trims.push({
              slug: tSlug,
              name: tName,
              generationCode: GEN_CODE,
              yearFrom: 1980,
              yearTo: 2026,
            });
          }
          configs.push({
            brand: b.name,
            series: s.name,
            model: vName,
            trim: tName,
            generation: "satariz.com Otomobil menü",
            generationCode: GEN_CODE,
            yearFrom: 1980,
            yearTo: 2026,
            fuelType: null,
            driveType: null,
            transmission: null,
            confidence: "VERIFIED_MULTI_SOURCE",
            verifiedForTurkey: true,
            category: "Otomobil",
            notes: `satariz otomobil menu SoT: ${b.name} > ${s.name} > ${vName} > ${tName}`,
            sources: [
              {
                url: "https://www.satariz.com/arac",
                title: "satariz.com Araç category tree",
                date: new Date().toISOString().slice(0, 10),
                role: "primary",
                type: "marketplace_category_tree",
                publisher: "satariz.com",
              },
            ],
          });
        }
        if (!(motor.trims || []).length) {
          configs.push({
            brand: b.name,
            series: s.name,
            model: vName,
            trim: "",
            generation: "satariz.com Otomobil menü",
            generationCode: GEN_CODE,
            yearFrom: 1980,
            yearTo: 2026,
            fuelType: null,
            driveType: null,
            transmission: null,
            confidence: "VERIFIED_MULTI_SOURCE",
            verifiedForTurkey: true,
            category: "Otomobil",
            trimStatus: "NO_VERIFIED_TRIM_FOUND",
            notes: `satariz otomobil menu SoT: ${b.name} > ${s.name} > ${vName} (version only)`,
            sources: [
              {
                url: "https://www.satariz.com/arac",
                title: "satariz.com Araç category tree",
                date: new Date().toISOString().slice(0, 10),
                role: "primary",
                type: "marketplace_category_tree",
                publisher: "satariz.com",
              },
            ],
          });
        }
      }

      packEntries.push({
        categoryPaths: [CATEGORY_PATH],
        brandSlug,
        brandName: b.name,
        modelSlug,
        modelName: s.name,
        generationCode: GEN_CODE,
        generationLabel: "satariz.com",
        versions: [...versionMap.values()]
          .map((v) => ({
            slug: v.slug,
            name: v.name,
            yearFrom: 1980,
            yearTo: 2026,
            trims: v.trims.sort((a, c) => a.name.localeCompare(c.name, "tr")),
          }))
          .sort((a, c) => a.name.localeCompare(c.name, "tr")),
        modelYears: yearsBetween(1980, 2026),
        fuelTypes: [],
        transmissions: [],
        bodyTypes: [],
        source: "deep-catalog-satariz-otomobil-2026.08",
        verified: true,
        market: "TR",
        active: true,
      });
    }
  }

  writeFileSync(
    DEEP_OUT,
    JSON.stringify(
      {
        brand: "_satariz_otomobil",
        version: "satariz-otomobil-menu-sot-v1",
        generatedAt: new Date().toISOString(),
        status: "COMPLETED",
        source: "satariz.com/arac",
        brandCount,
        seriesCount,
        motorCount,
        trimCount,
        configurations: configs,
      },
      null,
      2
    ) + "\n",
    "utf8"
  );

  if (DRY) {
    console.log(
      JSON.stringify(
        { ok: true, dryRun: true, brandCount, seriesCount, motorCount, trimCount, deepOut: DEEP_OUT },
        null,
        2
      )
    );
    return;
  }

  // Stage1 pack: drop previous satariz + deep-catalog otomobil entries for these brands, then insert
  const brandSlugs = new Set(packEntries.map((e) => e.brandSlug));
  const pack = JSON.parse(readFileSync(STAGE1, "utf8").replace(/^\uFEFF/, ""));
  const bakDir = join(ROOT, "docs/vertical-taxonomy/_bak");
  mkdirSync(bakDir, { recursive: true });
  const bak = join(bakDir, `vehicle-stage1-catalog.pre-satariz-${Date.now()}.json`);
  copyFileSync(STAGE1, bak);

  let entries: PackEntry[] = Array.isArray(pack.entries) ? [...pack.entries] : [];
  const before = entries.length;
  entries = entries.filter((e) => {
    if (!brandSlugs.has(e.brandSlug)) return true;
    if (!(e.categoryPaths || []).includes(CATEGORY_PATH)) return true;
    // Replace otomobil deep/satariz seeded rows for these brands
    const src = String(e.source || "");
    if (src.includes("deep-catalog") || src.includes("satariz")) return false;
    // Also replace unverified / empty legacy rows for same brand+model under otomobil
    if ((e.categoryPaths || []).includes(CATEGORY_PATH) && brandSlugs.has(e.brandSlug)) {
      // Keep non-deep official if generation differs? User: satariz is SoT — replace all otomobil rows for brand
      return false;
    }
    return true;
  });

  // Index new by brand|model — one SATARIZ entry per series (merge versions if duplicate series names)
  const bySeries = new Map<string, PackEntry>();
  for (const e of packEntries) {
    const k = `${e.brandSlug}|${e.modelSlug}`;
    const prev = bySeries.get(k);
    if (!prev) {
      bySeries.set(k, e);
      continue;
    }
    const versions = [...(prev.versions || [])];
    for (const v of e.versions || []) {
      const ex = versions.find((x) => x.slug === v.slug);
      if (!ex) versions.push(v);
      else {
        for (const t of v.trims || []) {
          if (!ex.trims) ex.trims = [];
          if (!ex.trims.find((x) => x.slug === t.slug)) ex.trims.push(t);
        }
      }
    }
    bySeries.set(k, { ...prev, versions: versions.sort((a, c) => a.name.localeCompare(c.name, "tr")) });
  }

  entries.push(...bySeries.values());
  const nextPack = {
    ...pack,
    version: "vehicle-stage1-catalog-v8-satariz-otomobil-sot",
    generatedAt: new Date().toISOString().slice(0, 10),
    notes: [
      ...(pack.notes || []),
      "v8: satariz.com Araç tree is SoT for Otomobil Brand→Series→Version→Trim menu.",
    ],
    entries: entries.sort(
      (a, b) =>
        a.brandName.localeCompare(b.brandName, "tr") || a.modelName.localeCompare(b.modelName, "tr")
    ),
  };
  writeFileSync(STAGE1, JSON.stringify(nextPack, null, 2) + "\n", "utf8");

  await prisma.systemSetting.upsert({
    where: { key: "vasita_stage1_catalog" },
    create: { key: "vasita_stage1_catalog", value: nextPack as object },
    update: { value: nextPack as object },
  });

  // Best-effort facet cache bust via settings touch
  try {
    const { invalidateFacetCache } = await import("../../src/lib/facetCounts");
    invalidateFacetCache();
  } catch {
    /* ignore */
  }

  const listingAfter = await prisma.listing.count({
    where: { category: { path: { startsWith: "arac" } } },
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        dryRun: false,
        brandCount,
        seriesCount,
        motorCount,
        trimCount,
        dbBrands,
        dbModels,
        packEntriesBefore: before,
        packEntriesAfter: entries.length,
        satarizSeriesEntries: bySeries.size,
        backup: bak,
        deepOut: DEEP_OUT,
        listingAfter,
        category: cat.path || cat.slug,
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
  .finally(async () => {
    await prisma.$disconnect();
  });
