import { BidStatus, ListingStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export type MarketplaceHomeStats = {
  activeListings: number;
  totalBids: number;
  buyers: number;
  sellers: number;
  bidsToday: number;
  bidsTodayChangePct: number;
  acceptedToday: number;
  acceptedTodayChangePct: number;
  totalBidVolumeTl: number;
  totalBidVolumeChangePct: number;
  soldLast24h: number;
  soldLast24hChangePct: number;
};

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function pctChange(current: number, previous: number) {
  if (previous <= 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

async function sumBidAmount(where: Prisma.BidWhereInput) {
  const agg = await prisma.bid.aggregate({ where, _sum: { amount: true } });
  return Number(agg._sum.amount || 0);
}

/** Ana sayfa üst istatistik kartları + eski alanlar */
export async function getMarketplaceHomeStats(): Promise<MarketplaceHomeStats> {
  const today = startOfDay();
  const yesterday = startOfDay(new Date(today.getTime() - 86400000));
  const last24h = new Date(Date.now() - 86400000);
  const prev24h = new Date(Date.now() - 2 * 86400000);
  const last7d = new Date(Date.now() - 7 * 86400000);
  const prev7d = new Date(Date.now() - 14 * 86400000);

  const [
    activeListings,
    totalBids,
    buyers,
    sellers,
    bidsToday,
    bidsYesterday,
    acceptedToday,
    acceptedYesterday,
    totalBidVolumeTl,
    volumeLast7d,
    volumePrev7d,
    soldLast24h,
    soldPrev24h,
  ] = await Promise.all([
    prisma.listing.count({ where: { status: ListingStatus.ACTIVE } }),
    prisma.bid.count(),
    prisma.user.count({ where: { bids: { some: {} } } }),
    prisma.user.count({ where: { listings: { some: {} } } }),
    prisma.bid.count({ where: { createdAt: { gte: today } } }),
    prisma.bid.count({ where: { createdAt: { gte: yesterday, lt: today } } }),
    prisma.bid.count({
      where: { status: BidStatus.APPROVED, updatedAt: { gte: today } },
    }),
    prisma.bid.count({
      where: { status: BidStatus.APPROVED, updatedAt: { gte: yesterday, lt: today } },
    }),
    sumBidAmount({}),
    sumBidAmount({ createdAt: { gte: last7d } }),
    sumBidAmount({ createdAt: { gte: prev7d, lt: last7d } }),
    prisma.listing.count({
      where: {
        status: ListingStatus.APPROVED,
        OR: [{ reviewedAt: { gte: last24h } }, { updatedAt: { gte: last24h }, approvedBidId: { not: null } }],
      },
    }),
    prisma.listing.count({
      where: {
        status: ListingStatus.APPROVED,
        OR: [
          { reviewedAt: { gte: prev24h, lt: last24h } },
          { updatedAt: { gte: prev24h, lt: last24h }, approvedBidId: { not: null } },
        ],
      },
    }),
  ]);

  return {
    activeListings,
    totalBids,
    buyers,
    sellers,
    bidsToday,
    bidsTodayChangePct: pctChange(bidsToday, bidsYesterday),
    acceptedToday,
    acceptedTodayChangePct: pctChange(acceptedToday, acceptedYesterday),
    totalBidVolumeTl,
    totalBidVolumeChangePct: pctChange(volumeLast7d, volumePrev7d),
    soldLast24h,
    soldLast24hChangePct: pctChange(soldLast24h, soldPrev24h),
  };
}
