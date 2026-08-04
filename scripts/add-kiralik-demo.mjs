const { PrismaClient, DealType, ListingStatus, BidStatus } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.listing.findFirst({ where: { dealType: "KIRALIK" } });
  if (existing) {
    console.log("already", existing.title);
    return;
  }
  const seller = await prisma.user.findUnique({ where: { phone: "05321112233" } });
  const buyer = await prisma.user.findUnique({ where: { phone: "05324445566" } });
  const cat = await prisma.category.findUnique({ where: { slug: "kiralik" } });
  const now = new Date();
  const listing = await prisma.listing.create({
    data: {
      sellerId: seller.id,
      categoryId: cat.id,
      title: "Deniz Manzaralı 2+1 Kiralık",
      description: "Eşyalı, metroya yakın kiralık daire.",
      city: "İstanbul",
      district: "Maltepe",
      neighborhood: "Küçükyalı",
      dealType: DealType.KIRALIK,
      askPrice: BigInt(45000),
      status: ListingStatus.ACTIVE,
      isFeatured: true,
      startsAt: now,
      endsAt: new Date(now.getTime() + 2.5 * 864e5),
      coverImage: "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800",
      images: ["https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800"],
      attributes: { m2: 95, floor: 8, furnished: true },
      contactPhone: seller.phone,
    },
  });
  const amount = BigInt(40000);
  await prisma.bid.create({
    data: {
      listingId: listing.id,
      bidderId: buyer.id,
      amount,
      durationDays: 3,
      expiresAt: new Date(now.getTime() + 3 * 864e5),
      status: BidStatus.ACTIVE,
      tokensSpent: 1,
    },
  });
  await prisma.listing.update({
    where: { id: listing.id },
    data: { highestBid: amount, bidCount: 1 },
  });
  console.log("created", listing.id);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
