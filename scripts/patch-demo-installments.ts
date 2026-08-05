import { prisma } from "../src/lib/db";
import { Prisma } from "@prisma/client";

async function main() {
  const id = "cmsf5833e0001uzpw2w5a0t50";
  const l = await prisma.listing.findUnique({ where: { id }, select: { attributes: true } });
  const base =
    l?.attributes && typeof l.attributes === "object" && !Array.isArray(l.attributes)
      ? { ...(l.attributes as Record<string, unknown>) }
      : {};
  base.installments = [
    { id: "1", card: "Tüm kartlar", months: 1, ratePercent: 0 },
    { id: "2", card: "World", months: 3, ratePercent: 0 },
    { id: "3", card: "Bonus", months: 6, ratePercent: 4.5 },
    { id: "4", card: "Axess", months: 9, ratePercent: 6.9 },
  ];
  await prisma.listing.update({
    where: { id },
    data: { attributes: base as Prisma.InputJsonValue },
  });
  console.log("installments ok");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
