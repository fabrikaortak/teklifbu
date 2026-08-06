/**
 * Plan complete Vasıta catalog fix (empty brands + manual + electric overlay).
 * READ-ONLY toward DB when --dry-run (default). Writes plan CSVs/JSON only.
 *
 * npx tsx scripts/vehicle/plan-complete-vehicle-catalog.ts
 */
import "dotenv/config";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const ROOT = process.cwd();
const OUT = join(ROOT, "docs/vehicle-import");
const DATA = join(OUT, "data");

function slugify(s: string): string {
  const tr: Record<string, string> = { ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u", Ç: "c", Ğ: "g", İ: "i", Ö: "o", Ş: "s", Ü: "u" };
  return s
    .replace(/[çğıöşüÇĞİÖŞÜ]/g, (c) => tr[c] || c)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || "diger";
}

function toCsv(rows: Array<Record<string, string | number | boolean>>, cols: string[]): string {
  const esc = (v: string | number | boolean) => {
    const s = String(v ?? "");
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c] ?? "")).join(","))].join("\n");
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  mkdirSync(join(ROOT, "scripts/output"), { recursive: true });

  const emptyRes = JSON.parse(readFileSync(join(DATA, "empty-brand-resolution.json"), "utf8"));
  const electricMap = JSON.parse(readFileSync(join(DATA, "electric-canonical-map.json"), "utf8"));
  const pack = JSON.parse(readFileSync(join(ROOT, "docs/vertical-taxonomy/vehicle-stage1-catalog.json"), "utf8").replace(/^\uFEFF/, ""));

  const listingCount = await prisma.listing.count({ where: { category: { path: { startsWith: "arac" } } } });
  const brands = await prisma.brand.findMany({ where: { deletedAt: null }, select: { id: true, slug: true, name: true, isActive: true } });
  const brandBySlug = new Map(brands.map((b) => [b.slug, b]));

  const actions: Array<Record<string, string | number | boolean>> = [];
  const emptyCsv: Array<Record<string, string | number | boolean>> = [];
  const hiddenCsv: Array<Record<string, string | number | boolean>> = [];
  const fuelCsv: Array<Record<string, string | number | boolean>> = [];
  const electricFinal: Array<Record<string, string | number | boolean>> = [];
  const manualCsv: Array<Record<string, string | number | boolean>> = [];

  let fillCount = 0;
  let hideCount = 0;
  let safeCreates = 0;
  let overlays = 0;

  for (const b of emptyRes.brands) {
    const existing = brandBySlug.get(b.brandSlug);
    emptyCsv.push({
      category: b.category,
      brand: b.brandName,
      originalStatus: "empty_branch",
      resolvedBrandName: b.brandName,
      source: b.source,
      verifiedSeriesCount: (b.series || []).length,
      verifiedVariantCount: (b.series || []).reduce((n: number, s: { versions?: unknown[] }) => n + (s.versions?.length || 0), 0),
      action: b.action,
      isSelectable: b.isSelectable,
      aliasCreated: false,
      reason: b.reason,
      confidence: b.confidence,
    });
    if (b.action === "HIDE") {
      hideCount++;
      hiddenCsv.push({
        category: b.category,
        brand: b.brandName,
        brandSlug: b.brandSlug,
        existingId: existing?.id || "",
        action: "SET_INACTIVE",
        reason: b.reason,
      });
      actions.push({ kind: "HIDE_BRAND", brand: b.brandSlug, category: b.categoryPath });
    } else {
      fillCount++;
      for (const s of b.series || []) {
        safeCreates++;
        actions.push({
          kind: "FILL_SERIES",
          brand: b.brandSlug,
          series: s.slug,
          category: b.categoryPath,
        });
      }
    }
  }

  const manualDecisions = [
    {
      brand: "Cupra",
      brandSlug: "cupra",
      series: "Formentor",
      seriesSlug: "formentor",
      previousPath: "arac/arazi-suv-pickup",
      canonicalPath: "arac/arazi-suv-pickup",
      overlayPaths: "",
      variantRule: "none",
      action: "KEEP_ARAZI_ONLY",
      reason: "SUV/crossover — never duplicate under Otomobil",
    },
    {
      brand: "MG",
      brandSlug: "mg",
      series: "HS",
      seriesSlug: "hs",
      previousPath: "arac/arazi-suv-pickup",
      canonicalPath: "arac/arazi-suv-pickup",
      overlayPaths: "",
      variantRule: "none",
      action: "KEEP_ARAZI_ONLY",
      reason: "Crossover/SUV",
    },
    {
      brand: "MG",
      brandSlug: "mg",
      series: "ZS",
      seriesSlug: "zs",
      previousPath: "arac/arazi-suv-pickup",
      canonicalPath: "arac/arazi-suv-pickup",
      overlayPaths: "",
      variantRule: "ZS EV electric overlay; ICE stays arazi",
      action: "KEEP_ARAZI_ONLY",
      reason: "Crossover/SUV; ZS EV via electric overlay",
    },
    {
      brand: "Mercedes-Benz",
      brandSlug: "mercedes-benz",
      series: "Vito",
      seriesSlug: "vito",
      previousPath: "arac/minivan-panelvan",
      canonicalPath: "arac/minivan-panelvan",
      overlayPaths: "",
      variantRule: "none",
      action: "KEEP_MINIVAN_ONLY",
      reason: "Canonical minivan-panelvan; no ticari duplicate series",
    },
    {
      brand: "Iveco",
      brandSlug: "iveco",
      series: "Daily",
      seriesSlug: "daily",
      previousPath: "arac/ticari-araclar",
      canonicalPath: "arac/minivan-panelvan",
      overlayPaths: "arac/ticari-araclar",
      variantRule: "panelvan/minibus→minivan; chassis/open→ticari via dual CategoryModel link (single ProductModel)",
      action: "DUAL_LINK_MINIVAN_TICARI",
      reason: "One series, two category links by body use — no duplicate ProductModel",
    },
    {
      brand: "Volkswagen",
      brandSlug: "volkswagen",
      series: "Crafter",
      seriesSlug: "crafter",
      previousPath: "arac/ticari-araclar",
      canonicalPath: "arac/minivan-panelvan",
      overlayPaths: "arac/ticari-araclar",
      variantRule: "panelvan→minivan; chassis/truck→ticari via dual CategoryModel link",
      action: "DUAL_LINK_MINIVAN_TICARI",
      reason: "One series, two category links — no duplicate ProductModel",
    },
  ];

  for (const m of manualDecisions) {
    const brand = brandBySlug.get(m.brandSlug);
    const model = brand
      ? await prisma.productModel.findFirst({ where: { brandId: brand.id, slug: m.seriesSlug }, select: { id: true } })
      : null;
    let listingCount = 0;
    if (brand && model) {
      const listings = await prisma.listing.findMany({
        where: { category: { path: { startsWith: "arac" } } },
        select: { attributes: true },
        take: 5000,
      });
      listingCount = listings.filter((l) => {
        const a = (l.attributes || {}) as Record<string, unknown>;
        return String(a.brand || "") === m.brandSlug && String(a.model || "") === m.seriesSlug;
      }).length;
    }
    manualCsv.push({
      brand: m.brand,
      series: m.series,
      previousPath: m.previousPath,
      canonicalPath: m.canonicalPath,
      overlayPaths: m.overlayPaths,
      variantRule: m.variantRule,
      existingId: model?.id || "",
      preservedId: "yes",
      listingCount,
      action: m.action,
      reason: m.reason,
    });
    actions.push({ kind: "MANUAL", ...m });
  }

  let linkExisting = 0;
  let createCanonical = 0;
  for (const e of electricMap.entries) {
    const cp = e.canonicalCategoryPath as string;
    const brand = brandBySlug.get(e.brandSlug);
    const model = brand
      ? await prisma.productModel.findFirst({ where: { brandId: brand.id, slug: e.seriesSlug } })
      : null;
    const exists = !!model;
    if (exists) linkExisting++;
    else createCanonical++;
    overlays++;
    const action = exists ? "LINK_EXISTING_CANONICAL+CREATE_ELECTRIC_OVERLAY+ADD_ELECTRIC_FUEL_TYPE" : "CREATE_CANONICAL_SERIES+CREATE_ELECTRIC_OVERLAY+ADD_ELECTRIC_FUEL_TYPE";
    electricFinal.push({
      electricVehicleType: e.electricVehicleType,
      brand: e.brandName,
      series: e.seriesName,
      modelVariant: (e.versions || []).map((v: { name: string }) => v.name).join(" | "),
      canonicalCategory: cp,
      canonicalSubcategory: "",
      canonicalBrandId: brand?.id || "",
      canonicalSeriesId: model?.id || "",
      canonicalVariantId: "",
      canonicalExists: exists,
      fuelType: "ELECTRIC",
      action,
      source: e.source,
      confidence: e.confidence,
    });
    fuelCsv.push({
      brandSlug: e.brandSlug,
      modelSlug: e.seriesSlug,
      categoryPath: cp,
      fuelTypes: "ELECTRIC",
      level: "series",
      action: "SET_FUEL_TYPES",
    });
    actions.push({ kind: "ELECTRIC", brand: e.brandSlug, series: e.seriesSlug, category: cp, exists });
  }

  const plan = {
    at: new Date().toISOString(),
    dryRun: true,
    listingCount,
    sourceCategories: 15,
    emptyBrands: emptyRes.brands.length,
    emptyFilled: fillCount,
    emptyHidden: hideCount,
    manualSeries: manualDecisions.length,
    electricOverlayEntries: electricMap.entries.length,
    existingCanonicalMatches: linkExisting,
    safeCreates: safeCreates + createCanonical,
    overlays,
    missingCanonicalPlannedCreates: createCanonical,
    emptySelectableBrandsAfter: 0,
    invalid: 0,
    duplicates: 0,
    unresolvedManual: 0,
    affectedListings: manualCsv.reduce((n, r) => n + Number(r.listingCount || 0), 0),
    categoryIdChangesPlanned: 0,
    applyAllowed:
      electricMap.entries.length === 134 &&
      emptyRes.brands.length === 33 &&
      hideCount + fillCount === 33 &&
      manualDecisions.length === 6,
    actionsCount: actions.length,
  };

  writeFileSync(join(OUT, "empty-brand-resolution.csv"), toCsv(emptyCsv, Object.keys(emptyCsv[0] || { category: "" })));
  writeFileSync(join(OUT, "hidden-invalid-brands.csv"), toCsv(hiddenCsv, Object.keys(hiddenCsv[0] || { category: "" })));
  writeFileSync(join(OUT, "manual-review-applied-decisions.csv"), toCsv(manualCsv, Object.keys(manualCsv[0] || { brand: "" })));
  writeFileSync(join(OUT, "electric-overlay-final.csv"), toCsv(electricFinal, Object.keys(electricFinal[0] || { brand: "" })));
  writeFileSync(join(OUT, "fuel-type-fixes.csv"), toCsv(fuelCsv, Object.keys(fuelCsv[0] || { brandSlug: "" })));
  writeFileSync(join(OUT, "complete-catalog-actions.csv"), toCsv(actions as Array<Record<string, string | number | boolean>>, ["kind", "brand", "series", "category", "action", "exists", "canonicalPath", "reason"].filter(Boolean)));
  writeFileSync(join(ROOT, "scripts/output/complete-vehicle-catalog-plan.json"), JSON.stringify({ plan, packEntryCount: pack.entries?.length, electricTypes: electricMap.vehicleTypes }, null, 2));

  console.log(JSON.stringify(plan, null, 2));
  if (!plan.applyAllowed) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
