/**
 * Dry-run planner for deep vehicle catalog (model/engine + trim/package).
 * Research-only until --allow-apply-plan. Does not write DB.
 *
 * npx tsx scripts/vehicle/plan-deep-vehicle-catalog.ts
 */
import "dotenv/config";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "fs";
import { join } from "path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const ROOT = process.cwd();
const DATA_DIR = join(ROOT, "data/vehicle-deep-catalog");
const OUT = join(ROOT, "scripts/output");
const DOCS = join(ROOT, "docs/vehicle-research");

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
  sources?: unknown[];
};

function toCsv(rows: Array<Record<string, string | number | boolean>>, cols: string[]): string {
  const esc = (v: string | number | boolean) => {
    const s = String(v ?? "");
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c] ?? "")).join(","))].join("\n");
}

function loadDeepConfigs(): DeepConfig[] {
  if (!existsSync(DATA_DIR)) return [];
  const files = readdirSync(DATA_DIR).filter((f) => f.endsWith(".json"));
  const all: DeepConfig[] = [];
  for (const f of files) {
    const raw = JSON.parse(readFileSync(join(DATA_DIR, f), "utf8"));
    for (const c of raw.configurations || []) all.push(c);
  }
  return all;
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  mkdirSync(DOCS, { recursive: true });

  const configs = loadDeepConfigs().filter(
    (c) => c.confidence === "VERIFIED_OFFICIAL" || c.confidence === "VERIFIED_MULTI_SOURCE"
  );
  const review = loadDeepConfigs().filter((c) => c.confidence === "REVIEW_REQUIRED");
  const rejected = loadDeepConfigs().filter((c) => c.confidence === "REJECTED");

  const packPath = join(ROOT, "docs/vertical-taxonomy/vehicle-stage1-catalog.json");
  const pack = existsSync(packPath)
    ? JSON.parse(readFileSync(packPath, "utf8").replace(/^\uFEFF/, ""))
    : { entries: [] };

  const existingVersionNames = new Set<string>();
  for (const e of pack.entries || []) {
    if (e.brandSlug !== "bmw" || e.modelSlug !== "5-serisi") continue;
    for (const v of e.versions || []) existingVersionNames.add(String(v.name || "").toLowerCase());
  }

  const decisions: Array<Record<string, string | number | boolean>> = [];
  let createModel = 0;
  let createTrim = 0;
  let keep = 0;
  let updateMeta = 0;

  for (const c of configs) {
    const modelExistsAsVersion = existingVersionNames.has(c.model.toLowerCase());
    // Current pack has no true trim layer — every verified trim is CREATE_TRIM structurally
    const decision = modelExistsAsVersion ? "CREATE_TRIM" : "CREATE_MODEL";
    if (decision === "CREATE_TRIM") createTrim++;
    else createModel++;
    decisions.push({
      brand: c.brand,
      series: c.series,
      model: c.model,
      trim: c.trim,
      generationCode: c.generationCode || "",
      yearFrom: c.yearFrom ?? "",
      yearTo: c.yearTo ?? "",
      confidence: c.confidence,
      decision,
      notes: modelExistsAsVersion
        ? "Engine already present as pack version leaf; trim layer missing in runtime"
        : "Engine not present as distinct pack version; needs model+trim depth",
    });
  }

  for (const c of review) {
    decisions.push({
      brand: c.brand,
      series: c.series,
      model: c.model,
      trim: c.trim || "",
      generationCode: c.generationCode || "",
      yearFrom: c.yearFrom ?? "",
      yearTo: c.yearTo ?? "",
      confidence: c.confidence,
      decision: "REVIEW_REQUIRED",
      notes: "Not eligible for auto-apply",
    });
  }

  const listingCount = await prisma.listing.count({
    where: { category: { path: { startsWith: "arac" } } },
  });

  const byBrand = new Map<string, { series: Set<string>; models: Set<string>; trims: Set<string>; gens: Set<string>; vo: number; vm: number; rr: number; rj: number }>();
  for (const c of loadDeepConfigs()) {
    const b = byBrand.get(c.brand) || {
      series: new Set(),
      models: new Set(),
      trims: new Set(),
      gens: new Set(),
      vo: 0,
      vm: 0,
      rr: 0,
      rj: 0,
    };
    if (c.series) b.series.add(c.series);
    if (c.model) b.models.add(c.model);
    if (c.trim) b.trims.add(c.trim);
    if (c.generationCode) b.gens.add(c.generationCode);
    if (c.confidence === "VERIFIED_OFFICIAL") b.vo++;
    else if (c.confidence === "VERIFIED_MULTI_SOURCE") b.vm++;
    else if (c.confidence === "REVIEW_REQUIRED") b.rr++;
    else if (c.confidence === "REJECTED") b.rj++;
    byBrand.set(c.brand, b);
  }

  const summaryRows = [...byBrand.entries()].map(([brand, b]) => ({
    brand,
    seriesCount: b.series.size,
    modelCount: b.models.size,
    trimCount: b.trims.size,
    generationCount: b.gens.size,
    verifiedOfficial: b.vo,
    verifiedMultiSource: b.vm,
    reviewRequired: b.rr,
    rejected: b.rj,
    coveragePercent: "",
  }));

  const plan = {
    at: new Date().toISOString(),
    dryRun: true,
    applyAllowed: false,
    reasonApplyBlocked:
      "Deep catalog incomplete (BMW 5 Series proof only). Runtime schema still Brand→Series→mixed versions. Need backward-compatible version+trim API split before apply.",
    listingCount,
    counts: {
      verifiedConfigs: configs.length,
      createModel,
      createTrim,
      keep,
      updateMeta,
      reviewRequired: review.length,
      rejected: rejected.length,
    },
    architectureNote: {
      currentLeaf: "pack.versions stored as attributes.trim (mixed engine/package)",
      target: "Series → Model/Engine → Trim/Package; generation as metadata",
      prismaTrimTable: false,
      proposedStorage: "pack.versions[].trims[] + attributes.version + attributes.trim (nullable)",
    },
    decisions: decisions.slice(0, 500),
    brandSummary: summaryRows,
  };

  writeFileSync(join(OUT, "deep-vehicle-catalog-plan.json"), JSON.stringify(plan, null, 2));
  writeFileSync(
    join(DOCS, "deep-catalog-summary.csv"),
    toCsv(summaryRows, [
      "brand",
      "seriesCount",
      "modelCount",
      "trimCount",
      "generationCount",
      "verifiedOfficial",
      "verifiedMultiSource",
      "reviewRequired",
      "rejected",
      "coveragePercent",
    ])
  );
  writeFileSync(
    join(DOCS, "deep-catalog-review-required.csv"),
    toCsv(
      decisions.filter((d) => d.decision === "REVIEW_REQUIRED"),
      ["brand", "series", "model", "trim", "generationCode", "yearFrom", "yearTo", "confidence", "decision", "notes"]
    )
  );
  writeFileSync(
    join(DOCS, "deep-catalog-source-report.csv"),
    toCsv(
      decisions.filter((d) => d.decision !== "REVIEW_REQUIRED" && d.decision !== "REJECT_SOURCE"),
      ["brand", "series", "model", "trim", "generationCode", "yearFrom", "yearTo", "confidence", "decision", "notes"]
    )
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        dryRun: true,
        applyAllowed: false,
        verifiedConfigs: configs.length,
        createModel,
        createTrim,
        reviewRequired: review.length,
        listingCount,
        brandFiles: existsSync(DATA_DIR) ? readdirSync(DATA_DIR).filter((f) => f.endsWith(".json")).length : 0,
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
