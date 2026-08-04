import { BidStatus, EditRequestStatus, ListingStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSetting } from "@/core/settings";
import { isCorporateAccount } from "@/lib/accountTypes";
import {
  COMPANY_TYPE_OPTIONS,
  parseCommercialProfile,
} from "@/data/commercialProfile";
import { isPremiumSellerActive, memberYearsLabel } from "@/lib/sellerBadges";
import { serializeListing } from "@/lib/format";
import { attachEidsBadge } from "@/core/services/eidsService";
import { shouldShowPremiumBadge } from "@/lib/listingPremiumDisplay";
import { getSellerReviewSettings } from "@/core/services/sellerReviewService";
import type {
  SellerAchievement,
  SellerPublicProfile,
  SellerStoreReview,
} from "@/lib/sellerStoreTypes";

export type { SellerAchievement, SellerPublicProfile, SellerStoreReview } from "@/lib/sellerStoreTypes";

const LIVE_LISTING_STATUSES: ListingStatus[] = [
  ListingStatus.ACTIVE,
  ListingStatus.SELECTION,
];

const COMPLETED_LISTING_STATUSES: ListingStatus[] = [ListingStatus.APPROVED];

const STORE_GALLERY_STATUSES: ListingStatus[] = [
  ...LIVE_LISTING_STATUSES,
  ...COMPLETED_LISTING_STATUSES,
];

function companyTypeLabel(value: string) {
  const hit = COMPANY_TYPE_OPTIONS.find((o) => o.value === value);
  return hit?.label || value || "—";
}

function memberYearsNum(memberSince: Date | string | null | undefined) {
  if (!memberSince) return 0;
  const start = new Date(memberSince).getTime();
  if (!Number.isFinite(start)) return 0;
  return Math.max(0, Math.floor((Date.now() - start) / (365.25 * 24 * 60 * 60 * 1000)));
}

function buildAchievements(input: {
  isCommercial: boolean;
  commercialApproved: boolean;
  bidAcceptanceRate: number | null;
  successfulSales: number;
  memberYears: number;
  reviewCount: number;
  avgRating: number | null;
  positiveReviewPercent: number | null;
}): SellerAchievement[] {
  const out: SellerAchievement[] = [];
  if (input.commercialApproved) {
    out.push({
      id: "verified",
      title: "Doğrulanmış Kurumsal",
      subtitle: "Vergi ve üyelik onayı tamam",
      tone: "green",
    });
  }
  if (input.bidAcceptanceRate != null && input.bidAcceptanceRate >= 80) {
    out.push({
      id: "accept",
      title: "Yüksek Kabul Oranı",
      subtitle: `Teklif kabul %${input.bidAcceptanceRate}`,
      tone: "orange",
    });
  }
  if (input.successfulSales >= 10) {
    out.push({
      id: "sales",
      title: "Başarılı Satıcı",
      subtitle: `${input.successfulSales} tamamlanan satış`,
      tone: "gold",
    });
  }
  if (input.memberYears >= 1) {
    out.push({
      id: "tenure",
      title: "Köklü Üyelik",
      subtitle: `${input.memberYears} yıldır TeklifBu’da`,
      tone: "purple",
    });
  }
  if (input.reviewCount >= 5 && (input.avgRating || 0) >= 4.5) {
    out.push({
      id: "reviews",
      title: "Yüksek Memnuniyet",
      subtitle: `${input.avgRating?.toFixed(1)} / 5 · ${input.reviewCount} değerlendirme`,
      tone: "gold",
    });
  }
  if (input.positiveReviewPercent != null && input.positiveReviewPercent >= 90) {
    out.push({
      id: "positive",
      title: "Olumlu Değerlendirme",
      subtitle: `%${input.positiveReviewPercent} olumlu`,
      tone: "green",
    });
  }
  return out.slice(0, 6);
}

export async function getSellerPublicProfile(
  sellerId: string,
  opts?: { viewerId?: string | null }
): Promise<
  | {
      ok: true;
      seller: SellerPublicProfile;
      isSellerFavorited: boolean;
      isOwnProfile: boolean;
      reviewsEnabled: boolean;
      reviews: SellerStoreReview[];
      gallery: string[];
      achievements: SellerAchievement[];
    }
  | { ok: false; status: number; error: string }
> {
  const user = await prisma.user.findUnique({
    where: { id: sellerId },
    include: {
      ownedShops: { take: 1, select: { id: true, name: true, city: true, phone: true } },
    },
  });
  if (!user || !user.isActive) {
    return { ok: false, status: 404, error: "Satıcı bulunamadı" };
  }

  const isCommercial = isCorporateAccount(user.accountType);
  const commercial = parseCommercialProfile(user.profile);
  const showIdentity = true;
  const showPhone = Boolean(user.phoneVerified);
  const reviewSettings = await getSellerReviewSettings();

  const [
    showPremiumBadge,
    showYearsBadge,
    reviewAgg,
    positiveReviews,
    sellerListingStats,
    bidDecisionStats,
    lastListingActivity,
    activeCount,
    galleryRows,
    reviewRows,
  ] = await Promise.all([
    getSetting<boolean>("commercial_premium_badge_enabled", true),
    getSetting<boolean>("commercial_member_years_badge_enabled", true),
    prisma.sellerReview.aggregate({
      where: { sellerId, status: EditRequestStatus.APPROVED },
      _count: { _all: true },
      _avg: { rating: true },
    }),
    prisma.sellerReview.count({
      where: {
        sellerId,
        status: EditRequestStatus.APPROVED,
        rating: { gte: 4 },
      },
    }),
    prisma.listing.groupBy({
      by: ["status"],
      where: {
        sellerId,
        status: {
          in: [
            ListingStatus.ACTIVE,
            ListingStatus.SELECTION,
            ListingStatus.APPROVED,
            ListingStatus.EXPIRED,
            ListingStatus.PENDING_REVIEW,
          ],
        },
      },
      _count: { _all: true },
    }),
    prisma.bid.groupBy({
      by: ["status"],
      where: {
        listing: { sellerId },
        status: { in: [BidStatus.APPROVED, BidStatus.REJECTED] },
      },
      _count: { _all: true },
    }),
    prisma.listing.findFirst({
      where: { sellerId },
      orderBy: { updatedAt: "desc" },
      select: { updatedAt: true },
    }),
    prisma.listing.count({
      where: { sellerId, status: { in: LIVE_LISTING_STATUSES } },
    }),
    prisma.listing.findMany({
      where: { sellerId, status: { in: STORE_GALLERY_STATUSES } },
      orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }],
      take: 24,
      select: { coverImage: true, images: true },
    }),
    reviewSettings.enabled
      ? prisma.sellerReview.findMany({
          where: { sellerId, status: EditRequestStatus.APPROVED },
          orderBy: { createdAt: "desc" },
          take: 12,
          include: {
            author: { select: { name: true } },
            listing: { select: { id: true, title: true } },
          },
        })
      : Promise.resolve([]),
  ]);

  let totalListings = 0;
  let successfulSales = 0;
  for (const row of sellerListingStats) {
    totalListings += row._count._all;
    if (row.status === ListingStatus.APPROVED) successfulSales += row._count._all;
  }
  let approvedBids = 0;
  let rejectedBids = 0;
  for (const row of bidDecisionStats) {
    if (row.status === BidStatus.APPROVED) approvedBids = row._count._all;
    if (row.status === BidStatus.REJECTED) rejectedBids = row._count._all;
  }
  const decided = approvedBids + rejectedBids;
  const bidAcceptanceRate = decided > 0 ? Math.round((approvedBids / decided) * 100) : null;

  const reviewCount = reviewAgg._count._all || 0;
  const avgRating = reviewAgg._avg.rating;
  const positiveReviewPercent =
    reviewCount > 0 ? Math.round((positiveReviews / reviewCount) * 100) : null;

  const lastActiveAt = (() => {
    const a = user.updatedAt ? new Date(user.updatedAt).getTime() : 0;
    const b = lastListingActivity?.updatedAt ? new Date(lastListingActivity.updatedAt).getTime() : 0;
    const t = Math.max(a, b);
    return t > 0 ? new Date(t).toISOString() : null;
  })();

  const taxFilled = Boolean(String(commercial.taxNumber || "").replace(/\D/g, "").length >= 10);
  const addressFilled = Boolean(String(commercial.businessAddress || "").trim());
  const verifications = {
    identity: Boolean(user.eidsIdentityVerifiedAt || user.eidsKullaniciKodu),
    tax: isCommercial ? user.commercialStatus === "APPROVED" && taxFilled : false,
    phone: Boolean(user.phoneVerified),
    email: Boolean(user.email),
    address: addressFilled,
  };

  let isSellerFavorited = false;
  if (opts?.viewerId) {
    const fav = await prisma.favoriteSeller.findUnique({
      where: { userId_sellerId: { userId: opts.viewerId, sellerId } },
      select: { id: true },
    });
    isSellerFavorited = Boolean(fav);
  }

  const years = memberYearsNum(user.memberSince);
  const sinceYear = user.memberSince ? new Date(user.memberSince).getFullYear() : null;
  const title =
    (isCommercial && commercial.commercialTitle) || user.name || "Satıcı";
  const aboutParts = [
    isCommercial && commercial.companyType
      ? companyTypeLabel(commercial.companyType)
      : isCommercial
        ? "Kurumsal üye"
        : "Bireysel üye",
    commercial.businessCity
      ? `${commercial.businessCity}${commercial.businessDistrict ? ` / ${commercial.businessDistrict}` : ""} bölgesinde hizmet`
      : null,
    years >= 1 ? `${years} yıldır TeklifBu’da` : "Yeni üye",
  ].filter(Boolean);

  const gallery: string[] = [];
  if (user.storeCoverUrl) gallery.push(user.storeCoverUrl);
  for (const row of galleryRows) {
    if (row.coverImage && !gallery.includes(row.coverImage)) gallery.push(row.coverImage);
    const imgs = Array.isArray(row.images) ? (row.images as string[]) : [];
    for (const img of imgs) {
      if (img && !gallery.includes(img)) gallery.push(img);
      if (gallery.length >= 24) break;
    }
    if (gallery.length >= 24) break;
  }

  const reviews: SellerStoreReview[] = reviewRows.map((r) => ({
    id: r.id,
    body: r.body,
    rating: r.rating,
    createdAt: r.createdAt.toISOString(),
    authorName: r.author.name || "Üye",
    listingId: r.listing?.id || null,
    listingTitle: r.listing?.title || null,
  }));

  const achievements = buildAchievements({
    isCommercial,
    commercialApproved: Boolean(verifications.tax),
    bidAcceptanceRate,
    successfulSales,
    memberYears: years,
    reviewCount,
    avgRating,
    positiveReviewPercent,
  });

  const seller: SellerPublicProfile = {
    id: user.id,
    name: showIdentity ? user.name : null,
    phone: showPhone ? user.phone || user.ownedShops[0]?.phone || null : null,
    email: user.email || null,
    memberSince: user.memberSince.toISOString(),
    memberYearsLabel: memberYearsLabel(user.memberSince),
    memberYears: years,
    memberSinceYear: sinceYear,
    accountType: String(user.accountType),
    isCommercial,
    commercialTitle: showIdentity && isCommercial ? commercial.commercialTitle || null : null,
    yetkiBelgeNo: showIdentity && isCommercial ? commercial.yetkiBelgeNo || null : null,
    logoUrl: showIdentity ? user.logoUrl || null : null,
    storeCoverUrl: showIdentity ? user.storeCoverUrl || null : null,
    isPremiumSeller: isPremiumSellerActive(user),
    showPremiumBadge: showPremiumBadge !== false,
    showYearsBadge: showYearsBadge !== false,
    reviewCount,
    avgRating,
    positiveReviewPercent,
    about: `${title}; ${aboutParts.join(". ")}.`,
    shopId: user.ownedShops[0]?.id || null,
    shopName: user.ownedShops[0]?.name || null,
    identityVisible: showIdentity,
    contactVisible: showPhone,
    verifications,
    commercial: isCommercial
      ? {
          companyType: commercial.companyType,
          companyTypeLabel: companyTypeLabel(commercial.companyType),
          businessCity: commercial.businessCity || user.ownedShops[0]?.city || "",
          businessDistrict: commercial.businessDistrict || "",
          businessAddress: commercial.businessAddress || "",
          authorizedTitle: commercial.authorizedTitle || "",
          taxOffice: commercial.taxOffice || "",
          yetkiBelgeNo: commercial.yetkiBelgeNo || "",
        }
      : null,
    stats: {
      totalListings,
      activeListings: activeCount,
      successfulSales,
      bidAcceptanceRate,
      avgResponseMinutes: null,
    },
    lastActiveAt,
  };

  return {
    ok: true,
    seller,
    isSellerFavorited,
    isOwnProfile: opts?.viewerId === sellerId,
    reviewsEnabled: reviewSettings.enabled,
    reviews,
    gallery,
    achievements,
  };
}

async function serializeSellerListings(
  sellerId: string,
  statuses: ListingStatus[],
  take = 48
) {
  const rows = await prisma.listing.findMany({
    where: {
      sellerId,
      status: { in: statuses },
    },
    orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }],
    take,
    include: {
      category: { select: { id: true, name: true, slug: true } },
    },
  });

  const badgeRule = await getSetting<string>("premium_badge_rule", "premium_3");
  const list = [];
  for (const row of rows) {
    const base = serializeListing(row);
    list.push(
      await attachEidsBadge({
        ...base,
        category: row.category,
        showPremiumBadge: shouldShowPremiumBadge(row, badgeRule),
      })
    );
  }
  return list;
}

export async function listSellerPublicListings(sellerId: string, take = 48) {
  return serializeSellerListings(sellerId, LIVE_LISTING_STATUSES, take);
}

export async function listSellerCompletedListings(sellerId: string, take = 48) {
  return serializeSellerListings(sellerId, COMPLETED_LISTING_STATUSES, take);
}
