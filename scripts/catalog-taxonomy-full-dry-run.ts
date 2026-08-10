/**
 * Read-only dry-run for catalog taxonomy conversion plan.
 * Regenerates plan artifacts if missing, prints summary. Never mutates DB categories.
 *
 * npx tsx scripts/catalog-taxonomy-full-dry-run.ts
 */
import "dotenv/config";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { spawnSync } from "child_process";

const ROOT = process.cwd();
const OUT = join(ROOT, "scripts", "output", "catalog-taxonomy-full-dry-run.json");
const GEN = join(ROOT, "scripts", "generate-catalog-taxonomy-plan.ts");

async function main() {
  if (!existsSync(OUT)) {
    console.log("Plan artifacts missing — generating (read-only vs DB)...");
    const r = spawnSync("npx", ["tsx", GEN], { cwd: ROOT, stdio: "inherit", shell: true });
    if (r.status !== 0) process.exit(r.status || 1);
  }
  const dry = JSON.parse(readFileSync(OUT, "utf8"));
  console.log("=== catalog-taxonomy-full-dry-run (NO DB WRITES) ===");
  console.log(JSON.stringify(dry, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
