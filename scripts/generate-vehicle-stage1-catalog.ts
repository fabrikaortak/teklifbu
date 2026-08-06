/**
 * ⚠️ DEPRECATED — superseded by scripts/build-vehicle-stage1-catalog-v2.ts.
 * DO NOT RUN THIS FILE. It stamps every model with a fake
 * generationCode:"default" / generationLabel:"Standart" row, which the v2
 * generator and /api/vasita/catalog now explicitly treat as "no generation".
 * Kept only for history; use build-vehicle-stage1-catalog-v2.ts instead:
 *   npx tsx scripts/build-vehicle-stage1-catalog-v2.ts
 *
 * ---- Original doc below ----
 * ONE-TIME CURATION GENERATOR.
 * Reads src/data/vehicleCatalog.ts (VEHICLE_CATALOG) and writes
 * docs/vertical-taxonomy/vehicle-stage1-catalog.json — the curated Stage1
 * Brand/ProductModel source pack (verified:true, market:TR).
 *
 * Only VEHICLE_TYPE catalogScope keys are curated (otomobil, arazi-suv-pickup,
 * motosiklet, minivan-panelvan, ticari-araclar). "elektrikli-araclar" is a
 * MARKET_SEGMENT browse hub per dedupeRules (hubs never receive CategoryBrand
 * rows) — its extra EV-only models (BMW i4/iX, VW ID.3/ID.4, …) are NOT
 * seeded in Stage1; electric filtering works via requiredFilters.fuelType on
 * the existing otomobil/arazi-suv-pickup/… brands instead.
 *
 * modelYears is a generic Stage1 default range (not a per-model verified spec).
 *
 * Re-run manually if vehicleCatalog.ts changes:
 *   npx tsx scripts/generate-vehicle-stage1-catalog.ts
 */
import { writeFileSync } from "fs";
import { join } from "path";
import { VEHICLE_CATALOG, type VehicleBrand } from "../src/data/vehicleCatalog";

const CATEGORY_PATH_BY_KEY: Record<string, string> = {
  otomobil: "arac/otomobil",
  "arazi-suv-pickup": "arac/arazi-suv-pickup",
  motosiklet: "arac/motosiklet",
  "minivan-panelvan": "arac/minivan-panelvan",
  "ticari-araclar": "arac/ticari-araclar",
};

const DEFAULT_MODEL_YEARS = Array.from({ length: 11 }, (_, i) => 2015 + i); // 2015..2025

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

function buildEntriesForBrand(categoryPath: string, brand: VehicleBrand): CatalogEntry[] {
  return brand.models.map((model) => {
    const versions =
      model.trims && model.trims.length
        ? model.trims.map((t) => ({ slug: t.slug, name: t.name }))
        : [{ slug: model.slug, name: model.name }];
    return {
      categoryPaths: [categoryPath],
      brandSlug: brand.slug,
      brandName: brand.name,
      modelSlug: model.slug,
      modelName: model.name,
      generationCode: "default",
      generationLabel: "Standart",
      versions,
      modelYears: DEFAULT_MODEL_YEARS,
      fuelTypes: [],
      transmissions: [],
      bodyTypes: [],
      source: "curated-vehicleCatalog-ts",
      verified: true,
      market: "TR",
      active: true,
    };
  });
}

function main() {
  const entries: CatalogEntry[] = [];
  for (const [key, categoryPath] of Object.entries(CATEGORY_PATH_BY_KEY)) {
    const brands = VEHICLE_CATALOG[key] || [];
    for (const brand of brands) {
      entries.push(...buildEntriesForBrand(categoryPath, brand));
    }
  }

  const pack = {
    version: "vehicle-stage1-catalog-v1",
    generatedAt: new Date().toISOString().slice(0, 10),
    source: "curated-vehicleCatalog-ts",
    notes: [
      "Curated from src/data/vehicleCatalog.ts — only brands/models already present there.",
      "elektrikli-araclar (MARKET_SEGMENT hub) intentionally excluded — see dedupeRules.",
      "modelYears is a generic Stage1 default (2015-2025), not a per-model verified spec.",
      "Brand.slug reused across categories (e.g. bmw for otomobil + arazi-suv-pickup + motosiklet) — Brand rows are global, CategoryBrand links per category.",
    ],
    entries,
  };

  const out = join(process.cwd(), "docs/vertical-taxonomy/vehicle-stage1-catalog.json");
  writeFileSync(out, JSON.stringify(pack, null, 2));
  console.log(
    JSON.stringify(
      {
        ok: true,
        out,
        entries: entries.length,
        brands: new Set(entries.map((e) => e.brandSlug)).size,
        byCategory: Object.fromEntries(
          Object.values(CATEGORY_PATH_BY_KEY).map((cp) => [cp, entries.filter((e) => e.categoryPaths.includes(cp)).length])
        ),
      },
      null,
      2
    )
  );
}

main();
