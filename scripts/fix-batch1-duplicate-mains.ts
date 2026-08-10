/**
 * Fix Batch1 duplicate ana nodes caused by slugify("Spor ve Outdoor") vs existing spor-outdoor.
 * Soft-delete newer duplicate mains and reparent their children onto the canonical slug.
 *
 * npx tsx scripts/fix-batch1-duplicate-mains.ts --apply
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { invalidateCatalogTreeCache } from "../src/core/services/catalog/catalogTreeCache";

const prisma = new PrismaClient();
const apply = process.argv.includes("--apply");

/** canonicalSlug (without root) -> aliases to fold into it */
const FOLDS: Record<string, string[]> = {
  "spor-outdoor": ["spor-ve-outdoor"],
};

async function foldRoot(root: "sifir-urun" | "ikinci-el") {
  const report: Array<Record<string, unknown>> = [];
  for (const [canonKey, aliases] of Object.entries(FOLDS)) {
    const canonSlug = `${root}__${canonKey}`;
    const canon = await prisma.category.findFirst({
      where: { slug: canonSlug, deletedAt: null },
    });
    if (!canon) {
      report.push({ root, canonSlug, status: "missing_canonical" });
      continue;
    }
    for (const alias of aliases) {
      const aliasSlug = `${root}__${alias}`;
      const dup = await prisma.category.findFirst({
        where: { slug: aliasSlug, deletedAt: null },
      });
      if (!dup) {
        report.push({ root, aliasSlug, status: "no_duplicate" });
        continue;
      }
      const children = await prisma.category.findMany({
        where: { parentId: dup.id, deletedAt: null },
        select: { id: true, slug: true, name: true, path: true },
      });
      const rel = {
        listings: await prisma.listing.count({ where: { categoryId: dup.id } }),
        products: await prisma.product.count({ where: { categoryId: dup.id, deletedAt: null } }),
      };
      report.push({
        root,
        aliasSlug,
        canonSlug,
        children: children.length,
        rel,
        action: apply ? "fold" : "dry",
      });
      if (!apply) continue;
      if (rel.listings + rel.products > 0) {
        report[report.length - 1].action = "skipped_has_relations";
        continue;
      }
      for (const ch of children) {
        // avoid slug collision under canon: keep child, only reparent if no sibling same name
        const sibling = await prisma.category.findFirst({
          where: { parentId: canon.id, name: ch.name, deletedAt: null, NOT: { id: ch.id } },
        });
        if (sibling) {
          // soft-delete this child tree leaf-level duplicate empty
          await prisma.category.update({
            where: { id: ch.id },
            data: { deletedAt: new Date(), isActive: false },
          });
        } else {
          const newPath = (ch.path || "").replace(`/${alias}/`, `/${canonKey}/`).replace(`/${alias}`, `/${canonKey}`);
          const newSlug = ch.slug.replace(`__${alias}__`, `__${canonKey}__`).replace(`__${alias}`, `__${canonKey}`);
          const clash = await prisma.category.findFirst({
            where: { slug: newSlug, NOT: { id: ch.id } },
          });
          await prisma.category.update({
            where: { id: ch.id },
            data: {
              parentId: canon.id,
              path: newPath.startsWith(root) ? newPath : ch.path,
              slug: clash ? ch.slug : newSlug,
            },
          });
        }
      }
      await prisma.category.update({
        where: { id: dup.id },
        data: { deletedAt: new Date(), isActive: false },
      });
    }
  }
  return report;
}

async function main() {
  const report = {
    generatedAt: new Date().toISOString(),
    apply,
    sifir: await foldRoot("sifir-urun"),
    ikinci: await foldRoot("ikinci-el"),
  };
  if (apply) invalidateCatalogTreeCache();
  console.log(JSON.stringify(report, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
