/**
 * Export vasıta/emlak Category + sample listings + copy SoT files.
 * CHECKPOINT_TS=... npx tsx scripts/export-vehicle-property-checkpoint.ts
 */
import "dotenv/config";
import { writeFileSync, copyFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const OUT = join(process.cwd(), "backups");
const ts =
  process.env.CHECKPOINT_TS || new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);

async function main() {
  mkdirSync(OUT, { recursive: true });

  const cats = await prisma.category.findMany({
    where: {
      OR: [
        { slug: { in: ["arac", "konut", "isyeri", "arsa", "kiralik"] } },
        { path: { startsWith: "arac" } },
        { path: { startsWith: "konut" } },
        { path: { startsWith: "isyeri" } },
        { path: { startsWith: "arsa" } },
        { slug: { startsWith: "arac" } },
        { slug: { startsWith: "arac__" } },
      ],
    },
    orderBy: [{ path: "asc" }, { slug: "asc" }],
  });

  const listingSample = await prisma.listing.findMany({
    where: { category: { slug: { in: ["arac", "konut", "isyeri", "arsa", "kiralik"] } } },
    take: 100,
    select: {
      id: true,
      listingNo: true,
      categoryId: true,
      dealType: true,
      attributes: true,
      title: true,
      status: true,
      createdAt: true,
    },
  });

  const byCat = await prisma.listing.groupBy({
    by: ["categoryId"],
    _count: { _all: true },
  });

  writeFileSync(
    join(OUT, `pre-vehicle-property-categories-${ts}.json`),
    JSON.stringify({ exportedAt: new Date().toISOString(), count: cats.length, categories: cats }, null, 2)
  );
  writeFileSync(
    join(OUT, `pre-vehicle-property-listing-sample-${ts}.json`),
    JSON.stringify(
      { exportedAt: new Date().toISOString(), byCategory: byCat, sample: listingSample },
      null,
      2
    )
  );

  for (const [src, dest] of [
    ["src/data/vehicleCatalog.ts", `pre-vehicle-property-vehicleCatalog-${ts}.ts`],
    ["src/data/housingFormFields.ts", `pre-vehicle-property-housingFormFields-${ts}.ts`],
    ["src/data/vehicleFormFields.ts", `pre-vehicle-property-vehicleFormFields-${ts}.ts`],
    [
      "docs/vertical-taxonomy/vehicle-stage1-target-tree.json",
      `pre-vehicle-property-target-tree-${ts}.json`,
    ],
  ] as const) {
    if (existsSync(src)) copyFileSync(src, join(OUT, dest));
  }

  writeFileSync(
    join(OUT, `pre-vehicle-property-rollback-${ts}.md`),
    `# Rollback checkpoint-pre-vehicle-property-stage1 (${ts})

1. Restore DB:
   docker cp backups/pre-vehicle-property-stage1-${ts}.dump teklifbu-postgres:/tmp/r.dump
   docker exec teklifbu-postgres pg_restore -U teklifbu -d teklifbu --clean --if-exists /tmp/r.dump

2. Soft-delete Category rows with path starting arac/ created after checkpoint (see categories JSON).

3. git checkout checkpoint-pre-vehicle-property-stage1 -- .   (or reset only stage1 files)

4. Restart Next / invalidate caches.
`
  );

  console.log(
    JSON.stringify(
      { ts, categoryCount: cats.length, listingSample: listingSample.length, out: OUT },
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
