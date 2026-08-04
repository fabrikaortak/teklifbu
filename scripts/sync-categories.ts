import { PrismaClient } from "@prisma/client";
import { syncCategories } from "../src/lib/syncCategories";

const prisma = new PrismaClient();

async function main() {
  await syncCategories(prisma);
  const roots = await prisma.category.findMany({
    where: { parentId: null, isActive: true },
    orderBy: { sortOrder: "asc" },
    include: { _count: { select: { children: true, listings: true } } },
  });
  console.log(
    "Roots:",
    roots.map((r) => `${r.slug} (${r._count.children} alt, ${r._count.listings} ilan)`)
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
