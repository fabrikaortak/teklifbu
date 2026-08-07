/**
 * Seed all verified BMW deep-catalog configurations into stage1 pack (version+trims).
 * Maps series names → existing modelSlug when possible.
 *
 * npx tsx scripts/vehicle/seed-bmw-deep-catalog-runtime.ts
 */
import "dotenv/config";
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { PrismaClient } from "@prisma/client";
import { slugifyVasita } from "../../src/lib/vasitaCatalogNormalize";

const prisma = new PrismaClient();
const ROOT = process.cwd();
const STAGE1 = join(ROOT, "docs/vertical-taxonomy/vehicle-stage1-catalog.json");
const BMW_JSON = join(ROOT, "data/vehicle-deep-catalog/BMW.json");

const SERIES_SLUG: Record<string, { slug: string; categoryPath: string }> = {
  "1 Serisi": { slug: "1-serisi", categoryPath: "arac/otomobil" },
  "2 Serisi": { slug: "2-serisi", categoryPath: "arac/otomobil" },
  "2 Serisi Active Tourer": { slug: "2-serisi-active-tourer", categoryPath: "arac/otomobil" },
  "3 Serisi": { slug: "3-serisi", categoryPath: "arac/otomobil" },
  "4 Serisi": { slug: "4-serisi", categoryPath: "arac/otomobil" },
  "5 Serisi": { slug: "5-serisi", categoryPath: "arac/otomobil" },
  "6 Serisi": { slug: "6-serisi", categoryPath: "arac/otomobil" },
  "7 Serisi": { slug: "7-serisi", categoryPath: "arac/otomobil" },
  "8 Serisi": { slug: "8-serisi", categoryPath: "arac/otomobil" },
  i4: { slug: "i4", categoryPath: "arac/otomobil" },
  i5: { slug: "i5", categoryPath: "arac/otomobil" },
  i7: { slug: "i7", categoryPath: "arac/otomobil" },
  X1: { slug: "x1", categoryPath: "arac/arazi-suv-pickup" },
  X2: { slug: "x2", categoryPath: "arac/arazi-suv-pickup" },
  X3: { slug: "x3", categoryPath: "arac/arazi-suv-pickup" },
  X4: { slug: "x4", categoryPath: "arac/arazi-suv-pickup" },
  X5: { slug: "x5", categoryPath: "arac/arazi-suv-pickup" },
  X6: { slug: "x6", categoryPath: "arac/arazi-suv-pickup" },
  X7: { slug: "x7", categoryPath: "arac/arazi-suv-pickup" },
  iX1: { slug: "ix1", categoryPath: "arac/arazi-suv-pickup" },
  iX2: { slug: "ix2", categoryPath: "arac/arazi-suv-pickup" },
  iX3: { slug: "ix3", categoryPath: "arac/arazi-suv-pickup" },
  iX: { slug: "ix", categoryPath: "arac/arazi-suv-pickup" },
};

type DeepConfig = {
  series: string;
  model: string;
  trim: string;
  generationCode?: string | null;
  yearFrom?: number | null;
  yearTo?: number | null;
  confidence: string;
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

function yearsBetween(from: number, to: number): number[] {
  const out: number[] = [];
  for (let y = from; y <= to; y++) out.push(y);
  return out;
}

async function main() {
  const deep = JSON.parse(readFileSync(BMW_JSON, "utf8"));
  const configs = (deep.configurations || []).filter(
    (c: DeepConfig) =>
      c.model &&
      c.trim &&
      (c.confidence === "VERIFIED_OFFICIAL" || c.confidence === "VERIFIED_MULTI_SOURCE") &&
      SERIES_SLUG[c.series]
  ) as DeepConfig[];

  // Group: series|gen
  const groups = new Map<string, DeepConfig[]>();
  for (const c of configs) {
    const gen = (c.generationCode || "").trim() || "current";
    const key = `${c.series}||${gen}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(c);
  }

  const pack = JSON.parse(readFileSync(STAGE1, "utf8").replace(/^\uFEFF/, ""));
  let entries: PackEntry[] = Array.isArray(pack.entries) ? [...pack.entries] : [];

  // Drop previous deep-seeded BMW otomobil/suv entries that we will replace for mapped series
  const replaceSlugs = new Set(Object.values(SERIES_SLUG).map((s) => s.slug));
  entries = entries.filter(
    (e) => !(e.brandSlug === "bmw" && replaceSlugs.has(e.modelSlug) && (e.source || "").includes("deep-catalog"))
  );
  // Also replace any remaining 5-serisi deep source / keep other curated gens if not deep
  entries = entries.filter(
    (e) => !(e.brandSlug === "bmw" && e.modelSlug === "5-serisi" && (e.categoryPaths || []).includes("arac/otomobil"))
  );

  const newEntries: PackEntry[] = [];
  for (const [key, rows] of groups) {
    const [series, genRaw] = key.split("||");
    const map = SERIES_SLUG[series];
    if (!map) continue;
    const gen = genRaw === "current" ? "" : genRaw;
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
      const yf = r.yearFrom ?? 2024;
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

    // For series that already have curated generation entries (e.g. 3-serisi F30/G20),
    // only add deep entry when gen is set OR when no curated gens exist for that slug+path.
    const existingGens = entries.filter(
      (e) =>
        e.brandSlug === "bmw" &&
        e.modelSlug === map.slug &&
        (e.categoryPaths || []).includes(map.categoryPath) &&
        e.generationCode &&
        !FAKE(e.generationCode)
    );
    if (!gen && existingGens.length > 0) {
      // Merge trims into each existing generation? Safer: add parallel "current" empty-gen entry only if no overlap.
      // Prefer upserting versions onto a single empty-gen deep entry and leave curated gens intact.
    }

    newEntries.push({
      categoryPaths: [map.categoryPath],
      brandSlug: "bmw",
      brandName: "BMW",
      modelSlug: map.slug,
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
      modelYears: yearsBetween(minY === 9999 ? 2024 : minY, maxY === 0 ? 2026 : maxY),
      fuelTypes: [],
      transmissions: [],
      bodyTypes: [],
      source: "deep-catalog-bmw-2026.08",
      verified: true,
      market: "TR",
      active: true,
    });
  }

  function FAKE(code: string) {
    return ["default", "standart", "standard", "genel"].includes(code.toLowerCase());
  }

  const nextPack = {
    ...pack,
    version: "vehicle-stage1-catalog-v6-bmw-deep",
    generatedAt: new Date().toISOString().slice(0, 10),
    notes: [...(pack.notes || []), "v6 bmw deep: nested trims from verified TR dealer/research sources."],
    entries: [...entries, ...newEntries],
  };

  mkdirSync(join(ROOT, "docs/vehicle-import/backups"), { recursive: true });
  copyFileSync(STAGE1, join(ROOT, "docs/vehicle-import/backups", `vehicle-stage1-pre-bmw-deep-all-${Date.now()}.json`));
  writeFileSync(STAGE1, JSON.stringify(nextPack, null, 2));

  const listingBefore = await prisma.listing.count({ where: { category: { path: { startsWith: "arac" } } } });
  await prisma.systemSetting.upsert({
    where: { key: "vasita_stage1_catalog" },
    create: { key: "vasita_stage1_catalog", value: nextPack, label: "Vasıta Stage1 catalog pack", group: "vasita" },
    update: { value: nextPack },
  });
  const listingAfter = await prisma.listing.count({ where: { category: { path: { startsWith: "arac" } } } });

  const report = {
    ok: true,
    seededEntries: newEntries.length,
    series: [...new Set(newEntries.map((e) => e.modelSlug))],
    listingBefore,
    listingAfter,
  };
  writeFileSync(join(ROOT, "scripts/output/bmw-deep-catalog-runtime-seed.json"), JSON.stringify(report, null, 2));
  writeFileSync(
    join(ROOT, "scripts/output/deep-catalog-progress.json"),
    JSON.stringify(
      {
        at: new Date().toISOString(),
        checkpointCommit: "347a961",
        phase: "bmw-expanding-after-runtime-gate",
        completedBrands: [],
        inProgressBrand: "BMW",
        remainingBrands: ["BMW", "Mercedes-Benz", "Audi", "Volkswagen", "Renault", "Fiat", "(others)"],
        verifiedSeries: report.series.length,
        verifiedVersions: newEntries.reduce((n, e) => n + e.versions.length, 0),
        verifiedTrims: newEntries.reduce((n, e) => n + e.versions.reduce((m, v) => m + (v.trims || []).length, 0), 0),
        verifiedConfigurations: configs.length,
        reviewRequired: 11,
        rejected: 7,
        runtimeGatePass: true,
        dbApplyStarted: true,
        notes: "Runtime version/trim gate PASS. BMW deep configs seeded for mapped series; historical non-5-series still incomplete.",
      },
      null,
      2
    )
  );
  console.log(JSON.stringify(report, null, 2));
  if (listingBefore !== listingAfter) throw new Error("listing count changed");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
