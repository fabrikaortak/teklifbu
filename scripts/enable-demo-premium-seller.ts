import { prisma } from "../src/lib/db";

async function main() {
  const l = await prisma.listing.findUnique({
    where: { id: "cmsf5833e0001uzpw2w5a0t50" },
    select: { sellerId: true },
  });
  if (!l) {
    console.log("listing not found");
    return;
  }
  const u = await prisma.user.update({
    where: { id: l.sellerId },
    data: { isPremiumSeller: true, premiumSellerUntil: null },
  });
  console.log(JSON.stringify({ sellerId: u.id, name: u.name, isPremiumSeller: u.isPremiumSeller }));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
