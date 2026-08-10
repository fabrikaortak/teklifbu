/**
 * Post Batch-2 single-canonical-tree verification.
 * npx tsx scripts/test-catalog-taxonomy-batch2.ts
 */
import "dotenv/config";
import { readFileSync } from "fs";
import { PrismaClient } from "@prisma/client";
import { catalogSlugify } from "../src/lib/catalogSlug";
import { getCatalogTree } from "../src/core/services/catalog/categoryTreeService";
import { resolveAlisverisBrowseTree } from "../src/lib/alisverisBrowseFromDb";

const prisma = new PrismaClient();
const MAIN_SLUG_ALIASES: Record<string, string> = { "spor-ve-outdoor": "spor-outdoor" };

function instanceSlug(root: string, pathNames: string[]) {
  const segs = pathNames.map((p) => catalogSlugify(p));
  if (segs[0] && MAIN_SLUG_ALIASES[segs[0]]) segs[0] = MAIN_SLUG_ALIASES[segs[0]];
  return [root, ...segs].join("__");
}

function flattenCanon(roots: any[]): Set<string> {
  const out = new Set<string>(["sifir-urun", "ikinci-el"]);
  function walk(n: any, parents: string[]) {
    const pathNames = [...parents, n.name];
    out.add(instanceSlug("sifir-urun", pathNames));
    out.add(instanceSlug("ikinci-el", pathNames));
    for (const c of n.children || []) walk(c, pathNames);
  }
  for (const r of roots) walk(r, []);
  return out;
}

type Check = { name: string; ok: boolean; detail?: string };

async function main() {
  const checks: Check[] = [];
  const treeJson = JSON.parse(readFileSync("docs/catalog-taxonomy/full-target-tree.json", "utf8"));
  const canon = flattenCanon(treeJson.roots);

  const active = await prisma.category.findMany({
    where: {
      deletedAt: null,
      isActive: true,
      OR: [{ slug: { startsWith: "sifir-urun" } }, { slug: { startsWith: "ikinci-el" } }],
    },
    select: { id: true, slug: true, name: true, path: true, parentId: true },
  });

  const nonCanon = active.filter((c) => !canon.has(c.slug));
  checks.push({
    name: "only_canon_slugs",
    ok: nonCanon.length === 0 && active.length === canon.size,
    detail: `active=${active.length} canon=${canon.size} nonCanon=${nonCanon.length}`,
  });

  const oldFridge = active.filter(
    (c) =>
      /beyaz-esya__buzdolabi$/.test(c.slug) ||
      /beyaz-esya\/buzdolabi$/.test(c.path || "") ||
      (c.slug.includes("beyaz-esya") && !c.slug.includes("sogutma") && /buzdolabi|tek-kapili|cift-kapili/.test(c.slug))
  );
  checks.push({
    name: "no_old_beyaz_esya_direct_fridge",
    ok: oldFridge.length === 0,
    detail: oldFridge.map((c) => c.slug).join(",") || "none",
  });

  const fridgeSifir = active.filter(
    (c) => c.slug.startsWith("sifir-urun") && c.name.toLocaleLowerCase("tr") === "buzdolabı"
  );
  checks.push({
    name: "single_buzdolabi_under_sogutma",
    ok:
      fridgeSifir.length === 1 &&
      fridgeSifir[0].slug === "sifir-urun__ev-aletleri__beyaz-esya__sogutma__buzdolabi",
    detail: fridgeSifir.map((c) => c.slug).join("|"),
  });

  const byParentName = new Map<string, number>();
  for (const a of active) {
    const k = `${a.parentId}::${a.name.toLocaleLowerCase("tr")}`;
    byParentName.set(k, (byParentName.get(k) || 0) + 1);
  }
  const sameParentDups = [...byParentName.entries()].filter(([, n]) => n > 1);
  checks.push({
    name: "no_same_parent_duplicate_name",
    ok: sameParentDups.length === 0,
    detail: String(sameParentDups.length),
  });

  const orphans = await prisma.$queryRaw<Array<{ id: string; slug: string }>>`
    SELECT c.id, c.slug FROM "Category" c
    LEFT JOIN "Category" p ON p.id = c."parentId"
    WHERE c."deletedAt" IS NULL AND c."isActive" = true
      AND (c.slug LIKE 'sifir-urun%' OR c.slug LIKE 'ikinci-el%')
      AND c.slug NOT IN ('sifir-urun','ikinci-el')
      AND c."parentId" IS NOT NULL AND p.id IS NULL
    LIMIT 20
  `;
  checks.push({ name: "no_orphans", ok: orphans.length === 0, detail: JSON.stringify(orphans) });

  const aliasCount = await prisma.categoryAlias.count({ where: { active: true } });
  checks.push({ name: "aliases_created", ok: aliasCount > 0, detail: String(aliasCount) });

  const tree = await getCatalogTree("all");
  const { tree: browse, meta } = resolveAlisverisBrowseTree(tree);
  checks.push({ name: "api_source_db", ok: meta.source === "db", detail: meta.source });
  checks.push({ name: "browse_14_mains", ok: browse.length === 14, detail: String(browse.length) });

  function findPath(namesPath: string[]): boolean {
    const main = browse.find((b) => b.name === namesPath[0]);
    if (!main) return false;
    const sifir = main.children?.find((c) => c.name === "Sıfır");
    let node = sifir;
    for (const name of namesPath.slice(1)) {
      node = node?.children?.find((c) => c.name === name);
      if (!node) return false;
    }
    return true;
  }

  const beyaz = browse.find((b) => b.name === "Ev Aletleri");
  const sifir = beyaz?.children?.find((c) => c.name === "Sıfır");
  const beyazEsya = sifir?.children?.find((c) => c.name === "Beyaz Eşya");
  const directFridge = beyazEsya?.children?.some((c) => c.name === "Buzdolabı");
  const hasSogutma = beyazEsya?.children?.some((c) => c.name === "Soğutma");
  checks.push({
    name: "browse_no_direct_fridge_under_beyaz",
    ok: !directFridge && !!hasSogutma,
    detail: `directFridge=${directFridge} hasSogutma=${hasSogutma} kids=${beyazEsya?.children?.map((c) => c.name).join("|")}`,
  });
  checks.push({
    name: "browse_sogutma_buzdolabi",
    ok: findPath(["Ev Aletleri", "Beyaz Eşya", "Soğutma", "Buzdolabı"]),
  });

  const failed = checks.filter((c) => !c.ok);
  console.log(JSON.stringify({ ok: failed.length === 0, failed: failed.length, checks }, null, 2));
  if (failed.length) process.exit(1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
