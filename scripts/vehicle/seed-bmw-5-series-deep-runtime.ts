/**
 * Seed BMW 5 Series verified deep catalog (version + nested trims) into stage1 pack + SystemSetting.
 * Only VERIFIED_OFFICIAL / VERIFIED_MULTI_SOURCE. Idempotent.
 *
 * npx tsx scripts/vehicle/seed-bmw-5-series-deep-runtime.ts
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

type DeepConfig = {
  series: string;
  model: string;
  trim: string;
  generationCode?: string | null;
  yearFrom?: number | null;
  yearTo?: number | null;
  fuelType?: string | null;
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

function yearsBetween(from: number, to: number): number[] {
  const out: number[] = [];
  for (let y = from; y <= to; y++) out.push(y);
  return out;
}

async function main() {
  const deep = JSON.parse(readFileSync(BMW_JSON, "utf8"));
  const configs = (deep.configurations || []).filter(
    (c: DeepConfig) =>
      c.series === "5 Serisi" &&
      c.model &&
      c.trim &&
      (c.confidence === "VERIFIED_OFFICIAL" || c.confidence === "VERIFIED_MULTI_SOURCE")
  ) as DeepConfig[];

  if (!configs.length) throw new Error("No verified BMW 5 Series configs");

  const byGen = new Map<string, DeepConfig[]>();
  for (const c of configs) {
    const g = (c.generationCode || "").trim() || "unknown";
    if (!byGen.has(g)) byGen.set(g, []);
    byGen.get(g)!.push(c);
  }

  const pack = JSON.parse(readFileSync(STAGE1, "utf8").replace(/^\uFEFF/, ""));
  const entries: PackEntry[] = Array.isArray(pack.entries) ? [...pack.entries] : [];

  // Remove existing bmw/5-serisi otomobil entries — replace with deep versions
  const kept = entries.filter(
    (e) => !(e.brandSlug === "bmw" && e.modelSlug === "5-serisi" && (e.categoryPaths || []).includes("arac/otomobil"))
  );

  const newEntries: PackEntry[] = [];
  for (const [gen, rows] of byGen) {
    if (gen === "unknown") continue;
    const versionMap = new Map<
      string,
      {
        slug: string;
        name: string;
        trims: Array<{ slug: string; name: string; generationCode: string; yearFrom?: number; yearTo?: number }>;
        yearFrom: number;
        yearTo: number;
      }
    >();
    let minY = 9999;
    let maxY = 0;
    for (const r of rows) {
      const yf = r.yearFrom ?? 2017;
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
          generationCode: gen,
          yearFrom: yf,
          yearTo: yt,
        });
      }
    }

    newEntries.push({
      categoryPaths: ["arac/otomobil"],
      brandSlug: "bmw",
      brandName: "BMW",
      modelSlug: "5-serisi",
      modelName: "5 Serisi",
      generationCode: gen,
      generationLabel: gen,
      versions: [...versionMap.values()]
        .map((v) => ({
          slug: v.slug,
          name: v.name,
          yearFrom: v.yearFrom,
          yearTo: v.yearTo,
          trims: v.trims.sort((a, b) => a.name.localeCompare(b.name, "tr")),
        }))
        .sort((a, b) => a.name.localeCompare(b.name, "tr")),
      modelYears: yearsBetween(minY, maxY),
      fuelTypes: [],
      transmissions: [],
      bodyTypes: [],
      source: "deep-catalog-bmw-5-series-2026.08",
      verified: true,
      market: "TR",
      active: true,
    });
  }

  const nextPack = {
    ...pack,
    version: "vehicle-stage1-catalog-v6-version-trim",
    generatedAt: new Date().toISOString().slice(0, 10),
    source: "version-trim-runtime-bmw-5-2026.08",
    notes: [
      ...(pack.notes || []),
      "v6: versions may nest trims[]; BMW 5 Series seeded from verified deep research.",
    ],
    entries: [...kept, ...newEntries],
  };

  mkdirSync(join(ROOT, "docs/vehicle-import/backups"), { recursive: true });
  copyFileSync(STAGE1, join(ROOT, "docs/vehicle-import/backups", `vehicle-stage1-pre-bmw5-deep-${Date.now()}.json`));
  writeFileSync(STAGE1, JSON.stringify(nextPack, null, 2));

  const listingBefore = await prisma.listing.findMany({
    where: { category: { path: { startsWith: "arac" } } },
    select: { id: true, categoryId: true },
  });

  await prisma.systemSetting.upsert({
    where: { key: "vasita_stage1_catalog" },
    create: { key: "vasita_stage1_catalog", value: nextPack, label: "Vasıta Stage1 catalog pack", group: "vasita" },
    update: { value: nextPack },
  });

  const listingAfter = await prisma.listing.findMany({
    where: { id: { in: listingBefore.map((l) => l.id) } },
    select: { id: true, categoryId: true },
  });
  const beforeMap = new Map(listingBefore.map((l) => [l.id, l.categoryId]));
  let categoryIdChanges = 0;
  for (const a of listingAfter) {
    if (beforeMap.get(a.id) !== a.categoryId) categoryIdChanges++;
  }

  const report = {
    ok: true,
    generationsSeeded: newEntries.map((e) => e.generationCode),
    versionsByGen: Object.fromEntries(
      newEntries.map((e) => [e.generationCode, e.versions.map((v) => ({ name: v.name, trims: (v.trims || []).map((t) => t.name) }))])
    ),
    listingCount: listingBefore.length,
    categoryIdChanges,
  };
  writeFileSync(join(ROOT, "scripts/output/bmw-5-deep-runtime-seed-report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (categoryIdChanges > 0) throw new Error("listing categoryId changed");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
