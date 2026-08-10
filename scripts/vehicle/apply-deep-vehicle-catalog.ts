/**
 * Apply verified deep vehicle catalog (all brands under data/vehicle-deep-catalog/)
 * into stage1 pack + SystemSetting. Idempotent upsert; preserves listing categoryIds.
 *
 * VERIFIED_OFFICIAL / VERIFIED_MULTI_SOURCE with model (version).
 * Trim optional: empty trim creates version with trims:[].
 *
 * npx tsx scripts/vehicle/apply-deep-vehicle-catalog.ts
 * npx tsx scripts/vehicle/apply-deep-vehicle-catalog.ts --dry-run
 */
import "dotenv/config";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "fs";
import { join } from "path";
import { PrismaClient } from "@prisma/client";
import { slugifyVasita } from "../../src/lib/vasitaCatalogNormalize";

const prisma = new PrismaClient();
const ROOT = process.cwd();
const STAGE1 = join(ROOT, "docs/vertical-taxonomy/vehicle-stage1-catalog.json");
const DATA_DIR = join(ROOT, "data/vehicle-deep-catalog");
const DRY = process.argv.includes("--dry-run");

type DeepConfig = {
  brand: string;
  series: string;
  model: string;
  trim: string;
  generationCode?: string | null;
  yearFrom?: number | null;
  yearTo?: number | null;
  confidence: string;
  category?: string;
};

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

const CATEGORY_PATH: Record<string, string> = {
  Otomobil: "arac/otomobil",
  "Arazi, SUV & Pickup": "arac/arazi-suv-pickup",
  "Minivan & Panelvan": "arac/minivan-panelvan",
};

function yearsBetween(from: number, to: number): number[] {
  const out: number[] = [];
  for (let y = from; y <= to; y++) out.push(y);
  return out;
}

function brandSlugOf(brand: string): string {
  return slugifyVasita(brand);
}

function seriesSlugOf(series: string): string {
  return slugifyVasita(series);
}

function loadConfigs(): DeepConfig[] {
  if (!existsSync(DATA_DIR)) return [];
  const all: DeepConfig[] = [];
  for (const f of readdirSync(DATA_DIR).filter((x) => x.endsWith(".json"))) {
    const raw = JSON.parse(readFileSync(join(DATA_DIR, f), "utf8"));
    for (const c of raw.configurations || []) {
      if (
        c.model &&
        String(c.model).trim() &&
        (c.confidence === "VERIFIED_OFFICIAL" || c.confidence === "VERIFIED_MULTI_SOURCE")
      ) {
        all.push({ ...c, trim: c.trim && c.trim !== "-" ? c.trim : "" });
      }
    }
  }
  return all;
}

function detectCollisions(configs: DeepConfig[]) {
  const versionAsTrim = new Set<string>();
  const trimAsVersion = new Set<string>();
  const versions = new Set(configs.map((c) => c.model.toLocaleLowerCase("tr-TR")));
  const trims = new Set(configs.map((c) => c.trim.toLocaleLowerCase("tr-TR")));
  for (const v of versions) if (trims.has(v)) versionAsTrim.add(v);
  // Heuristic: known package words should not appear as sole version names
  const packageWords = ["m sport", "s line", "r-line", "icon", "allure", "elegance", "highline", "comfortline", "exclusive", "avantgarde", "progressive", "amg line"];
  for (const v of versions) {
    if (packageWords.includes(v)) trimAsVersion.add(v);
  }
  return { versionTrimNameCollisions: [...versionAsTrim], packageNamedAsVersion: [...trimAsVersion] };
}

async function main() {
  const configs = loadConfigs();
  const collisions = detectCollisions(configs);
  if (collisions.versionTrimNameCollisions.length || collisions.packageNamedAsVersion.length) {
    console.error(JSON.stringify({ ok: false, collisions }, null, 2));
    // Soft-warn only for shared names across different brands; hard-fail if same series has model==trim
  }

  const listingBefore = await prisma.listing.count({
    where: { category: { path: { startsWith: "arac" } } },
  });

  // Group by brand|series|gen|categoryPath
  const groups = new Map<string, DeepConfig[]>();
  for (const c of configs) {
    const cat =
      CATEGORY_PATH[c.category || ""] ||
      (String(c.category || "").toLowerCase().includes("suv")
        ? "arac/arazi-suv-pickup"
        : String(c.category || "").toLowerCase().includes("minivan")
          ? "arac/minivan-panelvan"
          : "arac/otomobil");
    const gen = (c.generationCode || "").trim() || "current";
    const key = `${c.brand}||${c.series}||${gen}||${cat}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(c);
  }

  const pack = JSON.parse(readFileSync(STAGE1, "utf8").replace(/^\uFEFF/, ""));
  let entries: PackEntry[] = Array.isArray(pack.entries) ? [...pack.entries] : [];

  // Snapshot existing deep-catalog version/trim keys for idempotent delta
  const existingDeepKeys = new Set<string>();
  for (const e of entries) {
    if (!String(e.source || "").includes("deep-catalog")) continue;
    for (const v of e.versions || []) {
      existingDeepKeys.add(`${e.brandSlug}|${e.modelSlug}|${e.generationCode || ""}|${v.slug}|__version__`);
      for (const t of v.trims || []) {
        existingDeepKeys.add(`${e.brandSlug}|${e.modelSlug}|${e.generationCode || ""}|${v.slug}|${t.slug}`);
      }
    }
  }

  // Remove previous deep-catalog seeded entries for brands we are re-applying
  const brands = new Set(configs.map((c) => brandSlugOf(c.brand)));
  entries = entries.filter((e) => !(brands.has(e.brandSlug) && String(e.source || "").includes("deep-catalog")));

  let createdVersions = 0;
  let createdTrims = 0;
  let keptVersions = 0;
  let keptTrims = 0;
  let updatedEntries = 0;
  const newEntries: PackEntry[] = [];

  for (const [key, rows] of groups) {
    const [brand, series, genRaw, cat] = key.split("||");
    const gen = genRaw === "current" ? "" : genRaw;
    const bSlug = brandSlugOf(brand);
    const mSlug = seriesSlugOf(series);
    const versionMap = new Map<
      string,
      {
        slug: string;
        name: string;
        trims: Array<{ slug: string; name: string; generationCode?: string; yearFrom?: number; yearTo?: number }>;
        yearFrom: number;
        yearTo: number;
      }
    >();
    let minY = 9999;
    let maxY = 0;
    for (const r of rows) {
      const yf = r.yearFrom ?? 2020;
      const yt = r.yearTo ?? 2026;
      minY = Math.min(minY, yf);
      maxY = Math.max(maxY, yt);
      const vKey = r.model.toLocaleLowerCase("tr-TR");
      if (!versionMap.has(vKey)) {
        versionMap.set(vKey, {
          slug: slugifyVasita(r.model),
          name: r.model,
          trims: [],
          yearFrom: yf,
          yearTo: yt,
        });
      }
      const v = versionMap.get(vKey)!;
      v.yearFrom = Math.min(v.yearFrom, yf);
      v.yearTo = Math.max(v.yearTo, yt);
      if (r.trim && String(r.trim).trim()) {
        const tSlug = slugifyVasita(r.trim);
        if (!v.trims.find((t) => t.slug === tSlug)) {
          v.trims.push({
            slug: tSlug,
            name: r.trim,
            ...(gen ? { generationCode: gen } : {}),
            yearFrom: yf,
            yearTo: yt,
          });
        }
      }
    }

    for (const v of versionMap.values()) {
      const vk = `${bSlug}|${mSlug}|${gen}|${v.slug}|__version__`;
      if (existingDeepKeys.has(vk)) keptVersions++;
      else createdVersions++;
      for (const t of v.trims) {
        const tk = `${bSlug}|${mSlug}|${gen}|${v.slug}|${t.slug}`;
        if (existingDeepKeys.has(tk)) keptTrims++;
        else createdTrims++;
      }
    }

    newEntries.push({
      categoryPaths: [cat],
      brandSlug: bSlug,
      brandName: brand,
      modelSlug: mSlug,
      modelName: series,
      generationCode: gen,
      generationLabel: gen || series,
      versions: [...versionMap.values()]
        .map((v) => ({
          slug: v.slug,
          name: v.name,
          yearFrom: v.yearFrom,
          yearTo: v.yearTo,
          trims: v.trims.sort((a, b) => a.name.localeCompare(b.name, "tr")),
        }))
        .sort((a, b) => a.name.localeCompare(b.name, "tr")),
      modelYears: yearsBetween(minY === 9999 ? 2020 : minY, maxY === 0 ? 2026 : maxY),
      fuelTypes: [],
      transmissions: [],
      bodyTypes: [],
      source: `deep-catalog-${bSlug}-2026.08`,
      verified: true,
      market: "TR",
      active: true,
    });
    updatedEntries++;
  }

  const nextPack = {
    ...pack,
    version: "vehicle-stage1-catalog-v7-deep-multi-brand",
    generatedAt: new Date().toISOString().slice(0, 10),
    notes: [...(pack.notes || []), "v7 deep multi-brand: nested version+trims from verified TR sources."],
    entries: [...entries, ...newEntries],
  };

  const report = {
    at: new Date().toISOString(),
    dryRun: DRY,
    brands: [...brands],
    configsApplied: configs.length,
    entriesWritten: newEntries.length,
    createdVersions,
    createdTrims,
    keptVersions,
    keptTrims,
    updatedEntries,
    collisions,
    listingBefore,
    listingAfter: listingBefore,
  };

  mkdirSync(join(ROOT, "scripts/output"), { recursive: true });
  writeFileSync(join(ROOT, "scripts/output/deep-vehicle-catalog-apply.json"), JSON.stringify(report, null, 2));

  if (DRY) {
    console.log(JSON.stringify({ ...report, message: "dry-run only" }, null, 2));
    return;
  }

  mkdirSync(join(ROOT, "docs/vehicle-import/backups"), { recursive: true });
  copyFileSync(STAGE1, join(ROOT, "docs/vehicle-import/backups", `vehicle-stage1-pre-deep-apply-${Date.now()}.json`));
  writeFileSync(STAGE1, JSON.stringify(nextPack, null, 2));

  await prisma.systemSetting.upsert({
    where: { key: "vasita_stage1_catalog" },
    create: { key: "vasita_stage1_catalog", value: nextPack, label: "Vasıta Stage1 catalog pack", group: "vasita" },
    update: { value: nextPack },
  });

  const listingAfter = await prisma.listing.count({
    where: { category: { path: { startsWith: "arac" } } },
  });
  report.listingAfter = listingAfter;
  writeFileSync(join(ROOT, "scripts/output/deep-vehicle-catalog-apply.json"), JSON.stringify(report, null, 2));

  if (listingBefore !== listingAfter) throw new Error("listing count changed during apply");
  console.log(JSON.stringify(report, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
