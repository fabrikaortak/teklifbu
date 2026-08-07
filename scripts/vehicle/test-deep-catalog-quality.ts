/**
 * Quality gate: version/trim collision + brand coverage report.
 * npx tsx scripts/vehicle/test-deep-catalog-quality.ts
 */
import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const ROOT = process.cwd();
const DATA = join(ROOT, "data/vehicle-deep-catalog");
const OUT = join(ROOT, "scripts/output");

const PACKAGE_WORDS = new Set(
  [
    "m sport",
    "edition m sport",
    "sport line",
    "luxury line",
    "s line",
    "r-line",
    "icon",
    "touch",
    "joy",
    "allure",
    "elegance",
    "highline",
    "comfortline",
    "exclusive",
    "avantgarde",
    "progressive",
    "amg line",
    "comfort",
    "life",
    "style",
    "impression",
    "advanced",
  ].map((s) => s.toLocaleLowerCase("tr-TR"))
);

type Conf = {
  brand: string;
  series: string;
  model?: string;
  trim?: string;
  confidence: string;
  generationCode?: string;
};

function main() {
  const files = existsSync(DATA) ? readdirSync(DATA).filter((f) => f.endsWith(".json")) : [];
  const brands: Array<Record<string, unknown>> = [];
  let collisions = 0;
  let dupVersion = 0;
  let dupTrim = 0;
  let verifiedTotal = 0;
  let reviewTotal = 0;
  let rejectedTotal = 0;

  for (const f of files) {
    const raw = JSON.parse(readFileSync(join(DATA, f), "utf8"));
    const configs: Conf[] = raw.configurations || [];
    const verified = configs.filter(
      (c) =>
        c.model &&
        c.trim &&
        (c.confidence === "VERIFIED_OFFICIAL" || c.confidence === "VERIFIED_MULTI_SOURCE")
    );
    const review = configs.filter((c) => c.confidence === "REVIEW_REQUIRED");
    const rejected = configs.filter((c) => c.confidence === "REJECTED");
    verifiedTotal += verified.length;
    reviewTotal += review.length;
    rejectedTotal += rejected.length;

    const series = new Set(configs.map((c) => c.series).filter(Boolean));
    const versions = new Set(verified.map((c) => c.model!.toLocaleLowerCase("tr-TR")));
    const trims = new Set(verified.map((c) => c.trim!.toLocaleLowerCase("tr-TR")));
    const brandCollisions: string[] = [];
    for (const v of versions) {
      if (PACKAGE_WORDS.has(v)) {
        brandCollisions.push(`version_looks_like_trim:${v}`);
        collisions++;
      }
    }
    for (const t of trims) {
      // engines often contain digits; package words as trims are OK
      if (/\d/.test(t) && /tdi|tsi|tce|dci|tfsi|xdrive|drive/i.test(t)) {
        brandCollisions.push(`trim_looks_like_version:${t}`);
        collisions++;
      }
    }

    // Exact duplicate = same series+gen+model+trim+year window
    const tKeys = new Map<string, number>();
    for (const c of verified) {
      const tk = `${c.series}|${c.generationCode || ""}|${c.model}|${c.trim}|${(c as any).yearFrom ?? ""}|${(c as any).yearTo ?? ""}`;
      tKeys.set(tk, (tKeys.get(tk) || 0) + 1);
    }
    for (const [k, n] of tKeys) {
      if (n > 1) {
        dupTrim++;
        brandCollisions.push(`duplicate_trim_config:${k}`);
      }
    }

    brands.push({
      brand: raw.brand || f.replace(/\.json$/, ""),
      file: f,
      status: raw.status || "UNKNOWN",
      seriesResearched: series.size,
      versionsVerified: versions.size,
      trimsVerified: trims.size,
      verifiedConfigurations: verified.length,
      reviewRequired: review.length,
      rejected: rejected.length,
      collisions: brandCollisions,
      completed: raw.status === "COMPLETED",
    });
  }

  const report = {
    at: new Date().toISOString(),
    brandFiles: files.length,
    brands,
    totals: {
      verifiedConfigurations: verifiedTotal,
      reviewRequired: reviewTotal,
      rejected: rejectedTotal,
      versionTrimCollisions: collisions,
      duplicateTrimConfigs: dupTrim,
      duplicateVersions: dupVersion,
    },
    pass: collisions === 0 && dupTrim === 0,
  };
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, "deep-catalog-quality.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (!report.pass) process.exit(1);
}

main();
