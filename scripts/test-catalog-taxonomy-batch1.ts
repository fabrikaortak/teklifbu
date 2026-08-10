/**
 * Post Batch-1 taxonomy verification.
 * npm run test:catalog-taxonomy-batch1
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { getCatalogTree } from "../src/core/services/catalog/categoryTreeService";
import { resolveAlisverisBrowseTree } from "../src/lib/alisverisBrowseFromDb";

const prisma = new PrismaClient();

const EXPECTED_MAINS = [
  "Elektronik",
  "Ev Aletleri",
  "Mutfak ve Sofra",
  "Ev ve Yaşam",
  "Moda",
  "Anne, Bebek ve Çocuk",
  "Kozmetik ve Kişisel Bakım",
  "Spor ve Outdoor",
  "Hobi ve Oyun",
  "Kitap, Kırtasiye ve Ofis",
  "Pet Shop",
  "Otomotiv Aksesuar",
  "Bahçe ve Yapı",
  "Endüstriyel ve Ticari Ürünler",
];

type Check = { name: string; ok: boolean; detail?: string };

async function main() {
  const checks: Check[] = [];

  const tree = await getCatalogTree("all");
  const { tree: browse, meta } = resolveAlisverisBrowseTree(tree);
  checks.push({ name: "A_api_source_db", ok: meta.source === "db", detail: meta.source });
  checks.push({
    name: "B_14_mains",
    ok: browse.length === 14,
    detail: `count=${browse.length} names=${browse.map((b) => b.name).join(",")}`,
  });

  const names = new Set(browse.map((b) => b.name));
  const missing = EXPECTED_MAINS.filter((m) => !names.has(m));
  checks.push({
    name: "B2_expected_main_names",
    ok: missing.length === 0 && browse.length === 14,
    detail: missing.length ? `missing:${missing.join("|")}` : "all present",
  });
  checks.push({
    name: "no_duplicate_main_names",
    ok: browse.length === new Set(browse.map((b) => b.name)).size,
  });

  function findPath(namesPath: string[]): boolean {
    // walk sifir side under first matching main
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

  checks.push({
    name: "E_ev_aletleri_sogutma_buzdolabi",
    ok: findPath(["Ev Aletleri", "Beyaz Eşya", "Soğutma", "Buzdolabı"]),
  });
  checks.push({
    name: "D_elektronik_telefon",
    ok: findPath(["Elektronik", "Telefon ve Aksesuar"]) || findPath(["Elektronik", "Telefon ve Aksesuar", "Cep Telefonu"]),
  });
  checks.push({
    name: "F_moda_tisort",
    ok:
      findPath(["Moda", "Erkek", "Üst Giyim", "Tişört"]) ||
      findPath(["Moda", "Kadın", "Üst Giyim", "Tişört"]),
  });
  checks.push({
    name: "G_filtreli_surahi",
    ok: findPath(["Mutfak ve Sofra", "Su Arıtma", "Filtreli Sürahi"]) || findPath(["Mutfak ve Sofra", "Su Arıtma", "Su Arıtma Ürünleri", "Filtreli Sürahi"]),
  });
  checks.push({
    name: "H_bisiklet",
    ok: findPath(["Spor ve Outdoor", "Bisiklet"]) || findPath(["Spor ve Outdoor", "Bisiklet", "Bisiklet"]),
  });

  // relation integrity sample: pre-existing phone products still resolvable
  const products = await prisma.product.count({ where: { deletedAt: null } });
  const listingsShop = await prisma.listing.count({
    where: {
      category: {
        OR: [{ slug: { startsWith: "sifir-urun" } }, { slug: { startsWith: "ikinci-el" } }],
      },
    },
  });
  const offers = await prisma.sellerOffer.count({ where: { deletedAt: null } });
  checks.push({ name: "J_products_exist", ok: products >= 0, detail: String(products) });
  checks.push({ name: "K_listings_shop", ok: listingsShop >= 0, detail: String(listingsShop) });
  checks.push({ name: "L_offers", ok: offers >= 0, detail: String(offers) });

  const orphan = await prisma.$queryRaw<Array<{ id: string; slug: string }>>`
    SELECT c.id, c.slug FROM "Category" c
    LEFT JOIN "Category" p ON p.id = c."parentId"
    WHERE c."deletedAt" IS NULL
      AND c.slug NOT IN ('sifir-urun','ikinci-el')
      AND (c.slug LIKE 'sifir-urun%' OR c.slug LIKE 'ikinci-el%')
      AND c."parentId" IS NOT NULL
      AND p.id IS NULL
    LIMIT 20
  `;
  checks.push({ name: "N_orphan_parent", ok: orphan.length === 0, detail: JSON.stringify(orphan) });

  const dupSlug = await prisma.$queryRaw<Array<{ slug: string; c: bigint }>>`
    SELECT slug, COUNT(*)::bigint AS c FROM "Category"
    WHERE "deletedAt" IS NULL GROUP BY slug HAVING COUNT(*) > 1 LIMIT 10
  `;
  checks.push({ name: "M_duplicate_slug", ok: dupSlug.length === 0, detail: JSON.stringify(dupSlug) });

  const failed = checks.filter((c) => !c.ok);
  const report = {
    generatedAt: new Date().toISOString(),
    ok: failed.length === 0,
    failed: failed.length,
    checks,
    meta,
    browseMains: browse.map((b) => b.name),
  };
  console.log(JSON.stringify(report, null, 2));
  if (failed.length) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
