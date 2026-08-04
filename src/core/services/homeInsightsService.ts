import { ListingStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getMarketplaceHomeStats } from "@/core/services/marketplaceStatsService";

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function mapListing(l: {
  id: string;
  title: string;
  city: string;
  district: string | null;
  coverImage: string | null;
  askPrice: bigint | number;
  highestBid: bigint | number;
  bidCount: number;
  endsAt: Date | null;
  attributes?: unknown;
  category?: { name: string; slug: string } | null;
}) {
  return {
    id: l.id,
    title: l.title,
    city: l.city,
    district: l.district,
    coverImage: l.coverImage,
    askPrice: Number(l.askPrice),
    highestBid: Number(l.highestBid),
    bidCount: l.bidCount,
    endsAt: l.endsAt,
    attributes: l.attributes,
    category: l.category || null,
  };
}

export async function getHomeInsightsData() {
  const now = new Date();
  const today = startOfDay();
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const [stats, endingSoon, mostBidsGrouped, profitSales, cityBids, topBid, onlineApprox, forYou] =
    await Promise.all([
      getMarketplaceHomeStats(),
      prisma.listing.findMany({
        where: {
          status: ListingStatus.ACTIVE,
          endsAt: { gte: now, lte: in24h },
        },
        orderBy: { endsAt: "asc" },
        take: 6,
        include: { category: { select: { name: true, slug: true } } },
      }),
      prisma.bid.groupBy({
        by: ["listingId"],
        where: {
          createdAt: { gte: today },
          listing: { status: ListingStatus.ACTIVE },
        },
        _count: { _all: true },
        orderBy: { _count: { listingId: "desc" } },
        take: 5,
      }),
      prisma.listing.findMany({
        where: {
          status: ListingStatus.APPROVED,
          approvedBidId: { not: null },
          highestBid: { gt: 0 },
        },
        orderBy: { updatedAt: "desc" },
        take: 40,
        include: {
          category: { select: { name: true, slug: true } },
          approvedBid: { select: { amount: true } },
        },
      }),
      prisma.bid.groupBy({
        by: ["listingId"],
        where: { createdAt: { gte: last24h } },
        _count: { _all: true },
        orderBy: { _count: { listingId: "desc" } },
        take: 80,
      }),
      prisma.bid.findFirst({
        where: { createdAt: { gte: today } },
        orderBy: { amount: "desc" },
        include: {
          listing: { select: { id: true, title: true, city: true } },
        },
      }),
      prisma.bid.count({
        where: { createdAt: { gte: new Date(now.getTime() - 15 * 60 * 1000) } },
      }),
      prisma.listing.findMany({
        where: { status: ListingStatus.ACTIVE },
        orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }],
        take: 10,
        include: { category: { select: { name: true, slug: true } } },
      }),
    ]);

  const mostBidIds = mostBidsGrouped.map((g) => g.listingId);
  const mostBidListings = mostBidIds.length
    ? await prisma.listing.findMany({
        where: { id: { in: mostBidIds } },
        include: { category: { select: { name: true, slug: true } } },
      })
    : [];
  const mostBidById = Object.fromEntries(mostBidListings.map((l) => [l.id, l]));
  const mostBidsRanked = mostBidsGrouped
    .map((g) => {
      const l = mostBidById[g.listingId];
      if (!l) return null;
      return { ...mapListing(l), bidCount: g._count._all };
    })
    .filter(Boolean) as ReturnType<typeof mapListing>[];

  const profitRanked = profitSales
    .map((l) => {
      const final = l.approvedBid ? Number(l.approvedBid.amount) : Number(l.highestBid);
      const ask = Number(l.askPrice);
      const profit = final - ask;
      return { ...mapListing(l), finalPrice: final, profit };
    })
    .filter((x) => x.profit > 0)
    .sort((a, b) => b.profit - a.profit)
    .slice(0, 5);

  const listingIds = cityBids.map((c) => c.listingId);
  const cityListings = listingIds.length
    ? await prisma.listing.findMany({
        where: { id: { in: listingIds } },
        select: { id: true, city: true },
      })
    : [];
  const cityById = Object.fromEntries(cityListings.map((l) => [l.id, l.city]));
  const cityHeat: Record<string, number> = {};
  for (const row of cityBids) {
    const city = cityById[row.listingId] || "Diğer";
    cityHeat[city] = (cityHeat[city] || 0) + row._count._all;
  }
  const mapCities = Object.entries(cityHeat)
    .map(([city, count]) => ({ city, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);

  const badges = ["Senin İçin Yeni", "Fiyatı Düşen", "Popüler", "Yakında Bitiyor", "Öne Çıkan"];

  return {
    endingSoon: endingSoon.map(mapListing),
    mostBidsToday: mostBidsRanked,
    topProfit: profitRanked,
    turkeyMap: mapCities,
    liveStats: {
      ...stats,
      onlineUsers: Math.max(onlineApprox * 3, Math.min(50, stats.bidsToday || 0)),
      topBidToday: topBid
        ? {
            amount: Number(topBid.amount),
            listingId: topBid.listing.id,
            title: topBid.listing.title,
            city: topBid.listing.city,
          }
        : null,
    },
    forYou: forYou.map((l, i) => ({
      ...mapListing(l),
      badge: badges[i % badges.length],
    })),
  };
}
