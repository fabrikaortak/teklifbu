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

  const brandFiles = existsSync(DATA_DIR) ? readdirSync(DATA_DIR).filter((f) => f.endsWith(".json")) : [];
  const completedBrands: string[] = [];
  const incompleteBrands: string[] = [];
  for (const f of brandFiles) {
    const raw = JSON.parse(readFileSync(join(DATA_DIR, f), "utf8"));
    if (raw.status === "COMPLETED") completedBrands.push(raw.brand || f);
    else incompleteBrands.push(raw.brand || f);
  }

  // Collision scan across verified configs
  const packageWords = new Set(
    ["m sport", "s line", "r-line", "icon", "touch", "allure", "exclusive", "amg line", "life", "style", "impression"].map(
      (s) => s.toLocaleLowerCase("tr-TR")
    )
  );
  let versionTrimCollision = 0;
  const versionNames = new Set<string>();
  const trimNames = new Set<string>();
  for (const c of configs) {
    const vn = c.model.toLocaleLowerCase("tr-TR");
    const tn = c.trim.toLocaleLowerCase("tr-TR");
    versionNames.add(vn);
    trimNames.add(tn);
    if (packageWords.has(vn)) versionTrimCollision++;
  }

  const bmwDone = completedBrands.includes("BMW");
  const runtimeGatePass = true; // checkpoint 347a961
  const applyAllowed =
    runtimeGatePass &&
    bmwDone &&
    incompleteBrands.length === 0 &&
    versionTrimCollision === 0 &&
    listingCount >= 0;

  const plan = {
    at: new Date().toISOString(),
    dryRun: true,
    applyAllowed,
    reasonApplyBlocked: applyAllowed
      ? null
      : [
          !bmwDone ? "BMW not COMPLETED" : null,
          incompleteBrands.length ? `incomplete brands: ${incompleteBrands.join(", ")}` : null,
          versionTrimCollision ? `version/trim collisions: ${versionTrimCollision}` : null,
        ]
          .filter(Boolean)
          .join("; "),
    checkpointCommit: "347a961",
    listingCount,
    completedBrands,
    incompleteBrands,
    counts: {
      verifiedConfigs: configs.length,
      createVersion: createModel,
      createTrim,
      keep,
      updateMeta,
      reviewRequired: review.length,
      rejected: rejected.length,
      versionTrimCollision,
      generationCount: [...new Set(configs.map((c) => c.generationCode).filter(Boolean))].length,
    },
    architectureNote: {
      currentLeaf: "pack.versions[].trims[] + attributes.version + attributes.trim",
      prismaTrimTable: false,
      electricOverlay: "preserve — no duplicate EV series",
    },
    decisions: decisions.slice(0, 500),
    brandSummary: summaryRows,
  };

  writeFileSync(join(OUT, "deep-vehicle-catalog-plan.json"), JSON.stringify(plan, null, 2));
  writeFileSync(
    join(DOCS, "deep-catalog-final-summary.csv"),
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
    join(DOCS, "deep-catalog-rejected.csv"),
    toCsv(
      rejected.map((c) => ({
        brand: c.brand,
        series: c.series,
        model: c.model,
        trim: c.trim || "",
        generationCode: c.generationCode || "",
        yearFrom: c.yearFrom ?? "",
        yearTo: c.yearTo ?? "",
        confidence: c.confidence,
        decision: "REJECTED",
        notes: "Not eligible for runtime",
      })),
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

  writeFileSync(
    join(OUT, "deep-catalog-progress.json"),
    JSON.stringify(
      {
        at: new Date().toISOString(),
        checkpointCommit: "347a961",
        phase: applyAllowed ? "ready-to-apply" : "brand-research-in-progress",
        completedBrands,
        incompleteBrands,
        applyAllowed,
        runtimeGatePass: true,
        bmwCompleted: bmwDone,
        verifiedConfigurations: configs.length,
        reviewRequired: review.length,
        rejected: rejected.length,
        listingCount,
      },
      null,
      2
    )
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        dryRun: true,
        applyAllowed,
        reasonApplyBlocked: plan.reasonApplyBlocked,
        verifiedConfigs: configs.length,
        createVersion: createModel,
        createTrim,
        reviewRequired: review.length,
        listingCount,
        completedBrands: completedBrands.length,
        incompleteBrands: incompleteBrands.length,
        brandFiles: brandFiles.length,
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
