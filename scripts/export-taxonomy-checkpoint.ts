/**
 * Export Category tree + CategoryBrand/Attribute/Model for pre-taxonomy checkpoint.
 * npx tsx scripts/export-taxonomy-checkpoint.ts
 */
import "dotenv/config";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const OUT = join(process.cwd(), "backups");

async function main() {
  mkdirSync(OUT, { recursive: true });
  const ts =
    process.env.CHECKPOINT_TS ||
    new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);

  const categories = await prisma.category.findMany({
    where: {
      OR: [
        { slug: { in: ["ikinci-el", "sifir-urun"] } },
        { slug: { startsWith: "ikinci-el" } },
        { slug: { startsWith: "sifir-urun" } },
      ],
    },
    orderBy: [{ path: "asc" }, { slug: "asc" }],
  });

  const ids = categories.map((c) => c.id);
  const [brands, attrs, models] = await Promise.all([
    prisma.categoryBrand.findMany({ where: { categoryId: { in: ids } } }),
    prisma.categoryAttribute.findMany({ where: { categoryId: { in: ids } } }),
    prisma.categoryModel.findMany({ where: { categoryId: { in: ids } } }),
  ]);

  const catFile = join(OUT, `pre-full-taxonomy-categories-${ts}.json`);
  const relFile = join(OUT, `pre-full-taxonomy-relations-${ts}.json`);
  writeFileSync(
    catFile,
    JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        count: categories.length,
        categories,
      },
      null,
      2
    ),
    "utf8"
  );
  writeFileSync(
    relFile,
    JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        categoryBrandCount: brands.length,
        categoryAttributeCount: attrs.length,
        categoryModelCount: models.length,
        categoryBrands: brands,
        categoryAttributes: attrs,
        categoryModels: models,
      },
      null,
      2
    ),
    "utf8"
  );

  const rollback = `-- Rollback notes for checkpoint ${ts}
-- 1) Restore dump: docker exec -i teklifbu-postgres pg_restore -U teklifbu -d teklifbu --clean --if-exists < backups/pre-full-taxonomy-*.dump
--    OR: docker cp backups/pre-full-taxonomy-*.dump teklifbu-postgres:/tmp/r.dump && docker exec teklifbu-postgres pg_restore -U teklifbu -d teklifbu --clean --if-exists /tmp/r.dump
-- 2) Soft-delete categories created after checkpoint using categories JSON (created IDs from apply report)
-- 3) Restore parentId/path from pre-full-taxonomy-categories-*.json for moved rows
-- 4) Call invalidateCatalogTreeCache / restart Next
`;
  writeFileSync(join(OUT, `pre-full-taxonomy-rollback-${ts}.md`), rollback, "utf8");
  console.log(JSON.stringify({ catFile, relFile, categoryCount: categories.length, brands: brands.length, attrs: attrs.length, models: models.length }, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
