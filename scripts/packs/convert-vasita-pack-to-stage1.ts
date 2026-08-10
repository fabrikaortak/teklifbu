/**
 * Converts docs/vertical-taxonomy/packs/teklifbu_vasita_kategori_marka_alt_agaclari.json
 * into docs/vertical-taxonomy/vehicle-stage1-catalog.json (Stage1 apply format).
 *
 * - Maps pack categories → arac/* Stage1 paths
 * - Series → ProductModel; variants → versions[]
 * - Skips MARKET_SEGMENT / overlay hubs (elektrikli, kiralık, hasarlı, klasik, engelli)
 * - Preserves real generationCode rows from the previous Stage1 catalog when brand+model match
 * - Motosiklet BMW → bmw-motorrad (keeps auto bmw separate)
 *
 * npx tsx scripts/packs/convert-vasita-pack-to-stage1.ts
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

type VersionDef = { slug: string; name: string };

type CatalogEntry = {
  categoryPaths: string[];
  brandSlug: string;
  brandName: string;
  modelSlug: string;
  modelName: string;
  generationCode: string;
  generationLabel: string;
  versions: VersionDef[];
  modelYears: number[];
  fuelTypes: string[];
  transmissions: string[];
  bodyTypes: string[];
  source: string;
  verified: boolean;
  market: string;
  active: boolean;
};

type PackNode = {
  name: string;
  slug: string;
  level: string;
  status?: string;
  notes?: string;
  children?: PackNode[];
};

const DEFAULT_YEARS = [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];

const CATEGORY_MAP: Record<string, string | null> = {
  Otomobil: "arac/otomobil",
  "Arazi, SUV & Pickup": "arac/arazi-suv-pickup",
  Motosiklet: "arac/motosiklet",
  "Minivan & Panelvan": "arac/minivan-panelvan",
  "Ticari Araçlar": "arac/ticari-araclar",
  ATV: "arac/atv",
  UTV: "arac/utv",
  Karavan: "arac/karavan",
  // Overlays / hubs — do not seed CategoryBrand here
  "Elektrikli Araçlar": null,
  "Kiralık Araçlar": null,
  "Hasarlı Araçlar": null,
  "Klasik Araçlar": null,
  "Engelli Plakalı Araçlar": null,
  // Secondary verticals — optional; include if category rows exist at apply time
  "Deniz Araçları": "arac/deniz-araclari",
  "Hava Araçları": "arac/hava-araclari",
};

const BRAND_SLUG_OVERRIDES: Record<string, Record<string, string>> = {
  "arac/motosiklet": {
    bmw: "bmw-motorrad",
  },
};

const BRAND_NAME_OVERRIDES: Record<string, Record<string, string>> = {
  "arac/motosiklet": {
    "bmw-motorrad": "BMW Motorrad",
  },
};

function slugify(s: string): string {
  const tr: Record<string, string> = {
    ç: "c",
    ğ: "g",
    ı: "i",
    ö: "o",
    ş: "s",
    ü: "u",
    Ç: "c",
    Ğ: "g",
    İ: "i",
    Ö: "o",
    Ş: "s",
    Ü: "u",
  };
  let out = s.replace(/[çğıöşüÇĞİÖŞÜ]/g, (ch) => tr[ch] || ch);
  out = out.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  out = out.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase();
  return out || "diger";
}

function resolveBrand(categoryPath: string, brandName: string): { slug: string; name: string } {
  let slug = slugify(brandName);
  const ov = BRAND_SLUG_OVERRIDES[categoryPath]?.[slug];
  if (ov) slug = ov;
  const name = BRAND_NAME_OVERRIDES[categoryPath]?.[slug] || brandName;
  return { slug, name };
}

function versionsFromSeries(series: PackNode): VersionDef[] {
  const variants = (series.children || []).filter((c) => c.level === "MODEL_VARIANT");
  if (variants.length === 0) {
    return [{ slug: series.slug || slugify(series.name), name: series.name }];
  }
  const seen = new Set<string>();
  const out: VersionDef[] = [];
  for (const v of variants) {
    let s = v.slug || slugify(v.name);
    if (seen.has(s)) s = `${series.slug || slugify(series.name)}-${s}`;
    if (seen.has(s)) continue;
    seen.add(s);
    out.push({ slug: s, name: v.name });
  }
  return out;
}

function collectBrandNodes(catNode: PackNode): PackNode[] {
  const brands: PackNode[] = [];
  for (const child of catNode.children || []) {
    if (child.level === "BRAND") brands.push(child);
    else if (child.level === "SUBCATEGORY") {
      for (const b of child.children || []) {
        if (b.level === "BRAND") brands.push(b);
      }
    }
  }
  return brands;
}

function entryKey(e: CatalogEntry): string {
  return `${e.categoryPaths[0]}|${e.brandSlug}|${e.modelSlug}|${e.generationCode}`;
}

function modelKey(e: CatalogEntry): string {
  return `${e.categoryPaths[0]}|${e.brandSlug}|${e.modelSlug}`;
}

function main() {
  const root = process.cwd();
  const packPath = join(root, "docs/vertical-taxonomy/packs/teklifbu_vasita_kategori_marka_alt_agaclari.json");
  const prevPath = join(root, "docs/vertical-taxonomy/vehicle-stage1-catalog.json");
  const outPath = prevPath;

  if (!existsSync(packPath)) {
    throw new Error(`Pack JSON missing: ${packPath}. Run scripts/packs/teklifbu_vasita_catalog_pack.py first.`);
  }

  const pack = JSON.parse(readFileSync(packPath, "utf8")) as PackNode & {
    metadata?: { version?: string };
  };

  const prevEntries: CatalogEntry[] = existsSync(prevPath)
    ? (JSON.parse(readFileSync(prevPath, "utf8")).entries || [])
    : [];
  const prevGensByModel = new Map<string, CatalogEntry[]>();
  for (const e of prevEntries) {
    if (!e.generationCode) continue;
    const k = modelKey(e);
    const arr = prevGensByModel.get(k) || [];
    arr.push(e);
    prevGensByModel.set(k, arr);
  }

  const entries: CatalogEntry[] = [];
  const skippedCategories: string[] = [];
  let brandsWithSeries = 0;
  let brandsEmpty = 0;

  for (const cat of pack.children || []) {
    if (cat.level !== "VEHICLE_CATEGORY") continue;
    const mapped = CATEGORY_MAP[cat.name];
    if (mapped === undefined) {
      skippedCategories.push(`${cat.name} (unmapped)`);
      continue;
    }
    if (mapped === null) {
      skippedCategories.push(`${cat.name} (overlay/hub)`);
      continue;
    }

    const brands = collectBrandNodes(cat);
    for (const brand of brands) {
      const { slug: brandSlug, name: brandName } = resolveBrand(mapped, brand.name);
      const seriesList = (brand.children || []).filter((c) => c.level === "SERIES");
      if (seriesList.length === 0) {
        brandsEmpty++;
        continue;
      }
      brandsWithSeries++;
      for (const series of seriesList) {
        const modelSlug = series.slug || slugify(series.name);
        const modelName = series.name;
        const versions = versionsFromSeries(series);
        const mk = `${mapped}|${brandSlug}|${modelSlug}`;
        const gens = prevGensByModel.get(mk);
        if (gens && gens.length > 0) {
          for (const g of gens) {
            entries.push({
              ...g,
              categoryPaths: [mapped],
              brandSlug,
              brandName,
              modelSlug,
              modelName,
              versions: g.versions?.length ? g.versions : versions,
              verified: true,
              active: true,
              market: "TR",
              source: g.source || "tr-market-oem-model-2024",
            });
          }
        } else {
          entries.push({
            categoryPaths: [mapped],
            brandSlug,
            brandName,
            modelSlug,
            modelName,
            generationCode: "",
            generationLabel: "",
            versions,
            modelYears: DEFAULT_YEARS,
            fuelTypes: [],
            transmissions: [],
            bodyTypes: [],
            source: "curated-vasita-pack-2026.08",
            verified: true,
            market: "TR",
            active: true,
          });
        }
      }
    }
  }

  // Integrity
  const BANNED = new Set(["standart", "default", "genel"]);
  for (const e of entries) {
    if (e.generationCode.toLowerCase() === "default") {
      throw new Error(`Fake generationCode on ${e.brandSlug}/${e.modelSlug}`);
    }
    if (BANNED.has(e.generationLabel.toLowerCase())) {
      throw new Error(`Fake generationLabel on ${e.brandSlug}/${e.modelSlug}`);
    }
  }

  // Dedupe
  const byKey = new Map<string, CatalogEntry>();
  for (const e of entries) byKey.set(entryKey(e), e);
  const deduped = [...byKey.values()];

  const brandCounts: Record<string, number> = {};
  for (const e of deduped) {
    const cp = e.categoryPaths[0];
    brandCounts[cp] = brandCounts[cp] || 0;
  }
  for (const cp of Object.keys(brandCounts)) {
    brandCounts[cp] = new Set(deduped.filter((e) => e.categoryPaths.includes(cp)).map((e) => e.brandSlug)).size;
  }

  const out = {
    version: "vehicle-stage1-catalog-v3-pack",
    generatedAt: new Date().toISOString().slice(0, 10),
    source: "curated-vasita-pack-2026.08 + preserved-v2-generations",
    notes: [
      "Expanded from teklifbu_vasita_catalog_pack.py (PUBLIC_NAV brands + curated series/variants).",
      "Elektrikli/kiralık/hasarlı/klasik/engelli hubs skipped — overlays, not CategoryBrand seeds.",
      "Real chassis/generation codes from prior v2 catalog preserved where brand+model match.",
      "Never emits generationCode/Label default/Standart/Genel.",
      "bmw-motorrad used under arac/motosiklet; bmw remains passenger/SUV brands.",
      `Pack version: ${pack.metadata?.version || "unknown"}`,
    ],
    entries: deduped,
  };

  writeFileSync(outPath, JSON.stringify(out, null, 2), "utf8");

  mkdirSync(join(root, "scripts/output"), { recursive: true });
  const report = {
    at: new Date().toISOString(),
    outPath,
    totalEntries: deduped.length,
    totalBrands: new Set(deduped.map((e) => e.brandSlug)).size,
    totalModels: new Set(deduped.map((e) => `${e.brandSlug}/${e.modelSlug}`)).size,
    totalVersions: deduped.reduce((n, e) => n + (e.versions?.length || 0), 0),
    realGenerationRows: deduped.filter((e) => e.generationCode).length,
    brandsWithSeries,
    brandsEmptySkipped: brandsEmpty,
    brandCounts,
    skippedCategories,
    prevEntries: prevEntries.length,
  };
  writeFileSync(join(root, "scripts/output/vehicle-stage1-pack-convert.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ok: true, ...report }, null, 2));
}

main();
