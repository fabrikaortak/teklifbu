import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const brands = await p.brand.findMany({
  where: { deletedAt: null },
  orderBy: { name: "asc" },
  select: { name: true, slug: true, isActive: true },
});
console.log("brand_count", brands.length);
console.log(brands.map((b) => `${b.name} (${b.slug}) [${b.isActive ? "on" : "off"}]`).join("\n") || "(empty)");
console.log("categoryBrand_links", await p.categoryBrand.count());
await p.$disconnect();
