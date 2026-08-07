/**
 * Mark brands COMPLETED when research quality gate met:
 * - seriesCovered scanned
 * - verified configs exist OR all series are REVIEW_REQUIRED with notes
 * - no version/trim collisions in brand file
 *
 * Does NOT invent data. BMW already COMPLETED.
 * npx tsx scripts/vehicle/mark-completed-brands.ts
 */
import { readdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

const DIR = join(process.cwd(), "data/vehicle-deep-catalog");
const PACKAGE_WORDS = new Set(
  ["m sport", "s line", "r-line", "icon", "touch", "allure", "exclusive", "amg line", "life", "style"].map((s) =>
    s.toLocaleLowerCase("tr-TR")
  )
);

function main() {
  const progress: Array<Record<string, unknown>> = [];
  for (const f of readdirSync(DIR).filter((x) => x.endsWith(".json"))) {
    const path = join(DIR, f);
    const raw = JSON.parse(readFileSync(path, "utf8"));
    const configs = raw.configurations || [];
    const verified = configs.filter(
      (c: any) =>
        c.model &&
        c.trim &&
        (c.confidence === "VERIFIED_OFFICIAL" || c.confidence === "VERIFIED_MULTI_SOURCE")
    );
    const review = configs.filter((c: any) => c.confidence === "REVIEW_REQUIRED");
    const series = new Set(configs.map((c: any) => c.series).filter(Boolean));
    let collision = false;
    for (const c of verified) {
      if (PACKAGE_WORDS.has(String(c.model).toLocaleLowerCase("tr-TR"))) collision = true;
    }
    const researched = series.size > 0 && (verified.length > 0 || review.length > 0);
    // Complete if researched, no collision, and every series has either a verified row or a REVIEW stub
    const seriesOk = [...series].every((s) => {
      const rows = configs.filter((c: any) => c.series === s);
      return rows.some(
        (c: any) =>
          c.confidence === "REVIEW_REQUIRED" ||
          c.confidence === "REJECTED" ||
          (c.model &&
            c.trim &&
            (c.confidence === "VERIFIED_OFFICIAL" || c.confidence === "VERIFIED_MULTI_SOURCE"))
      );
    });
    const canComplete = researched && !collision && seriesOk && series.size >= 1;
    if (canComplete && raw.status !== "COMPLETED") {
      // Require at least one verified config for completedBrands (stubs-only = still IN_PROGRESS)
      if (verified.length === 0) {
        progress.push({ brand: raw.brand, file: f, completed: false, reason: "no verified configs yet" });
        continue;
      }
      raw.status = "COMPLETED";
      raw.completedAt = new Date().toISOString();
      writeFileSync(path, JSON.stringify(raw, null, 2));
      progress.push({
        brand: raw.brand,
        file: f,
        completed: true,
        verified: verified.length,
        review: review.length,
        series: series.size,
      });
    } else {
      progress.push({
        brand: raw.brand,
        file: f,
        completed: raw.status === "COMPLETED",
        verified: verified.length,
        review: review.length,
        series: series.size,
        canComplete,
        collision,
      });
    }
  }
  writeFileSync(join(process.cwd(), "scripts/output/deep-catalog-brand-completion.json"), JSON.stringify(progress, null, 2));
  console.log(JSON.stringify({ marked: progress.filter((p) => p.completed).length, progress }, null, 2));
}

main();
