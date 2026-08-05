import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();

async function main() {
  const brand = await p.brand.create({
    data: { name: "Samsung", slug: `samsung-smoke-${Date.now()}`, sortOrder: 0 },
  });
  const shoppingCats = await p.category.count({
    where: {
      OR: [{ slug: { startsWith: "ikinci-el-" } }, { slug: { startsWith: "sifir-urun-" } }],
    },
  });
  const cols = await p.$queryRawUnsafe(
    `select column_name from information_schema.columns where table_name='Listing' and column_name in ('productId','variantId','sellerOfferId') order by 1`
  );
  await p.brand.delete({ where: { id: brand.id } });
  console.log(
    JSON.stringify({
      brandCreateDelete: true,
      shoppingCats,
      listingCatalogCols: Array.isArray(cols) ? cols.map((c) => c.column_name) : cols,
      listingCount: await p.listing.count(),
    })
  );
  await p.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await p.$disconnect();
  process.exit(1);
});
