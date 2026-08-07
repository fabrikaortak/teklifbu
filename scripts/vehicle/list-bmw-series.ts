/**
 * List selectable BMW series in DB vs deep-catalog coverage.
 * npx tsx scripts/vehicle/list-bmw-series.ts
 */
import "dotenv/config";
import { readFileSync } from "fs";
import { join } from "path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const bmw = await prisma.brand.findUnique({ where: { slug: "bmw" } });
  if (!bmw) throw new Error("BMW brand missing");

  const cms = await prisma.categoryModel.findMany({
    where: { model: { brandId: bmw.id, isActive: true } },
    include: { model: true, category: true },
  });

  const byPath: Record<string, string[]> = {};
  for (const c of cms) {
    const path = c.category.path;
    if (!path.startsWith("arac/")) continue;
    if (!byPath[path]) byPath[path] = [];
    byPath[path].push(`${c.model.name}|${c.model.slug}`);
  }

  const deep = JSON.parse(readFileSync(join(process.cwd(), "data/vehicle-deep-catalog/BMW.json"), "utf8"));
  const covered = new Map<string, { n: number; models: Set<string>; trims: Set<string> }>();
  for (const row of deep.configurations || []) {
    const cur = covered.get(row.series) || { n: 0, models: new Set(), trims: new Set() };
    cur.n++;
    if (row.model) cur.models.add(row.model);
    if (row.trim) cur.trims.add(row.trim);
    covered.set(row.series, cur);
  }

  console.log(
    JSON.stringify(
      {
        dbSeries: byPath,
        deepSeries: [...covered.entries()].map(([series, v]) => ({
          series,
          configs: v.n,
          models: [...v.models],
          trimCount: v.trims.size,
        })),
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
