import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import {
  CATEGORY_BROWSE_TREE,
  matchBrowsePath,
  validateListingCategorySelection,
} from "@/data/categoryBrowseTree";

const prisma = new PrismaClient();

async function main() {
  const under = await prisma.category.count({ where: { path: { startsWith: "arac/" } } });
  const orphans = await prisma.category.findMany({
    where: { path: { startsWith: "arac/" }, parentId: null },
    select: { slug: true, path: true },
  });
  const sample = await prisma.category.findMany({
    where: {
      slug: {
        in: ["arac", "arac__otomobil", "arac__motosiklet", "arac__motosiklet__scooter", "arac__utv"],
      },
    },
    select: { slug: true, path: true, parentId: true, level: true, name: true },
  });
  const alias = await prisma.categoryAlias.count({
    where: { oldSlug: { startsWith: "legacy-subtype-" } },
  });

  const emlak = matchBrowsePath({
    category: "konut",
    dealType: "SATILIK",
    subtype: "daire",
    rental: "",
  });
  const emlakValidate = validateListingCategorySelection({
    categorySlug: "konut",
    dealType: "SATILIK",
    attributes: { subtype: "daire" },
  });
  const mains = CATEGORY_BROWSE_TREE.find((n) => n.id === "arac")?.children?.map((c) => c.name);

  const issues: string[] = [];
  if (under < 100) issues.push(`expected >=100 arac children, got ${under}`);
  if (orphans.length) issues.push(`orphans: ${orphans.map((o) => o.slug).join(",")}`);
  if (!sample.find((s) => s.slug === "arac__otomobil")) issues.push("missing arac__otomobil");
  if (!sample.find((s) => s.slug === "arac__motosiklet__scooter")?.parentId)
    issues.push("scooter missing parent");
  if (emlakValidate) issues.push(`emlak validate: ${emlakValidate}`);
  if ((mains?.length || 0) !== 15) issues.push(`mains ${mains?.length}`);

  console.log(
    JSON.stringify(
      { ok: issues.length === 0, under, orphanCount: orphans.length, alias, sample, emlak, emlakValidate, mains: mains?.length, issues },
      null,
      2
    )
  );
  if (issues.length) process.exit(1);
}

main()
  .finally(() => prisma.$disconnect());
