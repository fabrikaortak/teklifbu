/**
 * Complete previously HIDE'd vehicle brands with verified series trees.
 *
 * npx tsx scripts/vehicle/complete-hidden-vehicle-brands.ts --dry-run
 * npx tsx scripts/vehicle/complete-hidden-vehicle-brands.ts --apply
 */
import "dotenv/config";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const ROOT = process.cwd();
const DATA = join(ROOT, "docs/vehicle-import/data");
const OUT_DOCS = join(ROOT, "docs/vehicle-import");
const OUT_SCRIPTS = join(ROOT, "scripts/output");
const STAGE1 = join(ROOT, "docs/vertical-taxonomy/vehicle-stage1-catalog.json");
const EMPTY_JSON = join(DATA, "empty-brand-resolution.json");
const EMPTY_CSV = join(OUT_DOCS, "empty-brand-resolution.csv");
const RESOLUTION = join(DATA, "hidden-brands-resolution.json");
const DEFAULT_YEARS = [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026];

const APPLY_DECISIONS = new Set(["FILL_VERIFIED", "RENAME_AND_FILL", "MERGE_WITH_EXISTING_BRAND"]);
const HIDDEN_DECISIONS = new Set(["KEEP_HIDDEN_NO_VERIFIABLE_DATA", "REMOVE_INVALID_SOURCE"]);

type Series = {
  name: string;
  slug: string;
  versions?: Array<{ slug: string; name: string }>;
};

type ResolutionBrand = {
  originalBrand: string;
  normalizedBrand: string;
  brandSlug: string;
  decision: string;
  confidence: string;
  officialSource: string;
  secondarySource: string;
  notes: string;
  series: Series[];
  mergeTargetSlug?: string;
};

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
  map.set(k, { ...prev, ...entry, versions });
}

function toCsv(rows: Array<Record<string, string | number | boolean>>, cols: string[]): string {
  const esc = (v: string | number | boolean) => {
    const s = String(v ?? "");
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c] ?? "")).join(","))].join("\n");
}

function parseHideBrandsFromCsv(csv: string): string[] {
  const lines = csv.replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const header = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
  const brandIdx = header.indexOf("brand");
  const actionIdx = header.indexOf("action");
  const out: string[] = [];
  for (const line of lines.slice(1)) {
    const cols: string[] = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQ && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else inQ = !inQ;
      } else if (ch === "," && !inQ) {
        cols.push(cur);
        cur = "";
      } else cur += ch;
    }
    cols.push(cur);
    const brand = (cols[brandIdx] || "").trim();
    const action = (cols[actionIdx] || "").trim().toUpperCase();
    if (brand && action === "HIDE") out.push(brand);
  }
  return out;
}

async function ensureBrand(tx: PrismaClient, slug: string, name: string, isActive: boolean) {
  const existing = await tx.brand.findUnique({ where: { slug } });
  if (existing) {
    if (existing.managedBySeed === false) {
      if (existing.isActive !== isActive) {
        return tx.brand.update({ where: { slug }, data: { isActive } });
      }
      return existing;
    }
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
}

function buildPlan(hideNames: string[], resolution: { category: string; categoryPath: string; brands: ResolutionBrand[] }) {
  const byOriginal = new Map(resolution.brands.map((b) => [b.originalBrand, b]));
  const missing: string[] = [];
  const rows: Array<Record<string, string | number | boolean>> = [];
  const applyable: ResolutionBrand[] = [];
  const counts = {
    FILL_VERIFIED: 0,
    RENAME_AND_FILL: 0,
    MERGE_WITH_EXISTING_BRAND: 0,
    KEEP_HIDDEN_NO_VERIFIABLE_DATA: 0,
    REMOVE_INVALID_SOURCE: 0,
  };

  let verifiedSeries = 0;
  let verifiedVariants = 0;

  for (const name of hideNames) {
    const b = byOriginal.get(name);
    if (!b) {
      missing.push(name);
      rows.push({
        originalBrand: name,
        normalizedBrand: name,
        category: resolution.category,
        decision: "KEEP_HIDDEN_NO_VERIFIABLE_DATA",
        verifiedSeriesCount: 0,
        verifiedVariantCount: 0,
        officialSource: "",
        secondarySource: "",
        confidence: "low",
        currentlyHidden: true,
        finalSelectable: false,
        notes: "Missing from curated resolution file",
      });
      counts.KEEP_HIDDEN_NO_VERIFIABLE_DATA++;
      continue;
    }

    const seriesCount = b.series.length;
    const variantCount = b.series.reduce((n, s) => n + (s.versions?.length || 1), 0);
    const selectable = APPLY_DECISIONS.has(b.decision) && seriesCount > 0;
    if (selectable) {
      applyable.push(b);
      verifiedSeries += seriesCount;
      verifiedVariants += variantCount;
    }
    if (b.decision in counts) counts[b.decision as keyof typeof counts]++;
    else counts.KEEP_HIDDEN_NO_VERIFIABLE_DATA++;

    rows.push({
      originalBrand: b.originalBrand,
      normalizedBrand: b.normalizedBrand,
      category: resolution.category,
      decision: b.decision,
      verifiedSeriesCount: seriesCount,
      verifiedVariantCount: variantCount,
      officialSource: b.officialSource || "",
      secondarySource: b.secondarySource || "",
      confidence: b.confidence,
      currentlyHidden: !selectable,
      finalSelectable: selectable,
      notes: b.notes || "",
    });
  }

  return { rows, applyable, counts, verifiedSeries, verifiedVariants, missing };
}

async function main() {
  const args = process.argv.slice(2);
  const doApply = args.includes("--apply");
  const dryRun = !doApply || args.includes("--dry-run");

  mkdirSync(OUT_DOCS, { recursive: true });
  mkdirSync(OUT_SCRIPTS, { recursive: true });
  mkdirSync(join(ROOT, "docs/vehicle-import/backups"), { recursive: true });

  if (!existsSync(EMPTY_CSV)) throw new Error(`Missing ${EMPTY_CSV}`);
  if (!existsSync(RESOLUTION)) throw new Error(`Missing ${RESOLUTION}`);
  if (!existsSync(EMPTY_JSON)) throw new Error(`Missing ${EMPTY_JSON}`);

  const hideSnapshotPath = join(OUT_SCRIPTS, "hidden-brands-original-hide-list.json");
  let hideNames = parseHideBrandsFromCsv(readFileSync(EMPTY_CSV, "utf8"));
  if (existsSync(hideSnapshotPath)) {
    const snap = JSON.parse(readFileSync(hideSnapshotPath, "utf8")) as { brands: string[] };
    if (Array.isArray(snap.brands) && snap.brands.length > 0) hideNames = snap.brands;
  } else if (hideNames.length > 0) {
    writeFileSync(hideSnapshotPath, JSON.stringify({ at: new Date().toISOString(), brands: hideNames }, null, 2));
  }

  const resolution = JSON.parse(readFileSync(RESOLUTION, "utf8")) as {
    version: string;
    category: string;
    categoryPath: string;
    brands: ResolutionBrand[];
  };

  // Prefer curated resolution brands (stable across re-runs) scoped to original HIDE set
  const resolutionNames = resolution.brands.map((b) => b.originalBrand);
  if (hideNames.length === 0) hideNames = resolutionNames;
  const scopedHide = hideNames.filter((n) => resolutionNames.includes(n));
  if (scopedHide.length === 0) throw new Error("No HIDE brands to resolve");

  const plan = buildPlan(scopedHide, resolution);
  const csvCols = [
    "originalBrand",
    "normalizedBrand",
    "category",
    "decision",
    "verifiedSeriesCount",
    "verifiedVariantCount",
    "officialSource",
    "secondarySource",
    "confidence",
    "currentlyHidden",
    "finalSelectable",
    "notes",
  ];
  writeFileSync(join(OUT_DOCS, "hidden-brands-final-resolution.csv"), toCsv(plan.rows, csvCols), "utf8");

  const planJson = {
    version: resolution.version,
    at: new Date().toISOString(),
    dryRun,
    startingHidden: scopedHide.length,
    researched: plan.rows.length,
    counts: plan.counts,
    verifiedSeriesToAdd: plan.verifiedSeries,
    verifiedVariantsToAdd: plan.verifiedVariants,
    missingFromResolution: plan.missing,
    applyableBrands: plan.applyable.map((b) => ({
      originalBrand: b.originalBrand,
      brandSlug: b.brandSlug,
      decision: b.decision,
      series: b.series.map((s) => s.name),
    })),
    applyAllowed: plan.missing.length === 0 && plan.applyable.every((b) => b.series.length > 0),
  };
  writeFileSync(join(OUT_SCRIPTS, "hidden-brands-completion-plan.json"), JSON.stringify(planJson, null, 2));

  console.log(
    JSON.stringify(
      {
        ok: true,
        dryRun: true,
        startingHidden: scopedHide.length,
        counts: plan.counts,
        series: plan.verifiedSeries,
        variants: plan.verifiedVariants,
        applyable: plan.applyable.length,
      },
      null,
      2
    )
  );

  if (dryRun) return;
  if (!planJson.applyAllowed) throw new Error("plan.applyAllowed=false");
  const hideNamesForApply = scopedHide;

  const emptyRes = JSON.parse(readFileSync(EMPTY_JSON, "utf8"));
  const pack = JSON.parse(readFileSync(STAGE1, "utf8").replace(/^\uFEFF/, ""));
  const packMap = new Map<string, PackEntry>();
  for (const e of pack.entries || []) upsertPackEntry(packMap, e as PackEntry);

  const listingBefore = await prisma.listing.findMany({
    where: { category: { path: { startsWith: "arac" } } },
    select: { id: true, categoryId: true },
  });

  const report = {
    dryRun: false,
    at: new Date().toISOString(),
    brandsActivated: 0,
    brandsKeptHidden: 0,
    seriesCreated: 0,
    seriesExisting: 0,
    packEntriesUpserted: 0,
    listingCategoryIdChanges: 0,
    listingCountBefore: listingBefore.length,
    listingCountAfter: 0,
  };

  copyFileSync(STAGE1, join(ROOT, "docs/vehicle-import/backups", `vehicle-stage1-catalog-pre-hidden-complete-${Date.now()}.json`));

  await prisma.$transaction(
    async (tx) => {
      for (const b of resolution.brands) {
        if (!hideNamesForApply.includes(b.originalBrand)) continue;

        if (HIDDEN_DECISIONS.has(b.decision) || !APPLY_DECISIONS.has(b.decision) || b.series.length === 0) {
          await ensureBrand(tx as unknown as PrismaClient, b.brandSlug, b.normalizedBrand, false);
          report.brandsKeptHidden++;
          continue;
        }

        const targetSlug = b.decision === "MERGE_WITH_EXISTING_BRAND" && b.mergeTargetSlug ? b.mergeTargetSlug : b.brandSlug;
        const brand = await ensureBrand(tx as unknown as PrismaClient, targetSlug, b.normalizedBrand, true);
        report.brandsActivated++;

        for (const s of b.series) {
          const before = await tx.productModel.findUnique({
            where: { brandId_slug: { brandId: brand.id, slug: s.slug } },
          });
          const model = await ensureModel(tx as unknown as PrismaClient, brand.id, s.slug, s.name);
          await ensureCategoryLinks(tx as unknown as PrismaClient, resolution.categoryPath, brand.id, model.id);
          if (before) report.seriesExisting++;
          else report.seriesCreated++;

          const versions = s.versions?.length ? s.versions : [{ slug: s.slug, name: s.name }];
          upsertPackEntry(packMap, {
            categoryPaths: [resolution.categoryPath],
            brandSlug: targetSlug,
            brandName: b.normalizedBrand,
            modelSlug: s.slug,
            modelName: s.name,
            generationCode: "",
            generationLabel: "",
            versions,
            modelYears: DEFAULT_YEARS,
            fuelTypes: [],
            transmissions: [],
            bodyTypes: [],
            source: "hidden-brand-complete-2026.08",
            verified: true,
            market: "TR",
            active: true,
          });
          report.packEntriesUpserted++;
        }
      }

      const newPack = {
        ...pack,
        version: "vehicle-stage1-catalog-v5-hidden-brands",
        generatedAt: new Date().toISOString().slice(0, 10),
        source: "hidden-brands-complete-2026.08",
        notes: [
          ...(pack.notes || []),
          "v5: completed verified series trees for previously hidden motorcycle brands.",
        ],
        entries: [...packMap.values()],
      };

      await tx.systemSetting.upsert({
        where: { key: "vasita_stage1_catalog" },
        create: { key: "vasita_stage1_catalog", value: newPack, label: "Vasıta Stage1 catalog pack", group: "vasita" },
        update: { value: newPack },
      });

      writeFileSync(STAGE1, JSON.stringify(newPack, null, 2));
    },
    { timeout: 600_000 }
  );

  // Sync empty-brand-resolution artifacts so future complete-apply does not re-hide filled brands
  const emptyBySlug = new Map((emptyRes.brands || []).map((b: { brandSlug: string }) => [b.brandSlug, b]));
  for (const b of resolution.brands) {
    if (!hideNamesForApply.includes(b.originalBrand)) continue;
    const existing = emptyBySlug.get(b.brandSlug) as Record<string, unknown> | undefined;
    if (!existing) continue;
    if (APPLY_DECISIONS.has(b.decision) && b.series.length > 0) {
      existing.action = "FILL";
      existing.isSelectable = true;
      existing.series = b.series.map((s) => ({
        name: s.name,
        slug: s.slug,
        versions: s.versions?.length ? s.versions : [{ slug: s.slug, name: s.name }],
      }));
      existing.source = b.officialSource || "oem-public";
      existing.confidence = b.confidence;
      existing.reason = b.notes;
      existing.brandName = b.normalizedBrand;
    } else if (b.decision === "REMOVE_INVALID_SOURCE") {
      existing.action = "HIDE";
      existing.isSelectable = false;
      existing.series = [];
      existing.source = b.officialSource || "invalid-source";
      existing.confidence = b.confidence;
      existing.reason = b.notes;
    } else {
      existing.action = "HIDE";
      existing.isSelectable = false;
      existing.series = [];
      existing.source = b.officialSource || "none";
      existing.confidence = b.confidence;
      existing.reason = b.notes;
    }
  }
  emptyRes.version = "2026.08-hidden-brands-complete-v1";
  writeFileSync(EMPTY_JSON, JSON.stringify(emptyRes, null, 2));

  const emptyCsvRows = (emptyRes.brands || []).map(
    (b: {
      category: string;
      brandName: string;
      brandSlug: string;
      action: string;
      isSelectable: boolean;
      series?: unknown[];
      source: string;
      confidence: string;
      reason: string;
    }) => ({
      category: b.category,
      brand: b.brandName,
      originalStatus: "empty_branch",
      resolvedBrandName: b.brandName,
      source: b.source,
      verifiedSeriesCount: (b.series || []).length,
      verifiedVariantCount: (b.series || []).reduce((n: number, s: { versions?: unknown[] }) => n + (s.versions?.length || 1), 0),
      action: b.action,
      isSelectable: b.isSelectable,
      aliasCreated: false,
      reason: b.reason,
      confidence: b.confidence,
    })
  );
  writeFileSync(
    EMPTY_CSV,
    toCsv(emptyCsvRows, [
      "category",
      "brand",
      "originalStatus",
      "resolvedBrandName",
      "source",
      "verifiedSeriesCount",
      "verifiedVariantCount",
      "action",
      "isSelectable",
      "aliasCreated",
      "reason",
      "confidence",
    ]),
    "utf8"
  );

  const listingAfter = await prisma.listing.findMany({
    where: { id: { in: listingBefore.map((l) => l.id) } },
    select: { id: true, categoryId: true },
  });
  const beforeMap = new Map(listingBefore.map((l) => [l.id, l.categoryId]));
  for (const a of listingAfter) {
    if (beforeMap.get(a.id) !== a.categoryId) report.listingCategoryIdChanges++;
  }
  report.listingCountAfter = await prisma.listing.count({ where: { category: { path: { startsWith: "arac" } } } });
  if (report.listingCategoryIdChanges > 0) {
    throw new Error(`Unexpected listing categoryId changes: ${report.listingCategoryIdChanges}`);
  }
  if (report.listingCountAfter !== report.listingCountBefore) {
    throw new Error(`Listing count changed: ${report.listingCountBefore} -> ${report.listingCountAfter}`);
  }

  writeFileSync(join(OUT_SCRIPTS, "hidden-brands-completion-apply-report.json"), JSON.stringify({ ok: true, ...report }, null, 2));
  console.log(JSON.stringify({ ok: true, dryRun: false, ...report }, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
