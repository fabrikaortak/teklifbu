import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession, requireAdmin } from "@/lib/auth";
import { getSettingsMap, getSetting, setSetting, invalidateSettingsCache } from "@/core/settings";
import { DEFAULT_SETTINGS } from "@/core/defaultSettings";
import {
  AccountType,
  BidStatus,
  ContentKind,
  EditRequestStatus,
  ExtensionRequestStatus,
  ListingStatus,
  PaymentStatus,
  SellerAdminRequestStatus,
} from "@prisma/client";
import {
  ensureDefaultTenant,
  ensureUserShop,
  writeAuditLog,
} from "@/core/services/tenantService";
import { approveListing, rejectListing } from "@/core/services/listingModerationService";
import {
  approveListingExtension,
  rejectListingExtension,
} from "@/core/services/listingExtensionService";
import {
  approveListingEditRequest,
  rejectListingEditRequest,
} from "@/core/services/listingEditRequestService";
import {
  approveBulkListingUpdate,
  rejectBulkListingUpdate,
} from "@/core/services/bulkListingUpdateService";
import { resolveSellerAdminRequest, grantSellerEditFields, approveGrantedListingEdit, rejectGrantedListingEdit } from "@/core/services/sellerAdminRequestService";
import {
  countDemoListings,
  publishDemoListings,
  reloadDemoListings,
  removeAllDemoData,
  seedDemoListings,
  startDemoMarketplaceFlow,
} from "@/core/services/demoListingsService";
import { DEMO_LISTING_SEEDS } from "@/data/demoListings";
import {
  adminMarkDisputed,
  adminRefund,
  adminRelease,
  getEscrowPoolSummary,
  listEscrowDeals,
  processEscrowTimeouts,
} from "@/core/services/escrowService";
import { getEscrowRuntimeSettings } from "@/core/services/escrowSettingsService";
import { categoryWhereForVertical, parseAdminVertical } from "@/lib/adminVertical";
import { getFacetCounts, invalidateFacetCache } from "@/lib/facetCounts";
import { normalizeBrowseNavConfig } from "@/lib/browseNavConfig";
import {
  COMMERCIAL_BUSINESS_TYPES_SETTING_KEY,
  activeCommercialBusinessTypes,
} from "@/lib/commercialBusinessTypes";

function dayKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

function pctChange(current: number, previous: number) {
  if (previous === 0) return current === 0 ? 0 : 100;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

async function enrichPackagesWithVat<T extends { id: string }>(
  rows: T[],
  table: "TokenPackage" | "ShopPackage"
) {
  if (!rows.length) return rows.map((r) => ({ ...r, pricesIncludeVat: true, vatPercent: 20 }));
  const vatRows = await prisma.$queryRawUnsafe<
    Array<{ id: string; pricesIncludeVat: boolean; vatPercent: number }>
  >(`SELECT id, "pricesIncludeVat", "vatPercent" FROM "${table}"`);
  const map = new Map(vatRows.map((r) => [r.id, r]));
  return rows.map((r) => {
    const v = map.get(r.id);
    return {
      ...r,
      pricesIncludeVat: v?.pricesIncludeVat !== false,
      vatPercent: Number(v?.vatPercent ?? 20),
    };
  });
}

function addMonths(date: Date, months: number) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function formatAvgDuration(days: number | null | undefined) {
  if (!days || days <= 0) return "—";
  const whole = Math.floor(days);
  const hours = Math.round((days - whole) * 24);
  if (hours <= 0) return `${whole}g`;
  return `${whole}g ${hours}sa`;
}

const CORPORATE_TYPES: AccountType[] = [
  AccountType.TICARI,
  AccountType.EMLAKCI,
  AccountType.GALERICI,
];
const INDIVIDUAL_TYPES: AccountType[] = [AccountType.BIREYSEL, AccountType.BIREYSEL_TICARI];

/** Kurumsal + belirli faaliyet (legacy EMLAKCI/GALERICI dahil) */
function corporateSubtypeWhere(subtypeKey: string): Record<string, unknown> {
  const key = subtypeKey.toUpperCase();
  const or: Record<string, unknown>[] = [
    {
      accountType: AccountType.TICARI,
      commercialSubtypes: { has: key },
    },
  ];
  if (key === "EMLAK_OFISI") {
    or.push({ accountType: AccountType.EMLAKCI });
  }
  if (key === "GALERI") {
    or.push({ accountType: AccountType.GALERICI });
  }
  or.push({
    accountType: { in: [AccountType.EMLAKCI, AccountType.GALERICI] },
    commercialSubtypes: { has: key },
  });
  return { OR: or };
}

export async function GET(req: Request) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
  }

  const tenant = await ensureDefaultTenant();

  const { searchParams } = new URL(req.url);
  const view = searchParams.get("view");

  /** Menü rozetleri — hafif; shell her sayfada bunu kullanır (dashboard değil) */
  if (view === "nav") {
    const [
      adminUser,
      unreadMessages,
      pendingReviewCount,
      pendingExtensionCount,
      pendingEditCount,
      pendingBulkEditCount,
      pendingSellerRequestCount,
      pendingCommercialUserCount,
      pendingEmlak,
      pendingAlisveris,
      pendingPremium,
      editEmlak,
      editAlisveris,
      editPremium,
      extEmlak,
      extAlisveris,
      extPremium,
    ] = await Promise.all([
      prisma.user.findUnique({
        where: { id: session.id },
        select: { id: true, name: true, phone: true },
      }),
      prisma.message.count({ where: { isRead: false } }),
      prisma.listing.count({ where: { status: ListingStatus.PENDING_REVIEW } }),
      prisma.listingExtensionRequest.count({
        where: { status: ExtensionRequestStatus.PENDING },
      }),
      prisma.listingEditRequest.count({
        where: { status: EditRequestStatus.PENDING },
      }),
      prisma.bulkListingUpdateRequest.count({
        where: { status: EditRequestStatus.PENDING },
      }),
      prisma.sellerAdminRequest.count({
        where: {
          status: {
            in: [SellerAdminRequestStatus.PENDING, SellerAdminRequestStatus.PENDING_APPROVAL],
          },
        },
      }),
      prisma.user.count({
        where: {
          commercialStatus: "PENDING",
          accountType: { in: [AccountType.TICARI, AccountType.EMLAKCI, AccountType.GALERICI] },
        },
      }),
      // Dikey bazlı onay sayıları (menü rozeti — yanlış dikeye taşmasın)
      prisma.listing.count({
        where: {
          status: ListingStatus.PENDING_REVIEW,
          category: categoryWhereForVertical("emlak-vasita"),
        },
      }),
      prisma.listing.count({
        where: {
          status: ListingStatus.PENDING_REVIEW,
          category: categoryWhereForVertical("alisveris"),
        },
      }),
      prisma.listing.count({
        where: {
          status: ListingStatus.PENDING_REVIEW,
          category: categoryWhereForVertical("premium"),
        },
      }),
      prisma.listingEditRequest.count({
        where: {
          status: EditRequestStatus.PENDING,
          listing: { category: categoryWhereForVertical("emlak-vasita") },
        },
      }),
      prisma.listingEditRequest.count({
        where: {
          status: EditRequestStatus.PENDING,
          listing: { category: categoryWhereForVertical("alisveris") },
        },
      }),
      prisma.listingEditRequest.count({
        where: {
          status: EditRequestStatus.PENDING,
          listing: { category: categoryWhereForVertical("premium") },
        },
      }),
      prisma.listingExtensionRequest.count({
        where: {
          status: ExtensionRequestStatus.PENDING,
          listing: { category: categoryWhereForVertical("emlak-vasita") },
        },
      }),
      prisma.listingExtensionRequest.count({
        where: {
          status: ExtensionRequestStatus.PENDING,
          listing: { category: categoryWhereForVertical("alisveris") },
        },
      }),
      prisma.listingExtensionRequest.count({
        where: {
          status: ExtensionRequestStatus.PENDING,
          listing: { category: categoryWhereForVertical("premium") },
        },
      }),
    ]);
    return NextResponse.json({
      adminUser,
      kpis: {
        unreadMessages,
        pendingReviewCount,
        pendingExtensionCount,
        pendingEditCount: pendingEditCount + pendingBulkEditCount,
        pendingSellerRequestCount,
        pendingCommercialUserCount,
        pendingBulkEditCount,
        byVertical: {
          "emlak-vasita": {
            pending: pendingEmlak,
            edit: editEmlak,
            extension: extEmlak,
          },
          alisveris: {
            pending: pendingAlisveris,
            edit: editAlisveris + pendingBulkEditCount,
            extension: extAlisveris,
          },
          premium: {
            pending: pendingPremium,
            edit: editPremium,
            extension: extPremium,
          },
        },
      },
    });
  }

  if (view === "commercial-users") {
    const status = String(searchParams.get("status") || "PENDING").toUpperCase();
    const where: Record<string, unknown> = { accountType: "TICARI" };
    if (status === "PENDING" || status === "APPROVED" || status === "REJECTED") {
      where.commercialStatus = status;
    }
    const users = await prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        phone: true,
        name: true,
        email: true,
        accountType: true,
        commercialSubtypes: true,
        commercialStatus: true,
        commercialReviewNote: true,
        commercialReviewedAt: true,
        createdAt: true,
        memberSince: true,
        profile: true,
        isActive: true,
        logoUrl: true,
        isPremiumSeller: true,
        premiumSellerUntil: true,
      },
    });
    return NextResponse.json({ users });
  }

  if (view === "user-detail") {
    const userId = String(searchParams.get("userId") || "").trim();
    if (!userId) {
      return NextResponse.json({ error: "userId gerekli" }, { status: 400 });
    }
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        phone: true,
        phoneVerified: true,
        name: true,
        email: true,
        accountType: true,
        commercialSubtypes: true,
        commercialStatus: true,
        commercialReviewedAt: true,
        role: true,
        tokenBalance: true,
        avatarUrl: true,
        logoUrl: true,
        storeCoverUrl: true,
        isPremiumSeller: true,
        premiumSellerUntil: true,
        isActive: true,
        memberSince: true,
        createdAt: true,
        updatedAt: true,
        profile: true,
        iban: true,
      },
    });
    if (!user) {
      return NextResponse.json({ error: "Kullanıcı bulunamadı" }, { status: 404 });
    }

    const [
      shop,
      paymentsAgg,
      paymentsCount,
      recentPayments,
      bidsCount,
      recentBids,
      listingsCount,
      recentListings,
      messagesSent,
      messagesReceived,
      lastSentMsg,
      lastRecvMsg,
      lastBid,
      lastPayment,
      lastListing,
      subscription,
    ] = await Promise.all([
      prisma.shop.findFirst({
        where: { ownerId: userId },
        select: {
          id: true,
          name: true,
          city: true,
          phone: true,
          isActive: true,
          createdAt: true,
        },
      }),
      prisma.payment.aggregate({
        where: { userId, status: { in: [PaymentStatus.PAID, PaymentStatus.SIMULATED] } },
        _sum: { amountTl: true },
      }),
      prisma.payment.count({ where: { userId } }),
      prisma.payment.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 8,
        select: {
          id: true,
          amountTl: true,
          purpose: true,
          status: true,
          createdAt: true,
        },
      }),
      prisma.bid.count({ where: { bidderId: userId } }),
      prisma.bid.findMany({
        where: { bidderId: userId },
        orderBy: { createdAt: "desc" },
        take: 8,
        select: {
          id: true,
          amount: true,
          status: true,
          createdAt: true,
          listing: { select: { id: true, title: true, listingNo: true } },
        },
      }),
      prisma.listing.count({ where: { sellerId: userId } }),
      prisma.listing.findMany({
        where: { sellerId: userId },
        orderBy: { createdAt: "desc" },
        take: 40,
        select: {
          id: true,
          title: true,
          listingNo: true,
          status: true,
          askPrice: true,
          createdAt: true,
          endsAt: true,
          coverImage: true,
          city: true,
          category: { select: { name: true } },
        },
      }),
      prisma.message.count({ where: { senderId: userId } }),
      prisma.message.count({ where: { receiverId: userId } }),
      prisma.message.findFirst({
        where: { senderId: userId },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      }),
      prisma.message.findFirst({
        where: { receiverId: userId },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      }),
      prisma.bid.findFirst({
        where: { bidderId: userId },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      }),
      prisma.payment.findFirst({
        where: { userId },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      }),
      prisma.listing.findFirst({
        where: { sellerId: userId },
        orderBy: { updatedAt: "desc" },
        select: { updatedAt: true, createdAt: true },
      }),
      prisma.shopSubscription.findFirst({
        where: { userId },
        select: {
          isActive: true,
          endsAt: true,
          startsAt: true,
          package: { select: { name: true } },
        },
      }),
    ]);

    const activityCandidates: Array<{ at: Date; source: string }> = [
      { at: user.updatedAt, source: "profil" },
    ];
    if (lastSentMsg?.createdAt) activityCandidates.push({ at: lastSentMsg.createdAt, source: "mesaj" });
    if (lastRecvMsg?.createdAt) activityCandidates.push({ at: lastRecvMsg.createdAt, source: "mesaj" });
    if (lastBid?.createdAt) activityCandidates.push({ at: lastBid.createdAt, source: "teklif" });
    if (lastPayment?.createdAt) activityCandidates.push({ at: lastPayment.createdAt, source: "ödeme" });
    if (lastListing?.updatedAt) activityCandidates.push({ at: lastListing.updatedAt, source: "ilan" });
    else if (lastListing?.createdAt) activityCandidates.push({ at: lastListing.createdAt, source: "ilan" });

    activityCandidates.sort((a, b) => b.at.getTime() - a.at.getTime());
    const lastActivity = activityCandidates[0] || { at: user.updatedAt, source: "profil" };

    const { parseCommercialProfile } = await import("@/data/commercialProfile");
    const commercial = parseCommercialProfile(user.profile);
    const companyName =
      String(commercial.commercialTitle || "").trim() ||
      (shop?.name ? String(shop.name).trim() : "") ||
      null;

    return NextResponse.json({
      user,
      shop: shop
        ? {
            ...shop,
            displayName: companyName || shop.name,
            companyName,
          }
        : companyName
          ? {
              id: null,
              name: companyName,
              displayName: companyName,
              companyName,
              city: commercial.businessCity || null,
              phone: null,
              isActive: true,
              createdAt: null,
            }
          : null,
      companyName,
      commercialProfile: commercial,
      subscription: subscription
        ? {
            isActive: subscription.isActive,
            endsAt: subscription.endsAt,
            startsAt: subscription.startsAt,
            packageName: subscription.package?.name || null,
          }
        : null,
      stats: {
        paymentsTotalTl: Number(paymentsAgg._sum.amountTl || 0),
        paymentsCount,
        bidsCount,
        listingsCount,
        messagesSent,
        messagesReceived,
        messagesTotal: messagesSent + messagesReceived,
      },
      recentPayments: recentPayments.map((p) => ({
        ...p,
        amountTl: Number(p.amountTl),
      })),
      recentBids: recentBids.map((b) => ({
        ...b,
        amount: Number(b.amount),
      })),
      recentListings: recentListings.map((l) => ({
        ...l,
        askPrice: Number(l.askPrice),
      })),
      lastActivityAt: lastActivity.at.toISOString(),
      lastActivitySource: lastActivity.source,
    });
  }

  if (view === "seller-reviews") {
    const { listPendingSellerReviews } = await import("@/core/services/sellerReviewService");
    const reviews = await listPendingSellerReviews();
    return NextResponse.json({
      reviews: reviews.map((r) => ({
        ...r,
        createdAt: r.createdAt,
      })),
    });
  }

  if (view === "pending-listings") {
    const vertical = parseAdminVertical(searchParams.get("vertical"));
    const pendingWhere: Record<string, unknown> = { status: ListingStatus.PENDING_REVIEW };
    if (vertical) {
      pendingWhere.category = categoryWhereForVertical(vertical);
    }
    const [pending, autoApprove] = await Promise.all([
      prisma.listing.findMany({
        where: pendingWhere,
        orderBy: { createdAt: "asc" },
        include: {
          category: true,
          seller: {
            select: {
              id: true,
              name: true,
              phone: true,
              email: true,
              accountType: true,
              createdAt: true,
              memberSince: true,
            },
          },
        },
      }),
      getSetting<boolean>("listing_auto_approve", false),
    ]);
    const { enrichPendingListingsWithFeeInfo } = await import("@/core/services/revenueService");
    const enriched = await enrichPendingListingsWithFeeInfo(pending);
    return NextResponse.json({
      pendingReviewCount: enriched.length,
      autoApprove: autoApprove === true,
      listings: enriched.map((l) => ({
        ...l,
        askPrice: Number(l.askPrice),
        highestBid: Number(l.highestBid),
        feePaidTl: Number(l.feePaidTl || 0),
        feePayment: l.feePayment
          ? {
              ...l.feePayment,
              amountTl: Number(l.feePayment.amountTl),
              createdAt: l.feePayment.createdAt,
            }
          : null,
      })),
    });
  }

  if (view === "revenue") {
    const days = Number(searchParams.get("days") || 30);
    const { getRevenueDashboard } = await import("@/core/services/revenueService");
    const data = await getRevenueDashboard({ days });
    return NextResponse.json(data);
  }

  /** Sadece ayarlar — hafif */
  if (view === "settings") {
    const force = searchParams.get("force") === "1";
    const map = await getSettingsMap(force);
    return NextResponse.json({ settings: map, meta: DEFAULT_SETTINGS });
  }

  /** Reklam Ayarları — hafif payload (tam dashboard çekilmez) */
  if (view === "ads") {
    const map = await getSettingsMap(true);
    let contents: Array<{
      id: string;
      slug: string;
      title: string;
      body: string;
      kind: string;
      isPublished: boolean;
      sortOrder: number;
    }> = [];
    try {
      contents = await prisma.$queryRawUnsafe(
        `SELECT id, slug, title, body, kind::text AS kind, "isPublished", "sortOrder"
         FROM "ContentPage"
         WHERE "tenantId" = $1 AND kind::text IN ('PROMO', 'BANNER')
         ORDER BY "sortOrder" ASC, "updatedAt" DESC`,
        tenant.id
      );
    } catch (err) {
      console.error("[admin view=ads] contents", err);
      try {
        const rows = await prisma.contentPage.findMany({
          where: { tenantId: tenant.id, kind: { in: ["BANNER", "PROMO"] as any } },
          orderBy: [{ sortOrder: "asc" }, { updatedAt: "desc" }],
          select: {
            id: true,
            slug: true,
            title: true,
            body: true,
            kind: true,
            isPublished: true,
            sortOrder: true,
          },
        });
        contents = rows.map((r) => ({ ...r, kind: String(r.kind) }));
      } catch (err2) {
        console.error("[admin view=ads] contents fallback", err2);
      }
    }
    return NextResponse.json({
      settings: map,
      meta: DEFAULT_SETTINGS,
      contents,
    });
  }

  if (view === "pending-extensions") {
    const vertical = parseAdminVertical(searchParams.get("vertical"));
    const listingCategoryFilter = vertical
      ? { listing: { category: categoryWhereForVertical(vertical) } }
      : {};
    const include = {
      listing: {
        include: {
          category: true,
          seller: {
            select: {
              id: true,
              name: true,
              phone: true,
              email: true,
              accountType: true,
            },
          },
        },
      },
    };

    function mapExt(r: any) {
      return {
        id: r.id,
        days: r.days,
        status: r.status,
        rejectionReason: r.rejectionReason,
        createdAt: r.createdAt,
        reviewedAt: r.reviewedAt,
        listing: {
          id: r.listing.id,
          title: r.listing.title,
          city: r.listing.city,
          district: r.listing.district,
          dealType: r.listing.dealType,
          status: r.listing.status,
          endsAt: r.listing.endsAt,
          askPrice: Number(r.listing.askPrice),
          coverImage: r.listing.coverImage,
          category: r.listing.category,
          seller: r.listing.seller,
        },
      };
    }

    const [pending, approved, rejected] = await Promise.all([
      prisma.listingExtensionRequest.findMany({
        where: { status: ExtensionRequestStatus.PENDING, ...listingCategoryFilter },
        orderBy: { createdAt: "asc" },
        include,
      }),
      prisma.listingExtensionRequest.findMany({
        where: { status: ExtensionRequestStatus.APPROVED, ...listingCategoryFilter },
        orderBy: { reviewedAt: "desc" },
        take: 50,
        include,
      }),
      prisma.listingExtensionRequest.findMany({
        where: { status: ExtensionRequestStatus.REJECTED, ...listingCategoryFilter },
        orderBy: { reviewedAt: "desc" },
        take: 50,
        include,
      }),
    ]);

    return NextResponse.json({
      pendingExtensionCount: pending.length,
      pending: pending.map(mapExt),
      approved: approved.map(mapExt),
      rejected: rejected.map(mapExt),
      requests: pending.map(mapExt),
    });
  }

  if (view === "pending-edits") {
    const vertical = parseAdminVertical(searchParams.get("vertical"));
    const listingCategoryFilter = vertical
      ? { listing: { category: categoryWhereForVertical(vertical) } }
      : {};
    const include = {
      listing: {
        include: {
          category: true,
          seller: {
            select: {
              id: true,
              name: true,
              phone: true,
              email: true,
              accountType: true,
            },
          },
        },
      },
    };

    function mapEdit(r: {
      id: string;
      status: string;
      payload: unknown;
      rejectionReason: string | null;
      createdAt: Date;
      reviewedAt: Date | null;
      listing: {
        id: string;
        listingNo: string | null;
        title: string;
        description: string;
        city: string;
        district: string | null;
        neighborhood: string | null;
        dealType: string;
        status: string;
        endsAt: Date | null;
        askPrice: bigint;
        durationDays: number;
        coverImage: string | null;
        images: unknown;
        category: { id: string; name: string; slug: string } | null;
        seller: {
          id: string;
          name: string | null;
          phone: string | null;
          email: string | null;
          accountType: string;
        } | null;
      };
    }) {
      const p = (r.payload || {}) as Record<string, unknown>;
      return {
        id: r.id,
        status: r.status,
        rejectionReason: r.rejectionReason,
        createdAt: r.createdAt,
        reviewedAt: r.reviewedAt,
        payload: {
          ...p,
          askPrice: p.askPrice != null ? Number(p.askPrice) : null,
        },
        listing: {
          id: r.listing.id,
          listingNo: r.listing.listingNo,
          title: r.listing.title,
          description: r.listing.description,
          city: r.listing.city,
          district: r.listing.district,
          neighborhood: r.listing.neighborhood,
          dealType: r.listing.dealType,
          status: r.listing.status,
          endsAt: r.listing.endsAt,
          askPrice: Number(r.listing.askPrice),
          durationDays: r.listing.durationDays,
          coverImage: r.listing.coverImage,
          images: r.listing.images,
          category: r.listing.category,
          seller: r.listing.seller,
        },
      };
    }

    const [pending, approved, rejected] = await Promise.all([
      prisma.listingEditRequest.findMany({
        where: { status: EditRequestStatus.PENDING, ...listingCategoryFilter },
        orderBy: { createdAt: "asc" },
        include,
      }),
      prisma.listingEditRequest.findMany({
        where: { status: EditRequestStatus.APPROVED, ...listingCategoryFilter },
        orderBy: { reviewedAt: "desc" },
        take: 50,
        include,
      }),
      prisma.listingEditRequest.findMany({
        where: { status: EditRequestStatus.REJECTED, ...listingCategoryFilter },
        orderBy: { reviewedAt: "desc" },
        take: 50,
        include,
      }),
    ]);

    return NextResponse.json({
      pendingEditCount: pending.length,
      pending: pending.map(mapEdit),
      approved: approved.map(mapEdit),
      rejected: rejected.map(mapEdit),
      requests: pending.map(mapEdit),
    });
  }

  if (view === "bulk-listing-updates") {
    const include = {
      seller: {
        select: { id: true, name: true, phone: true, email: true, accountType: true },
      },
    };
    const [pending, approved, rejected] = await Promise.all([
      prisma.bulkListingUpdateRequest.findMany({
        where: { status: EditRequestStatus.PENDING },
        orderBy: { createdAt: "asc" },
        include,
      }),
      prisma.bulkListingUpdateRequest.findMany({
        where: { status: EditRequestStatus.APPROVED },
        orderBy: { reviewedAt: "desc" },
        take: 40,
        include,
      }),
      prisma.bulkListingUpdateRequest.findMany({
        where: { status: EditRequestStatus.REJECTED },
        orderBy: { reviewedAt: "desc" },
        take: 40,
        include,
      }),
    ]);
    const map = (r: (typeof pending)[number]) => ({
      id: r.id,
      status: r.status,
      rejectionReason: r.rejectionReason,
      createdAt: r.createdAt,
      reviewedAt: r.reviewedAt,
      items: r.items,
      seller: r.seller,
    });
    return NextResponse.json({
      pending: pending.map(map),
      approved: approved.map(map),
      rejected: rejected.map(map),
    });
  }

  if (view === "seller-admin-requests") {
    const include = {
      listing: {
        select: {
          id: true,
          title: true,
          listingNo: true,
          city: true,
          district: true,
          neighborhood: true,
          status: true,
          bidCount: true,
          coverImage: true,
          askPrice: true,
          description: true,
          dealType: true,
          images: true,
          attributes: true,
        },
      },
      seller: {
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          accountType: true,
        },
      },
    };

    const [pending, granted, pendingApproval, closed] = await Promise.all([
      prisma.sellerAdminRequest.findMany({
        where: { status: SellerAdminRequestStatus.PENDING },
        orderBy: { createdAt: "asc" },
        include,
      }),
      prisma.sellerAdminRequest.findMany({
        where: { status: SellerAdminRequestStatus.GRANTED },
        orderBy: { grantedAt: "desc" },
        take: 30,
        include,
      }),
      prisma.sellerAdminRequest.findMany({
        where: { status: SellerAdminRequestStatus.PENDING_APPROVAL },
        orderBy: { updatedAt: "asc" },
        include,
      }),
      prisma.sellerAdminRequest.findMany({
        where: {
          status: {
            in: [
              SellerAdminRequestStatus.APPROVED,
              SellerAdminRequestStatus.REJECTED,
              SellerAdminRequestStatus.RESOLVED,
            ],
          },
        },
        orderBy: { resolvedAt: "desc" },
        take: 50,
        include,
      }),
    ]);

    function mapReq(r: (typeof pending)[number]) {
      return {
        ...r,
        listing: r.listing
          ? { ...r.listing, askPrice: Number(r.listing.askPrice) }
          : r.listing,
      };
    }

    return NextResponse.json({
      pendingSellerRequestCount: pending.length + pendingApproval.length,
      pending: pending.map(mapReq),
      granted: granted.map(mapReq),
      pendingApproval: pendingApproval.map(mapReq),
      resolved: closed.map(mapReq),
    });
  }

  if (view === "token-refunds") {
    const refunds = await prisma.tokenRefund.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        user: { select: { id: true, name: true, phone: true } },
        listing: { select: { id: true, title: true, listingNo: true } },
      },
    });
    return NextResponse.json({
      refunds: refunds.map((r) => ({
        id: r.id,
        amount: r.amount,
        reason: r.reason,
        description: r.description,
        bidId: r.bidId,
        requestId: r.requestId,
        createdAt: r.createdAt,
        user: r.user,
        listing: r.listing,
      })),
    });
  }

  /** AI ile ilan ekle — jeton harcamaları (ledger) */
  if (view === "ai-listing-usage") {
    const [entries, parseAgg, refundAgg] = await Promise.all([
      prisma.tokenLedger.findMany({
        where: { reason: { in: ["ai_listing_parse", "ai_listing_parse_refund"] } },
        orderBy: { createdAt: "desc" },
        take: 300,
        include: {
          user: { select: { id: true, name: true, phone: true, email: true } },
        },
      }),
      prisma.tokenLedger.aggregate({
        where: { reason: "ai_listing_parse" },
        _count: true,
        _sum: { delta: true },
      }),
      prisma.tokenLedger.aggregate({
        where: { reason: "ai_listing_parse_refund" },
        _count: true,
        _sum: { delta: true },
      }),
    ]);
    const tokensSpent = Math.abs(Number(parseAgg._sum.delta || 0));
    const tokensRefunded = Math.abs(Number(refundAgg._sum.delta || 0));
    return NextResponse.json({
      summary: {
        parseCount: parseAgg._count,
        refundCount: refundAgg._count,
        tokensSpent,
        tokensRefunded,
        netTokens: tokensSpent - tokensRefunded,
      },
      entries: entries.map((e) => ({
        id: e.id,
        delta: e.delta,
        balanceAfter: e.balanceAfter,
        reason: e.reason,
        meta: e.meta,
        createdAt: e.createdAt,
        user: e.user,
      })),
    });
  }

  if (view === "dashboard") {
    const now = new Date();
    const days30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const days60 = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    const activeWindow = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [
      totalListings,
      totalBids,
      totalUsers,
      sellers,
      volumeAgg,
      categories,
      bidStatusGroups,
      liveBids,
      recentListings,
      recentUsers,
      recentPayments,
      unreadMessages,
      listingSeriesRaw,
      bidSeriesRaw,
      activeListings,
      approvedBids,
      expiredBids,
      shopsCount,
      listingsLast30,
      listingsPrev30,
      bidsLast30,
      bidsPrev30,
      usersLast30,
      usersPrev30,
      sellersLast30,
      sellersPrev30,
      volumeLast30,
      volumePrev30,
      avgBidDurationAgg,
      activeUsers24h,
      pendingReviewCount,
      pendingExtensionCount,
      pendingEditCount,
      pendingSellerRequestCount,
      pendingCommercialUserCount,
    ] = await Promise.all([
      prisma.listing.count(),
      prisma.bid.count(),
      prisma.user.count(),
      prisma.user.count({ where: { listings: { some: {} } } }),
      prisma.bid.aggregate({ _sum: { amount: true } }),
      prisma.category.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
        include: { _count: { select: { listings: true } } },
      }),
      prisma.bid.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.bid.findMany({
        take: 6,
        orderBy: { createdAt: "desc" },
        include: {
          listing: {
            select: {
              id: true,
              title: true,
              city: true,
              district: true,
              coverImage: true,
              askPrice: true,
            },
          },
          bidder: { select: { name: true, phone: true, avatarUrl: true } },
        },
      }),
      prisma.listing.findMany({
        take: 8,
        orderBy: { updatedAt: "desc" },
        include: { seller: { select: { name: true, phone: true } }, category: true },
      }),
      prisma.user.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
        select: { id: true, name: true, phone: true, createdAt: true },
      }),
      prisma.payment.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
        include: { user: { select: { name: true, phone: true } } },
      }),
      prisma.message.count({ where: { isRead: false } }),
      prisma.listing.findMany({
        where: { createdAt: { gte: days30 } },
        select: { createdAt: true },
      }),
      prisma.bid.findMany({
        where: { createdAt: { gte: days30 } },
        select: { createdAt: true },
      }),
      prisma.listing.count({
        where: { status: { in: [ListingStatus.ACTIVE, ListingStatus.SELECTION] } },
      }),
      prisma.bid.count({ where: { status: BidStatus.APPROVED } }),
      prisma.bid.count({ where: { status: BidStatus.EXPIRED } }),
      prisma.shop.count({ where: { tenantId: tenant.id } }),
      prisma.listing.count({ where: { createdAt: { gte: days30 } } }),
      prisma.listing.count({ where: { createdAt: { gte: days60, lt: days30 } } }),
      prisma.bid.count({ where: { createdAt: { gte: days30 } } }),
      prisma.bid.count({ where: { createdAt: { gte: days60, lt: days30 } } }),
      prisma.user.count({ where: { createdAt: { gte: days30 } } }),
      prisma.user.count({ where: { createdAt: { gte: days60, lt: days30 } } }),
      prisma.user.count({
        where: { listings: { some: { createdAt: { gte: days30 } } } },
      }),
      prisma.user.count({
        where: {
          listings: { some: { createdAt: { gte: days60, lt: days30 } } },
        },
      }),
      prisma.bid.aggregate({
        where: { createdAt: { gte: days30 } },
        _sum: { amount: true },
      }),
      prisma.bid.aggregate({
        where: { createdAt: { gte: days60, lt: days30 } },
        _sum: { amount: true },
      }),
      prisma.bid.aggregate({ _avg: { durationDays: true } }),
      prisma.user.count({
        where: {
          OR: [
            { listings: { some: { createdAt: { gte: activeWindow } } } },
            { bids: { some: { createdAt: { gte: activeWindow } } } },
            { sentMessages: { some: { createdAt: { gte: activeWindow } } } },
          ],
        },
      }),
      prisma.listing.count({ where: { status: ListingStatus.PENDING_REVIEW } }),
      prisma.listingExtensionRequest.count({
        where: { status: ExtensionRequestStatus.PENDING },
      }),
      prisma.listingEditRequest.count({
        where: { status: EditRequestStatus.PENDING },
      }),
      prisma.sellerAdminRequest.count({
        where: {
          status: {
            in: [SellerAdminRequestStatus.PENDING, SellerAdminRequestStatus.PENDING_APPROVAL],
          },
        },
      }),
      prisma.user.count({
        where: {
          commercialStatus: "PENDING",
          accountType: { in: [AccountType.TICARI, AccountType.EMLAKCI, AccountType.GALERICI] },
        },
      }),
    ]);

    const seriesMap: Record<string, { listings: number; bids: number }> = {};
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      seriesMap[dayKey(d)] = { listings: 0, bids: 0 };
    }
    for (const row of listingSeriesRaw) {
      const k = dayKey(row.createdAt);
      if (seriesMap[k]) seriesMap[k].listings += 1;
    }
    for (const row of bidSeriesRaw) {
      const k = dayKey(row.createdAt);
      if (seriesMap[k]) seriesMap[k].bids += 1;
    }
    const chartSeries = Object.entries(seriesMap).map(([date, v]) => ({ date, ...v }));

    const bidStatusMap: Record<string, number> = {
      ACTIVE: 0,
      APPROVED: 0,
      REJECTED: 0,
      EXPIRED: 0,
      WITHDRAWN: 0,
    };
    for (const g of bidStatusGroups) {
      bidStatusMap[g.status] = g._count._all;
    }

    const volume = Number(volumeAgg._sum.amount || 0);
    const acceptRate = totalBids ? Math.round((approvedBids / totalBids) * 10000) / 100 : 0;
    const bidPerListing = totalListings ? Math.round((totalBids / totalListings) * 100) / 100 : 0;

    const activity: Array<{
      id: string;
      type: string;
      label: string;
      user: string;
      detail: string;
      at: string;
      tone: "ok" | "warn" | "err" | "info" | "token";
    }> = [];

    for (const l of recentListings.slice(0, 4)) {
      activity.push({
        id: `l-${l.id}`,
        type: l.status === "ACTIVE" ? "İlan Onaylandı" : "İlan Güncellendi",
        label: l.status,
        user: l.seller?.name || l.seller?.phone || "—",
        detail: l.title,
        at: l.updatedAt.toISOString(),
        tone: l.status === "ARCHIVED" ? "err" : "ok",
      });
    }
    for (const u of recentUsers.slice(0, 2)) {
      activity.push({
        id: `u-${u.id}`,
        type: "Yeni Üyelik",
        label: "USER",
        user: u.name || u.phone,
        detail: "Kayıt tamamlandı",
        at: u.createdAt.toISOString(),
        tone: "info",
      });
    }
    for (const p of recentPayments.slice(0, 2)) {
      activity.push({
        id: `p-${p.id}`,
        type: "Jeton Satın Alındı",
        label: p.purpose,
        user: p.user?.name || p.user?.phone || "—",
        detail: `${p.amountTl} TL`,
        at: p.createdAt.toISOString(),
        tone: "token",
      });
    }
    activity.sort((a, b) => +new Date(b.at) - +new Date(a.at));

    const adminUser = await prisma.user.findUnique({
      where: { id: session.id },
      select: { name: true, phone: true, avatarUrl: true, role: true },
    });

    return NextResponse.json({
      adminUser,
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        plan: tenant.plan,
        shopsCount,
      },
      kpis: {
        totalListings,
        totalBids,
        totalUsers,
        sellers,
        volume,
        activeListings,
        unreadMessages,
        pendingReviewCount,
        pendingExtensionCount,
        pendingEditCount,
        pendingSellerRequestCount,
        pendingCommercialUserCount,
        acceptRate,
        bidPerListing,
        shopsCount,
        trends: {
          listings: pctChange(listingsLast30, listingsPrev30),
          bids: pctChange(bidsLast30, bidsPrev30),
          users: pctChange(usersLast30, usersPrev30),
          sellers: pctChange(sellersLast30, sellersPrev30),
          volume: pctChange(
            Number(volumeLast30._sum.amount || 0),
            Number(volumePrev30._sum.amount || 0),
          ),
        },
      },
      chartSeries,
      categories: categories.map((c) => ({
        slug: c.slug,
        name: c.name,
        count: c._count.listings,
      })),
      bidStatus: {
        pending: bidStatusMap.ACTIVE || 0,
        approved: bidStatusMap.APPROVED || 0,
        rejected: bidStatusMap.REJECTED || 0,
        expired: bidStatusMap.EXPIRED || expiredBids || 0,
        total: totalBids,
      },
      liveBids: liveBids.map((b) => ({
        id: b.id,
        amount: Number(b.amount),
        createdAt: b.createdAt,
        listing: {
          ...b.listing,
          askPrice: Number(b.listing.askPrice),
        },
        bidder: {
          name: b.bidder.name,
          phone: b.bidder.phone,
          avatarUrl: b.bidder.avatarUrl,
          handle: `@${(b.bidder.name || b.bidder.phone || "user")
            .toLowerCase()
            .replace(/\s+/g, "")
            .slice(0, 12)}`,
        },
      })),
      activity: activity.slice(0, 8),
      system: [
        { name: "Web Servisleri", ok: true },
        { name: "Mobil API", ok: true },
        { name: "Veritabanı", ok: true },
        { name: "Bildirim Servisi", ok: true },
        { name: "Dosya Depolama", ok: true },
      ],
      quick: {
        avgBidDuration: formatAvgDuration(avgBidDurationAgg._avg.durationDays),
        bidPerListing,
        acceptRate,
        onlineUsers: activeUsers24h,
      },
    });
  }

  /** Dikey özet sayfaları — emlak-vasita / alisveris / premium */
  if (view === "vertical-overview") {
    const vertical = parseAdminVertical(searchParams.get("vertical"));
    if (!vertical) {
      return NextResponse.json({ error: "vertical gerekli" }, { status: 400 });
    }
    const catWhere = categoryWhereForVertical(vertical);
    const listingWhere = { category: catWhere };
    const now = new Date();
    const days30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const days60 = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    const [
      totalListings,
      activeListings,
      pendingReview,
      pendingEdit,
      pendingExtension,
      totalBids,
      bidsLast30,
      bidsPrev30,
      listingsLast30,
      listingsPrev30,
      categories,
      recentListings,
      liveBids,
    ] = await Promise.all([
      prisma.listing.count({ where: listingWhere }),
      prisma.listing.count({
        where: {
          ...listingWhere,
          status: { in: [ListingStatus.ACTIVE, ListingStatus.SELECTION] },
        },
      }),
      prisma.listing.count({
        where: { ...listingWhere, status: ListingStatus.PENDING_REVIEW },
      }),
      prisma.listingEditRequest.count({
        where: { status: EditRequestStatus.PENDING, listing: listingWhere },
      }),
      prisma.listingExtensionRequest.count({
        where: { status: ExtensionRequestStatus.PENDING, listing: listingWhere },
      }),
      prisma.bid.count({ where: { listing: listingWhere } }),
      prisma.bid.count({
        where: { listing: listingWhere, createdAt: { gte: days30 } },
      }),
      prisma.bid.count({
        where: { listing: listingWhere, createdAt: { gte: days60, lt: days30 } },
      }),
      prisma.listing.count({
        where: { ...listingWhere, createdAt: { gte: days30 } },
      }),
      prisma.listing.count({
        where: { ...listingWhere, createdAt: { gte: days60, lt: days30 } },
      }),
      prisma.category.findMany({
        where: { AND: [{ isActive: true }, catWhere] },
        orderBy: { sortOrder: "asc" },
        include: { _count: { select: { listings: true } } },
        take: 24,
      }),
      prisma.listing.findMany({
        where: listingWhere,
        take: 6,
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          title: true,
          status: true,
          city: true,
          coverImage: true,
          askPrice: true,
          updatedAt: true,
          category: { select: { name: true, slug: true } },
        },
      }),
      prisma.bid.findMany({
        where: { listing: listingWhere },
        take: 5,
        orderBy: { createdAt: "desc" },
        include: {
          listing: { select: { id: true, title: true, coverImage: true } },
          bidder: { select: { name: true, phone: true } },
        },
      }),
    ]);

    const topCategories = categories
      .map((c) => ({ slug: c.slug, name: c.name, count: c._count.listings }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    return NextResponse.json({
      vertical,
      kpis: {
        totalListings,
        activeListings,
        pendingReview,
        pendingEdit,
        pendingExtension,
        totalBids,
        trends: {
          listings: pctChange(listingsLast30, listingsPrev30),
          bids: pctChange(bidsLast30, bidsPrev30),
        },
      },
      topCategories,
      recentListings: recentListings.map((l) => ({
        id: l.id,
        title: l.title,
        status: l.status,
        city: l.city,
        coverImage: l.coverImage,
        askPrice: Number(l.askPrice),
        updatedAt: l.updatedAt.toISOString(),
        categoryName: l.category?.name || "",
      })),
      liveBids: liveBids.map((b) => ({
        id: b.id,
        amount: Number(b.amount),
        createdAt: b.createdAt.toISOString(),
        listing: b.listing,
        bidderName: b.bidder?.name || b.bidder?.phone || "—",
      })),
    });
  }

  /** Kategori menü paneli — facets + browse_nav_config + kategoriler */
  if (view === "category-nav") {
    const [facets, map, categories] = await Promise.all([
      getFacetCounts(true),
      getSettingsMap(true),
      prisma.category.findMany({
        orderBy: { sortOrder: "asc" },
        include: { _count: { select: { listings: true } } },
      }),
    ]);
    const config = normalizeBrowseNavConfig(map.browse_nav_config);
    return NextResponse.json({
      config,
      facets,
      categories: categories.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        icon: c.icon,
        sortOrder: c.sortOrder,
        isActive: c.isActive,
        parentId: c.parentId,
        listingCount: c._count.listings,
      })),
    });
  }

  /** Panel tabloları — ayar/dashboard değil; ağır alanlar (description/images) hariç */
  if (view === "tables" || !view) {
    const map = await getSettingsMap(false);
    const listingQ = String(searchParams.get("listingQ") || "").trim();
    const listingStatus = String(searchParams.get("listingStatus") || "").trim();
    const listingEnding = String(searchParams.get("listingEnding") || "").trim();
    const bidQ = String(searchParams.get("bidQ") || "").trim();
    const bidStatus = String(searchParams.get("bidStatus") || "").trim();
    const userQ = String(searchParams.get("userQ") || "").trim();
    const userActive = String(searchParams.get("userActive") || "").trim();
    const userAccountType = String(searchParams.get("userAccountType") || "").trim();
    const userSegment = String(searchParams.get("userSegment") || "").trim().toLowerCase();
    const userCommercialSubtype = String(searchParams.get("userCommercialSubtype") || "")
      .trim()
      .toUpperCase();
    const paymentQ = String(searchParams.get("paymentQ") || "").trim();
    const paymentStatus = String(searchParams.get("paymentStatus") || "").trim();
    const paymentPurpose = String(searchParams.get("paymentPurpose") || "").trim();
    const messageQ = String(searchParams.get("messageQ") || "").trim();
    const messageUnread = String(searchParams.get("messageUnread") || "").trim();
    const vertical = parseAdminVertical(searchParams.get("vertical"));

    const now = new Date();
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const listingWhere: Record<string, unknown> = {};
    const listingAnd: Record<string, unknown>[] = [];
    if (vertical) {
      listingAnd.push({ category: categoryWhereForVertical(vertical) });
    }
    if (listingStatus && Object.values(ListingStatus).includes(listingStatus as ListingStatus)) {
      listingAnd.push({ status: listingStatus as ListingStatus });
    }
    if (listingQ) {
      listingAnd.push({
        OR: [
          { title: { contains: listingQ, mode: "insensitive" } },
          { listingNo: { contains: listingQ, mode: "insensitive" } },
          { city: { contains: listingQ, mode: "insensitive" } },
          { seller: { name: { contains: listingQ, mode: "insensitive" } } },
          { seller: { phone: { contains: listingQ, mode: "insensitive" } } },
        ],
      });
    }
    if (listingEnding === "ending_soon") {
      listingAnd.push({ endsAt: { gt: now, lte: in24h } });
      if (!listingStatus) {
        listingAnd.push({ status: { in: [ListingStatus.ACTIVE, ListingStatus.SELECTION] } });
      }
    } else if (listingEnding === "expired") {
      listingAnd.push({
        OR: [{ endsAt: { lte: now } }, { status: ListingStatus.EXPIRED }],
      });
    } else if (listingEnding === "live") {
      listingAnd.push({ endsAt: { gt: now } });
      if (!listingStatus) {
        listingAnd.push({ status: { in: [ListingStatus.ACTIVE, ListingStatus.SELECTION] } });
      }
    }
    if (listingAnd.length === 1) Object.assign(listingWhere, listingAnd[0]);
    else if (listingAnd.length > 1) listingWhere.AND = listingAnd;

    const bidWhere: Record<string, unknown> = {};
    const bidAnd: Record<string, unknown>[] = [];
    if (vertical) {
      // Teklif = ilana bid; dikey yalnızca kendi listing kategorilerindeki teklifleri gösterir
      bidAnd.push({ listing: { category: categoryWhereForVertical(vertical) } });
    }
    if (bidStatus && Object.values(BidStatus).includes(bidStatus as BidStatus)) {
      bidAnd.push({ status: bidStatus as BidStatus });
    }
    if (bidQ) {
      bidAnd.push({
        OR: [
          { listing: { title: { contains: bidQ, mode: "insensitive" } } },
          { bidder: { name: { contains: bidQ, mode: "insensitive" } } },
          { bidder: { phone: { contains: bidQ, mode: "insensitive" } } },
        ],
      });
    }
    if (bidAnd.length === 1) Object.assign(bidWhere, bidAnd[0]);
    else if (bidAnd.length > 1) bidWhere.AND = bidAnd;

    const userWhere: Record<string, unknown> = {};
    const userAnd: Record<string, unknown>[] = [];
    if (userActive === "1") userWhere.isActive = true;
    if (userActive === "0") userWhere.isActive = false;
    if (userCommercialSubtype) {
      userAnd.push(corporateSubtypeWhere(userCommercialSubtype));
    } else if (userSegment === "corporate") {
      userAnd.push({ accountType: { in: CORPORATE_TYPES } });
    } else if (userSegment === "individual") {
      userAnd.push({ accountType: { in: INDIVIDUAL_TYPES } });
    } else if (userAccountType && Object.values(AccountType).includes(userAccountType as AccountType)) {
      userAnd.push({ accountType: userAccountType as AccountType });
    }
    if (userQ) {
      userAnd.push({
        OR: [
          { name: { contains: userQ, mode: "insensitive" } },
          { phone: { contains: userQ, mode: "insensitive" } },
        ],
      });
    }
    if (userAnd.length === 1) Object.assign(userWhere, userAnd[0]);
    else if (userAnd.length > 1) userWhere.AND = userAnd;

    const paymentWhere: Record<string, unknown> = {};
    if (paymentStatus && Object.values(PaymentStatus).includes(paymentStatus as PaymentStatus)) {
      paymentWhere.status = paymentStatus as PaymentStatus;
    }
    if (paymentPurpose) {
      paymentWhere.purpose = { contains: paymentPurpose, mode: "insensitive" };
    }
    if (paymentQ) {
      paymentWhere.OR = [
        { user: { name: { contains: paymentQ, mode: "insensitive" } } },
        { user: { phone: { contains: paymentQ, mode: "insensitive" } } },
        { purpose: { contains: paymentQ, mode: "insensitive" } },
        { id: { contains: paymentQ, mode: "insensitive" } },
      ];
    }

    const messageWhere: Record<string, unknown> = {};
    if (messageUnread === "1") messageWhere.isRead = false;
    if (messageQ) {
      messageWhere.OR = [
        { body: { contains: messageQ, mode: "insensitive" } },
        { sender: { name: { contains: messageQ, mode: "insensitive" } } },
        { sender: { phone: { contains: messageQ, mode: "insensitive" } } },
        { receiver: { name: { contains: messageQ, mode: "insensitive" } } },
        { receiver: { phone: { contains: messageQ, mode: "insensitive" } } },
        { listing: { title: { contains: messageQ, mode: "insensitive" } } },
      ];
    }

    const listingOrderBy =
      listingEnding === "ending_soon"
        ? ({ endsAt: "asc" } as const)
        : ({ createdAt: "desc" } as const);

    const [
      packages,
      shopPackages,
      users,
      listings,
      categories,
      bids,
      payments,
      messages,
      shops,
      contents,
      auditLogs,
      reportListings,
      reportBids,
      reportUsers,
      reportPayments,
      reportMessages,
      reportShops,
      unreadCount,
      demoCount,
    ] = await Promise.all([
      prisma.tokenPackage.findMany({ orderBy: { sortOrder: "asc" } }),
      prisma.shopPackage.findMany({ orderBy: { createdAt: "asc" }, take: 50 }),
      prisma.user.findMany({
        where: userWhere,
        take: 100,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          phone: true,
          name: true,
          role: true,
          accountType: true,
          commercialSubtypes: true,
          commercialStatus: true,
          tokenBalance: true,
          phoneVerified: true,
          isActive: true,
          createdAt: true,
        },
      }),
      prisma.listing.findMany({
        where: listingWhere,
        take: 120,
        orderBy: listingOrderBy,
        select: {
          id: true,
          listingNo: true,
          title: true,
          city: true,
          district: true,
          status: true,
          askPrice: true,
          highestBid: true,
          bidCount: true,
          endsAt: true,
          startsAt: true,
          createdAt: true,
          reviewedAt: true,
          reviewedById: true,
          coverImage: true,
          dealType: true,
          isFeatured: true,
          featuredDays: true,
          titleBold: true,
          titleLarge: true,
          isColored: true,
          durationDays: true,
          sellerId: true,
          category: { select: { id: true, name: true, slug: true } },
          seller: { select: { id: true, name: true, phone: true } },
          shop: {
            select: {
              id: true,
              name: true,
              subscription: { include: { package: { select: { id: true, name: true } } } },
            },
          },
        },
      }),
      prisma.category.findMany({
        orderBy: { sortOrder: "asc" },
        include: { _count: { select: { listings: true } } },
      }),
      prisma.bid.findMany({
        where: bidWhere,
        take: 100,
        orderBy: { createdAt: "desc" },
        include: {
          listing: {
            select: {
              id: true,
              title: true,
              askPrice: true,
              startsAt: true,
              endsAt: true,
              reviewedAt: true,
              createdAt: true,
            },
          },
          bidder: { select: { name: true, phone: true } },
        },
      }),
      prisma.payment.findMany({
        where: paymentWhere,
        take: 100,
        orderBy: { createdAt: "desc" },
        include: { user: { select: { name: true, phone: true } } },
      }),
      prisma.message.findMany({
        where: messageWhere,
        take: 80,
        orderBy: { createdAt: "desc" },
        include: {
          sender: { select: { name: true, phone: true } },
          receiver: { select: { name: true, phone: true } },
          listing: { select: { title: true } },
        },
      }),
      prisma.shop.findMany({
        where: { tenantId: tenant.id },
        orderBy: { createdAt: "desc" },
        take: 50,
        include: {
          owner: {
            select: {
              id: true,
              name: true,
              phone: true,
              accountType: true,
              isActive: true,
            },
          },
          subscription: { include: { package: true } },
        },
      }),
      prisma.contentPage.findMany({
        where: { tenantId: tenant.id },
        orderBy: [{ sortOrder: "asc" }, { updatedAt: "desc" }],
        take: 80,
        select: {
          id: true,
          slug: true,
          title: true,
          body: true,
          kind: true,
          isPublished: true,
          sortOrder: true,
          updatedAt: true,
          author: { select: { id: true, name: true, phone: true } },
        },
      }),
      prisma.auditLog.findMany({
        take: 80,
        orderBy: { createdAt: "desc" },
        include: {
          actor: { select: { id: true, name: true, phone: true } },
        },
      }),
      prisma.listing.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.bid.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.user.groupBy({ by: ["accountType"], _count: { _all: true } }),
      prisma.payment.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.message.count(),
      prisma.shop.count({ where: { tenantId: tenant.id } }),
      prisma.message.count({ where: { isRead: false } }),
      countDemoListings(),
    ]);

    const bizTypes = activeCommercialBusinessTypes(map[COMMERCIAL_BUSINESS_TYPES_SETTING_KEY]);
    const [userCountAll, userCountIndividual, userCountCorporate, corporateForFacets] =
      await Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { accountType: { in: INDIVIDUAL_TYPES } } }),
        prisma.user.count({ where: { accountType: { in: CORPORATE_TYPES } } }),
        prisma.user.findMany({
          where: { accountType: { in: CORPORATE_TYPES } },
          select: { accountType: true, commercialSubtypes: true },
          take: 20000,
        }),
      ]);

    const bySubtype: Record<string, number> = {};
    for (const bt of bizTypes) bySubtype[bt.key] = 0;
    for (const u of corporateForFacets) {
      const keys = new Set<string>(
        (u.commercialSubtypes || []).map((s) => String(s).toUpperCase())
      );
      if (u.accountType === AccountType.EMLAKCI) keys.add("EMLAK_OFISI");
      if (u.accountType === AccountType.GALERICI) keys.add("GALERI");
      for (const k of keys) {
        if (k in bySubtype) bySubtype[k] += 1;
      }
    }

    const userCounts = {
      all: userCountAll,
      individual: userCountIndividual,
      corporate: userCountCorporate,
      bySubtype,
    };

    const { enrichPendingListingsWithFeeInfo } = await import("@/core/services/revenueService");
    const listingsWithFees = await enrichPendingListingsWithFeeInfo(listings);

    // Kurumsal mağaza adı: şirket unvanı (eski "Ad Ofisi" kayıtlarını düzelt)
    const { syncShopNameFromUserProfile } = await import("@/core/services/tenantService");
    const shopSellerIds = [...new Set(listingsWithFees.filter((l) => l.shopId).map((l) => l.sellerId))];
    if (shopSellerIds.length) {
      await Promise.all(shopSellerIds.map((id) => syncShopNameFromUserProfile(id)));
    }
    const freshShopNames = shopSellerIds.length
      ? await prisma.shop.findMany({
          where: { ownerId: { in: shopSellerIds } },
          select: { id: true, name: true },
        })
      : [];
    const shopNameById = new Map(freshShopNames.map((s) => [s.id, s.name]));

    const reviewerIds = [
      ...new Set(
        listingsWithFees.map((l) => l.reviewedById).filter((id): id is string => Boolean(id))
      ),
    ];
    const sellerIdsForRating = [...new Set(listingsWithFees.map((l) => l.sellerId))];
    const [reviewers, ratingRows] = await Promise.all([
      reviewerIds.length
        ? prisma.user.findMany({
            where: { id: { in: reviewerIds } },
            select: { id: true, name: true, phone: true },
          })
        : Promise.resolve([] as Array<{ id: string; name: string | null; phone: string }>),
      sellerIdsForRating.length
        ? prisma.sellerReview.groupBy({
            by: ["sellerId"],
            where: { sellerId: { in: sellerIdsForRating }, status: "APPROVED" },
            _avg: { rating: true },
            _count: { _all: true },
          })
        : Promise.resolve([] as Array<{ sellerId: string; _avg: { rating: number | null }; _count: { _all: number } }>),
    ]);
    const reviewerById = new Map(reviewers.map((u) => [u.id, u]));
    const ratingBySeller = new Map(
      ratingRows.map((r) => [
        r.sellerId,
        {
          avg: r._avg.rating != null ? Math.round(Number(r._avg.rating) * 10) / 10 : null,
          count: r._count._all,
        },
      ])
    );

    const enrichedListings = listingsWithFees.map((l) => {
      const hasPremium =
        Boolean(l.isFeatured) ||
        Boolean(l.titleBold) ||
        Boolean(l.titleLarge) ||
        Boolean(l.isColored) ||
        Number(l.featuredDays || 0) > 0;
      const feePaidTl = Number(l.feePaidTl || 0);
      const reviewer = l.reviewedById ? reviewerById.get(l.reviewedById) : null;
      const rating = ratingBySeller.get(l.sellerId) || null;
      return {
        ...l,
        askPrice: Number(l.askPrice),
        highestBid: Number(l.highestBid),
        feePaidTl,
        feePayment: l.feePayment
          ? {
              ...l.feePayment,
              amountTl: Number(l.feePayment.amountTl),
              createdAt: l.feePayment.createdAt,
            }
          : null,
        hasPaidOrPremium: feePaidTl > 0 || hasPremium,
        hasPremium,
        reviewedBy: reviewer
          ? { id: reviewer.id, name: reviewer.name, phone: reviewer.phone }
          : null,
        sellerRating: rating,
        shopPackageName: l.shop?.subscription?.package?.name || null,
        shop: l.shop
          ? {
              ...l.shop,
              name: shopNameById.get(l.shop.id) || l.shop.name,
            }
          : l.shop,
      };
    });

    const bidListingIds = [...new Set(bids.map((b) => b.listingId))];
    const bidHistory =
      bidListingIds.length > 0
        ? await prisma.bid.findMany({
            where: { listingId: { in: bidListingIds } },
            orderBy: { createdAt: "desc" },
            select: { id: true, listingId: true, amount: true, createdAt: true },
            take: Math.min(800, Math.max(bidListingIds.length * 12, 40)),
          })
        : [];
    const bidHistoryByListing = new Map<string, typeof bidHistory>();
    for (const row of bidHistory) {
      const arr = bidHistoryByListing.get(row.listingId) || [];
      arr.push(row);
      bidHistoryByListing.set(row.listingId, arr);
    }
    function previousBidAmount(bid: { id: string; listingId: string; createdAt: Date }) {
      const rows = bidHistoryByListing.get(bid.listingId) || [];
      for (const row of rows) {
        if (row.id === bid.id) continue;
        if (row.createdAt.getTime() < bid.createdAt.getTime()) return Number(row.amount);
      }
      return null;
    }
    const enrichedBids = bids.map((b) => ({
      ...b,
      amount: Number(b.amount),
      previousAmount: previousBidAmount(b),
      listing: b.listing
        ? { ...b.listing, askPrice: Number(b.listing.askPrice) }
        : b.listing,
    }));

    return NextResponse.json({
      settings: map,
      meta: DEFAULT_SETTINGS,
      demo: {
        count: demoCount,
        catalogSize: DEMO_LISTING_SEEDS.length,
      },
      packages: await enrichPackagesWithVat(packages, "TokenPackage"),
      shopPackages: await enrichPackagesWithVat(shopPackages, "ShopPackage"),
      users,
      userCounts,
      categories,
      payments,
      messages,
      tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug },
      shops,
      contents,
      auditLogs,
      filters: {
        listingQ,
        listingStatus,
        listingEnding,
        bidQ,
        bidStatus,
        userQ,
        userActive,
        userAccountType,
        userSegment,
        userCommercialSubtype,
        paymentQ,
        paymentStatus,
        paymentPurpose,
        messageQ,
        messageUnread,
      },
      reports: {
        listings: Object.fromEntries(reportListings.map((g) => [g.status, g._count._all])),
        bids: Object.fromEntries(reportBids.map((g) => [g.status, g._count._all])),
        usersByAccountType: Object.fromEntries(
          reportUsers.map((g) => [g.accountType, g._count._all]),
        ),
        payments: Object.fromEntries(reportPayments.map((g) => [g.status, g._count._all])),
        messages: {
          total: reportMessages,
          unread: unreadCount,
        },
        shops: reportShops,
        totals: {
          listings: reportListings.reduce((a, g) => a + g._count._all, 0),
          bids: reportBids.reduce((a, g) => a + g._count._all, 0),
          users: reportUsers.reduce((a, g) => a + g._count._all, 0),
          payments: reportPayments.reduce((a, g) => a + g._count._all, 0),
        },
      },
      bids: enrichedBids,
      listings: enrichedListings,
    });
  }

  return NextResponse.json({ error: "Geçersiz view" }, { status: 400 });
}

export async function POST(req: Request) {
  let admin;
  try {
    admin = await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
  }

  const tenant = await ensureDefaultTenant(admin.id);
  const body = await req.json();
  const action = body.action as string;

  if (action === "save-settings") {
    const entries = body.settings as Record<string, unknown>;
    const { normalizeCommercialBusinessTypes } = await import("@/lib/commercialBusinessTypes");
    for (const [key, value] of Object.entries(entries)) {
      let next = value;
      if (key === COMMERCIAL_BUSINESS_TYPES_SETTING_KEY) {
        next = normalizeCommercialBusinessTypes(value);
      }
      await setSetting(key, next);
    }
    invalidateSettingsCache();
    await writeAuditLog({
      tenantId: tenant.id,
      actorId: admin.id,
      action: "settings.save",
      entity: "SystemSetting",
      meta: { keys: Object.keys(entries) },
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "demo-seed") {
    const result = await seedDemoListings(admin.id, { asActive: Boolean(body.asActive) });
    await writeAuditLog({
      tenantId: tenant.id,
      actorId: admin.id,
      action: "demo.seed",
      entity: "Listing",
      meta: result,
    });
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  }

  if (action === "demo-flow-start") {
    const result = await startDemoMarketplaceFlow(admin.id);
    await writeAuditLog({
      tenantId: tenant.id,
      actorId: admin.id,
      action: "demo.flow.start",
      entity: "Listing",
      meta: result,
    });
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  }

  if (action === "demo-flow-stop") {
    const result = await removeAllDemoData();
    await writeAuditLog({
      tenantId: tenant.id,
      actorId: admin.id,
      action: "demo.flow.stop",
      entity: "Listing",
      meta: result,
    });
    return NextResponse.json(result);
  }

  if (action === "demo-publish") {
    const result = await publishDemoListings();
    await writeAuditLog({
      tenantId: tenant.id,
      actorId: admin.id,
      action: "demo.publish",
      entity: "Listing",
      meta: result,
    });
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  }

  if (action === "demo-remove") {
    const result = await removeAllDemoData();
    await writeAuditLog({
      tenantId: tenant.id,
      actorId: admin.id,
      action: "demo.remove",
      entity: "Listing",
      meta: result,
    });
    return NextResponse.json(result);
  }

  if (action === "demo-reload") {
    const result = await reloadDemoListings(admin.id);
    await writeAuditLog({
      tenantId: tenant.id,
      actorId: admin.id,
      action: "demo.reload",
      entity: "Listing",
      meta: result,
    });
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  }

  if (action === "save-token-package") {
    let packageId = body.id as string | undefined;
    const discountPercent = Math.max(0, Math.min(90, Number(body.discountPercent || 0)));
    const description = String(body.description || "").trim() || null;
    const pricesIncludeVat = body.pricesIncludeVat !== false;
    const vatPercent = Math.max(0, Math.min(40, Number(body.vatPercent ?? 20)));
    if (packageId) {
      await prisma.tokenPackage.update({
        where: { id: packageId },
        data: {
          name: body.name,
          description,
          tokenAmount: Number(body.tokenAmount),
          priceTl: Number(body.priceTl),
          isActive: Boolean(body.isActive),
          sortOrder: Number(body.sortOrder || 0),
        },
      });
    } else {
      const created = await prisma.tokenPackage.create({
        data: {
          name: body.name,
          description,
          tokenAmount: Number(body.tokenAmount),
          priceTl: Number(body.priceTl),
          isActive: true,
          sortOrder: Number(body.sortOrder || 0),
        },
      });
      packageId = created.id;
    }
    if (packageId) {
      await prisma.$executeRaw`
        UPDATE "TokenPackage"
        SET "discountPercent" = ${discountPercent},
            "pricesIncludeVat" = ${pricesIncludeVat},
            "vatPercent" = ${vatPercent}
        WHERE id = ${packageId}
      `;
    }
    await writeAuditLog({
      tenantId: tenant.id,
      actorId: admin.id,
      action: body.id ? "tokenPackage.update" : "tokenPackage.create",
      entity: "TokenPackage",
      entityId: packageId,
      meta: { name: body.name, pricesIncludeVat, vatPercent },
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "save-shop-package") {
    const { normalizeBillingType } = await import("@/lib/shopPackageBilling");
    const billingType = normalizeBillingType(body.billingType);
    const minDays = Math.max(1, Math.floor(Number(body.minDays) || 1));
    const maxDays = Math.max(minDays, Math.floor(Number(body.maxDays) || 30));
    const pricesIncludeVat = body.pricesIncludeVat !== false;
    const vatPercent = Math.max(0, Math.min(40, Number(body.vatPercent ?? 20)));
    const payload = {
      name: body.name,
      accountType: body.accountType,
      billingType,
      monthlyPrice: Number(body.monthlyPrice),
      tokenPrice:
        body.tokenPrice != null && body.tokenPrice !== "" && Number(body.tokenPrice) > 0
          ? Math.floor(Number(body.tokenPrice))
          : null,
      listingLimit: Math.max(1, Math.floor(Number(body.listingLimit) || 1)),
      minDays,
      maxDays,
      description: body.description || null,
      premiumDiscountPercent: Math.max(
        0,
        Math.min(100, Math.floor(Number(body.premiumDiscountPercent) || 0))
      ),
      isActive: body.isActive !== false,
    };
    let packageId = body.id as string | undefined;
    if (packageId) {
      await prisma.shopPackage.update({
        where: { id: packageId },
        data: payload,
      });
    } else {
      const created = await prisma.shopPackage.create({
        data: payload,
      });
      packageId = created.id;
    }
    if (packageId) {
      await prisma.$executeRaw`
        UPDATE "ShopPackage"
        SET "pricesIncludeVat" = ${pricesIncludeVat},
            "vatPercent" = ${vatPercent}
        WHERE id = ${packageId}
      `;
    }
    await writeAuditLog({
      tenantId: tenant.id,
      actorId: admin.id,
      action: body.id ? "shopPackage.update" : "shopPackage.create",
      entity: "ShopPackage",
      entityId: packageId,
      meta: { name: body.name, accountType: body.accountType, billingType, pricesIncludeVat, vatPercent },
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "toggle-user") {
    await prisma.user.update({
      where: { id: body.userId },
      data: { isActive: Boolean(body.isActive) },
    });
    await writeAuditLog({
      tenantId: tenant.id,
      actorId: admin.id,
      action: "user.toggle",
      entity: "User",
      entityId: body.userId,
      meta: { isActive: Boolean(body.isActive) },
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "update-user") {
    const userId = String(body.userId || "").trim();
    if (!userId) return NextResponse.json({ error: "userId gerekli" }, { status: 400 });
    const existing = await prisma.user.findUnique({ where: { id: userId } });
    if (!existing) return NextResponse.json({ error: "Kullanıcı bulunamadı" }, { status: 404 });

    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = String(body.name || "").trim() || null;
    if (body.email !== undefined) {
      const email = String(body.email || "").trim().toLowerCase();
      data.email = email || null;
      if (email) {
        const taken = await prisma.user.findFirst({
          where: { email, NOT: { id: userId } },
          select: { id: true },
        });
        if (taken) return NextResponse.json({ error: "Bu e-posta başka bir hesaba ait" }, { status: 409 });
      }
    }
    if (body.phone !== undefined) {
      let phone = String(body.phone || "").replace(/\D/g, "");
      if (phone.startsWith("0")) phone = phone.slice(1);
      if (phone.length === 10) phone = `0${phone}`;
      if (phone.length < 11) {
        return NextResponse.json({ error: "Geçerli telefon gerekli" }, { status: 400 });
      }
      const taken = await prisma.user.findFirst({
        where: { phone, NOT: { id: userId } },
        select: { id: true },
      });
      if (taken) return NextResponse.json({ error: "Bu telefon başka bir hesaba ait" }, { status: 409 });
      data.phone = phone;
    }
    if (body.accountType !== undefined) {
      const at = String(body.accountType || "").toUpperCase();
      if (at === "TICARI" || at === "BIREYSEL_TICARI" || at === "BIREYSEL") {
        data.accountType = at === "BIREYSEL" ? "BIREYSEL_TICARI" : at;
      }
    }
    if (body.commercialSubtypes !== undefined) {
      const {
        COMMERCIAL_BUSINESS_TYPES_SETTING_KEY,
        allowedBusinessTypeKeys,
      } = await import("@/lib/commercialBusinessTypes");
      const { parseCommercialSubtypes } = await import("@/lib/accountTypes");
      const bizRaw = await getSetting(COMMERCIAL_BUSINESS_TYPES_SETTING_KEY, null);
      const allowed = allowedBusinessTypeKeys(bizRaw, false);
      data.commercialSubtypes = parseCommercialSubtypes(body.commercialSubtypes, allowed, true);
    }
    if (body.tokenBalance !== undefined) {
      const n = Number(body.tokenBalance);
      if (!Number.isFinite(n) || n < 0) {
        return NextResponse.json({ error: "Geçersiz jeton bakiyesi" }, { status: 400 });
      }
      data.tokenBalance = Math.floor(n);
    }
    if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);
    if (body.role !== undefined) {
      const role = String(body.role || "").toUpperCase();
      if (role === "USER" || role === "ADMIN") {
        if (userId === admin.id && role !== "ADMIN") {
          return NextResponse.json({ error: "Kendi yönetici rolünüzü kaldıramazsınız" }, { status: 400 });
        }
        data.role = role;
      }
    }
    if (body.commercialStatus !== undefined) {
      const st = String(body.commercialStatus || "").toUpperCase();
      if (!st) data.commercialStatus = null;
      else if (["PENDING", "APPROVED", "REJECTED"].includes(st)) data.commercialStatus = st;
    }
    if (body.commercialProfile !== undefined) {
      const {
        parseCommercialProfile,
        mergeCommercialIntoProfile,
      } = await import("@/data/commercialProfile");
      const commercial = parseCommercialProfile(body.commercialProfile || {});
      const prev =
        existing.profile && typeof existing.profile === "object" && !Array.isArray(existing.profile)
          ? { ...(existing.profile as Record<string, unknown>) }
          : {};
      const asStringMap = Object.fromEntries(
        Object.entries(prev)
          .filter(([k]) => k !== "_pendingCommercial" && k !== "_pendingSubtypes")
          .map(([k, v]) => [k, v == null ? "" : String(v)])
      );
      data.profile = mergeCommercialIntoProfile(asStringMap, commercial) as object;
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        accountType: true,
        commercialSubtypes: true,
        commercialStatus: true,
        role: true,
        tokenBalance: true,
        isActive: true,
      },
    });
    if (String(updated.accountType).toUpperCase() === "TICARI") {
      const { syncShopNameFromUserProfile } = await import("@/core/services/tenantService");
      await syncShopNameFromUserProfile(userId);
    }
    await writeAuditLog({
      tenantId: tenant.id,
      actorId: admin.id,
      action: "user.update",
      entity: "User",
      entityId: userId,
      meta: { fields: Object.keys(data) },
    });
    return NextResponse.json({ ok: true, user: updated });
  }

  if (action === "delete-user") {
    const userId = String(body.userId || "").trim();
    if (!userId) return NextResponse.json({ error: "userId gerekli" }, { status: 400 });
    if (userId === admin.id) {
      return NextResponse.json({ error: "Kendi hesabınızı silemezsiniz" }, { status: 400 });
    }
    const existing = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, name: true, phone: true },
    });
    if (!existing) return NextResponse.json({ error: "Kullanıcı bulunamadı" }, { status: 404 });
    if (existing.role === "ADMIN") {
      const adminCount = await prisma.user.count({ where: { role: "ADMIN" } });
      if (adminCount <= 1) {
        return NextResponse.json({ error: "Son yönetici silinemez" }, { status: 400 });
      }
    }
    await prisma.user.delete({ where: { id: userId } });
    await writeAuditLog({
      tenantId: tenant.id,
      actorId: admin.id,
      action: "user.delete",
      entity: "User",
      entityId: userId,
      meta: { name: existing.name, phone: existing.phone },
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "approve-commercial-user" || action === "reject-commercial-user") {
    const userId = String(body.userId || "");
    const note = String(body.note || "").trim() || null;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return NextResponse.json({ error: "Kullanıcı bulunamadı" }, { status: 404 });
    if (user.accountType !== "TICARI" && String(user.accountType) !== "EMLAKCI" && String(user.accountType) !== "GALERICI") {
      return NextResponse.json({ error: "Bu kullanıcı ticari üye değil" }, { status: 400 });
    }
    const approved = action === "approve-commercial-user";
    const {
      applyPendingCommercialToProfile,
      getPendingCommercialFromProfile,
    } = await import("@/data/commercialProfile");
    const hasPendingUpdate = Boolean(getPendingCommercialFromProfile(user.profile).profile);

    if (approved) {
      const applied = applyPendingCommercialToProfile(user.profile);
      await prisma.user.update({
        where: { id: userId },
        data: {
          commercialStatus: "APPROVED",
          commercialReviewedAt: new Date(),
          commercialReviewNote: note,
          isActive: true,
          accountType: "TICARI",
          profile: applied.profile as object,
          ...(applied.subtypes !== null ? { commercialSubtypes: applied.subtypes } : {}),
        },
      });
      const { syncShopNameFromUserProfile } = await import("@/core/services/tenantService");
      await syncShopNameFromUserProfile(userId);
    } else if (hasPendingUpdate) {
      // Onaylı üyenin güncelleme talebi reddedildi → canlı bilgiler kalsın, PENDING kalksın
      const base =
        user.profile && typeof user.profile === "object" && !Array.isArray(user.profile)
          ? { ...(user.profile as Record<string, unknown>) }
          : {};
      delete base._pendingCommercial;
      delete base._pendingSubtypes;
      await prisma.user.update({
        where: { id: userId },
        data: {
          commercialStatus: "APPROVED",
          commercialReviewedAt: new Date(),
          commercialReviewNote: note || "Güncelleme talebi reddedildi",
          isActive: true,
          accountType: "TICARI",
          profile: base as object,
        },
      });
    } else {
      await prisma.user.update({
        where: { id: userId },
        data: {
          commercialStatus: "REJECTED",
          commercialReviewedAt: new Date(),
          commercialReviewNote: note,
          isActive: false,
          accountType: "TICARI",
        },
      });
    }
    await writeAuditLog({
      tenantId: tenant.id,
      actorId: admin.id,
      action: approved ? "commercial.approve" : "commercial.reject",
      entity: "User",
      entityId: userId,
      meta: { note },
    });
    const { sendCommercialApprovalNotify } = await import("@/core/services/commercialNotifyService");
    await sendCommercialApprovalNotify(userId, approved ? "approved" : "rejected", note);
    return NextResponse.json({
      ok: true,
      message: approved ? "Ticari üye onaylandı — bildirim gönderildi/simüle edildi" : "Başvuru reddedildi",
    });
  }

  if (action === "set-commercial-premium") {
    const userId = String(body.userId || "");
    const isPremiumSeller = Boolean(body.isPremiumSeller);
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return NextResponse.json({ error: "Kullanıcı bulunamadı" }, { status: 404 });
    await prisma.user.update({
      where: { id: userId },
      data: {
        isPremiumSeller,
        premiumSellerUntil: body.premiumSellerUntil
          ? new Date(String(body.premiumSellerUntil))
          : null,
      },
    });
    await writeAuditLog({
      tenantId: tenant.id,
      actorId: admin.id,
      action: "commercial.premium",
      entity: "User",
      entityId: userId,
      meta: { isPremiumSeller },
    });
    return NextResponse.json({
      ok: true,
      message: isPremiumSeller ? "Premium üye rozeti açıldı" : "Premium üye rozeti kapatıldı",
    });
  }

  if (action === "approve-seller-review" || action === "reject-seller-review") {
    try {
      const { moderateSellerReview } = await import("@/core/services/sellerReviewService");
      await moderateSellerReview({
        reviewId: String(body.reviewId || ""),
        adminId: admin.id,
        approve: action === "approve-seller-review",
        reason: body.reason || null,
        tenantId: tenant.id,
      });
      return NextResponse.json({
        ok: true,
        message: action === "approve-seller-review" ? "Yorum onaylandı" : "Yorum reddedildi",
      });
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "İşlem başarısız" },
        { status: 400 }
      );
    }
  }

  if (action === "set-listing-status") {
    const listingId = String(body.listingId || "");
    const nextStatus = body.status as ListingStatus;
    const listing = await prisma.listing.findUnique({ where: { id: listingId } });
    if (!listing) return NextResponse.json({ error: "İlan bulunamadı" }, { status: 404 });

    // Yayına alma: onay akışı gibi süre başlat (aksi halde sayaç görünmez)
    if (
      (nextStatus === ListingStatus.ACTIVE || nextStatus === ListingStatus.SELECTION) &&
      !listing.endsAt
    ) {
      const days = Math.max(1, listing.durationDays || 7);
      const startsAt = listing.startsAt || new Date();
      const endsAt = new Date(startsAt.getTime() + days * 24 * 60 * 60 * 1000);
      await prisma.listing.update({
        where: { id: listingId },
        data: {
          status: nextStatus,
          startsAt,
          endsAt,
          rejectionReason: null,
          reviewedAt: listing.reviewedAt || new Date(),
          reviewedById: listing.reviewedById || admin.id,
        },
      });
    } else {
      await prisma.listing.update({
        where: { id: listingId },
        data: { status: nextStatus },
      });
    }

    await writeAuditLog({
      tenantId: tenant.id,
      actorId: admin.id,
      action: "listing.setStatus",
      entity: "Listing",
      entityId: listingId,
      meta: { status: nextStatus },
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "set-listing-duration") {
    const listingId = String(body.listingId || "");
    const listing = await prisma.listing.findUnique({ where: { id: listingId } });
    if (!listing) return NextResponse.json({ error: "İlan bulunamadı" }, { status: 404 });

    let endsAt: Date;
    if (body.endsAt) {
      endsAt = new Date(body.endsAt);
      if (Number.isNaN(endsAt.getTime())) {
        return NextResponse.json({ error: "Geçersiz bitiş tarihi" }, { status: 400 });
      }
    } else {
      const days = Math.max(0, Number(body.days || 0));
      const hours = Math.max(0, Number(body.hours || 0));
      const minutes = Math.max(0, Number(body.minutes || 0));
      const totalMs = ((days * 24 + hours) * 60 + minutes) * 60 * 1000;
      if (totalMs <= 0) {
        return NextResponse.json({ error: "Süre 0'dan büyük olmalıdır" }, { status: 400 });
      }
      endsAt = new Date(Date.now() + totalMs);
    }

    const durationDays = Math.max(
      1,
      Math.ceil((endsAt.getTime() - (listing.startsAt?.getTime() || Date.now())) / (24 * 60 * 60 * 1000))
    );

    const updated = await prisma.listing.update({
      where: { id: listingId },
      data: {
        endsAt,
        durationDays,
        ...(listing.status === ListingStatus.EXPIRED || listing.status === ListingStatus.ARCHIVED
          ? { status: ListingStatus.ACTIVE, selectionEndsAt: null }
          : {}),
      },
    });

    await writeAuditLog({
      tenantId: tenant.id,
      actorId: admin.id,
      action: "listing.setDuration",
      entity: "Listing",
      entityId: listingId,
      meta: { endsAt, durationDays, title: listing.title },
    });

    return NextResponse.json({
      ok: true,
      endsAt: updated.endsAt,
      durationDays: updated.durationDays,
    });
  }

  if (action === "delete-listing") {
    const listingId = String(body.listingId || "");
    const listing = await prisma.listing.findUnique({ where: { id: listingId } });
    if (!listing) return NextResponse.json({ error: "İlan bulunamadı" }, { status: 404 });
    if (listing.status === ListingStatus.APPROVED) {
      return NextResponse.json({ error: "Sonuçlanan ilanlar silinemez" }, { status: 403 });
    }
    await prisma.listing.update({
      where: { id: listingId },
      data: { approvedBidId: null },
    });
    await prisma.listing.delete({ where: { id: listingId } });
    await writeAuditLog({
      tenantId: tenant.id,
      actorId: admin.id,
      action: "listing.delete",
      entity: "Listing",
      entityId: listingId,
      meta: { title: listing.title, status: listing.status },
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "approve-listing") {
    try {
      await approveListing(String(body.listingId), admin.id, tenant.id);
      return NextResponse.json({ ok: true });
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Onay başarısız" },
        { status: 400 }
      );
    }
  }

  if (action === "bulk-approve-listings") {
    const listingIds = Array.isArray(body.listingIds)
      ? body.listingIds.map((id: unknown) => String(id || "")).filter(Boolean)
      : [];
    if (!listingIds.length) {
      return NextResponse.json({ error: "Onaylanacak ilan seçilmedi" }, { status: 400 });
    }
    const approved: string[] = [];
    const failed: Array<{ id: string; error: string }> = [];
    for (const listingId of listingIds) {
      try {
        await approveListing(listingId, admin.id, tenant.id);
        approved.push(listingId);
      } catch (e) {
        failed.push({
          id: listingId,
          error: e instanceof Error ? e.message : "Onay başarısız",
        });
      }
    }
    return NextResponse.json({
      ok: failed.length === 0,
      approved: approved.length,
      failed,
    });
  }

  if (action === "reject-listing") {
    try {
      await rejectListing(String(body.listingId), admin.id, String(body.reason || ""), tenant.id);
      return NextResponse.json({ ok: true });
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Red başarısız" },
        { status: 400 }
      );
    }
  }

  if (action === "approve-extension") {
    try {
      await approveListingExtension(String(body.requestId), admin.id, tenant.id);
      return NextResponse.json({ ok: true });
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Onay başarısız" },
        { status: 400 }
      );
    }
  }

  if (action === "reject-extension") {
    try {
      await rejectListingExtension(
        String(body.requestId),
        admin.id,
        String(body.reason || ""),
        tenant.id
      );
      return NextResponse.json({ ok: true });
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Red başarısız" },
        { status: 400 }
      );
    }
  }

  if (action === "approve-edit") {
    try {
      await approveListingEditRequest(String(body.requestId), admin.id, tenant.id);
      return NextResponse.json({ ok: true });
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Onay başarısız" },
        { status: 400 }
      );
    }
  }

  if (action === "reject-edit") {
    try {
      await rejectListingEditRequest(
        String(body.requestId),
        admin.id,
        String(body.reason || ""),
        tenant.id
      );
      return NextResponse.json({ ok: true });
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Red başarısız" },
        { status: 400 }
      );
    }
  }

  if (action === "approve-bulk-listing-update") {
    try {
      await approveBulkListingUpdate(String(body.requestId), admin.id, tenant.id);
      return NextResponse.json({ ok: true, message: "Toplu güncelleme onaylandı" });
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Onay başarısız" },
        { status: 400 }
      );
    }
  }

  if (action === "reject-bulk-listing-update") {
    try {
      await rejectBulkListingUpdate(
        String(body.requestId),
        admin.id,
        String(body.reason || ""),
        tenant.id
      );
      return NextResponse.json({ ok: true, message: "Toplu güncelleme reddedildi" });
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Red başarısız" },
        { status: 400 }
      );
    }
  }

  if (action === "resolve-seller-request") {
    try {
      await resolveSellerAdminRequest(String(body.requestId), admin.id, tenant.id);
      return NextResponse.json({ ok: true });
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "İşlem başarısız" },
        { status: 400 }
      );
    }
  }

  if (action === "grant-seller-edit-fields") {
    try {
      await grantSellerEditFields({
        requestId: String(body.requestId),
        adminId: admin.id,
        fields: Array.isArray(body.fields) ? body.fields.map(String) : [],
        adminNote: body.adminNote ? String(body.adminNote) : "",
        tenantId: tenant.id,
      });
      return NextResponse.json({ ok: true });
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "İzin verilemedi" },
        { status: 400 }
      );
    }
  }

  if (action === "approve-seller-edit") {
    try {
      await approveGrantedListingEdit({
        requestId: String(body.requestId),
        adminId: admin.id,
        tenantId: tenant.id,
      });
      return NextResponse.json({ ok: true });
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Onay başarısız" },
        { status: 400 }
      );
    }
  }

  if (action === "reject-seller-edit") {
    try {
      await rejectGrantedListingEdit({
        requestId: String(body.requestId),
        adminId: admin.id,
        reason: String(body.reason || ""),
        tenantId: tenant.id,
      });
      return NextResponse.json({ ok: true });
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Red başarısız" },
        { status: 400 }
      );
    }
  }

  if (action === "save-browse-nav-config") {
    const map = await getSettingsMap(true);
    const current = normalizeBrowseNavConfig(map.browse_nav_config);
    const next = {
      hideEmptyUntilListing: current.hideEmptyUntilListing,
      sahibindenTreeExpand: current.sahibindenTreeExpand,
      nodes: { ...current.nodes },
    };

    if (typeof body.hideEmptyUntilListing === "boolean") {
      next.hideEmptyUntilListing = body.hideEmptyUntilListing;
    }
    if (typeof body.sahibindenTreeExpand === "boolean") {
      next.sahibindenTreeExpand = body.sahibindenTreeExpand;
    }

    const nodeKey = body.nodeKey != null ? String(body.nodeKey).trim() : "";
    if (nodeKey) {
      const prev = next.nodes[nodeKey] || {};
      const patch: { active?: boolean; sortOrder?: number; label?: string } = { ...prev };
      if (typeof body.active === "boolean") patch.active = body.active;
      if (body.sortOrder !== undefined && body.sortOrder !== null && body.sortOrder !== "") {
        const n = Number(body.sortOrder);
        if (Number.isFinite(n)) patch.sortOrder = n;
      }
      if (body.label !== undefined) {
        const label = String(body.label ?? "").trim();
        if (label) patch.label = label;
        else delete patch.label;
      }
      // Boş kayıt bırakma
      if (patch.active === undefined && patch.sortOrder === undefined && patch.label === undefined) {
        delete next.nodes[nodeKey];
      } else {
        next.nodes[nodeKey] = patch;
      }
    }

    await setSetting("browse_nav_config", next);

    // hideEmptyUntilListing checked ⇒ show_empty = false (hepsi birlikte)
    const showEmpty = !next.hideEmptyUntilListing;
    await setSetting("category_nav_show_empty", showEmpty);
    await setSetting("vehicle_nav_show_empty_brands", showEmpty);
    await setSetting("vehicle_nav_show_empty_models", showEmpty);
    // trims varsayılan kapalı kalır; hide kapalıysa (göster) yine de trims'i açma

    invalidateSettingsCache();
    invalidateFacetCache();

    await writeAuditLog({
      tenantId: tenant.id,
      actorId: admin.id,
      action: "browse_nav_config.save",
      entity: "SystemSetting",
      meta: {
        hideEmptyUntilListing: next.hideEmptyUntilListing,
        nodeKey: nodeKey || undefined,
        active: typeof body.active === "boolean" ? body.active : undefined,
        sortOrder: body.sortOrder,
        label: body.label !== undefined ? String(body.label ?? "").trim() || null : undefined,
      },
    });

    return NextResponse.json({ ok: true, config: next });
  }

  if (action === "toggle-category") {
    await prisma.category.update({
      where: { id: body.id },
      data: { isActive: Boolean(body.isActive) },
    });
    invalidateFacetCache();
    await writeAuditLog({
      tenantId: tenant.id,
      actorId: admin.id,
      action: "category.toggle",
      entity: "Category",
      entityId: body.id,
      meta: { isActive: Boolean(body.isActive) },
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "save-category") {
    const data = {
      name: String(body.name || "").trim(),
      slug: String(body.slug || "").trim(),
      icon: body.icon ? String(body.icon) : null,
      sortOrder: Number(body.sortOrder || 0),
      isActive: body.isActive !== undefined ? Boolean(body.isActive) : true,
    };
    if (!data.name || !data.slug) {
      return NextResponse.json({ error: "İsim ve slug zorunlu" }, { status: 400 });
    }

    let categoryId = body.id as string | undefined;
    if (categoryId) {
      await prisma.category.update({ where: { id: categoryId }, data });
    } else {
      const created = await prisma.category.create({ data });
      categoryId = created.id;
    }

    await writeAuditLog({
      tenantId: tenant.id,
      actorId: admin.id,
      action: body.id ? "category.update" : "category.create",
      entity: "Category",
      entityId: categoryId,
      meta: { slug: data.slug, name: data.name },
    });
    return NextResponse.json({ ok: true, id: categoryId });
  }

  if (action === "delete-category") {
    const id = String(body.id || "");
    if (!id) return NextResponse.json({ error: "id gerekli" }, { status: 400 });

    const listingCount = await prisma.listing.count({ where: { categoryId: id } });
    if (listingCount > 0) {
      return NextResponse.json(
        { error: "Kategoriye bağlı ilanlar var, silinemez", listingCount },
        { status: 400 },
      );
    }

    await prisma.category.delete({ where: { id } });
    await writeAuditLog({
      tenantId: tenant.id,
      actorId: admin.id,
      action: "category.delete",
      entity: "Category",
      entityId: id,
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "save-content") {
    const slug = String(body.slug || "").trim();
    const title = String(body.title || "").trim();
    const contentBody = String(body.body || "");
    const kindRaw = String(body.kind || "PAGE").toUpperCase();
    const allowedKinds = ["PAGE", "HELP", "BANNER", "FAQ", "PROMO"];
    if (!slug || !title) {
      return NextResponse.json({ error: "slug ve title zorunlu" }, { status: 400 });
    }
    if (!allowedKinds.includes(kindRaw)) {
      return NextResponse.json({ error: "Geçersiz içerik türü" }, { status: 400 });
    }

    const isPublished = Boolean(body.isPublished);
    const sortOrder = Number(body.sortOrder || 0);
    let contentId = body.id as string | undefined;

    // PROMO enum eski Prisma client'ta olmayabilir → ham SQL
    if (kindRaw === "PROMO") {
      if (contentId) {
        await prisma.$executeRaw`
          UPDATE "ContentPage"
          SET slug = ${slug},
              title = ${title},
              body = ${contentBody},
              kind = CAST(${"PROMO"} AS "ContentKind"),
              "isPublished" = ${isPublished},
              "sortOrder" = ${sortOrder},
              "authorId" = ${admin.id},
              "updatedAt" = NOW()
          WHERE id = ${contentId}
        `;
      } else {
        const { randomBytes } = await import("crypto");
        contentId = `c${randomBytes(12).toString("hex")}`;
        await prisma.$executeRaw`
          INSERT INTO "ContentPage" (id, "tenantId", slug, title, body, kind, "isPublished", "sortOrder", "authorId", "createdAt", "updatedAt")
          VALUES (
            ${contentId},
            ${tenant.id},
            ${slug},
            ${title},
            ${contentBody},
            CAST(${"PROMO"} AS "ContentKind"),
            ${isPublished},
            ${sortOrder},
            ${admin.id},
            NOW(),
            NOW()
          )
        `;
      }
      await writeAuditLog({
        tenantId: tenant.id,
        actorId: admin.id,
        action: body.id ? "content.update" : "content.create",
        entity: "ContentPage",
        entityId: contentId,
        meta: { kind: "PROMO", slug },
      });
      return NextResponse.json({ ok: true, id: contentId });
    }

    const kind = kindRaw as ContentKind;
    const data = {
      slug,
      title,
      body: contentBody,
      kind,
      isPublished,
      sortOrder,
      authorId: admin.id,
      tenantId: tenant.id,
    };

    if (contentId) {
      await prisma.contentPage.update({
        where: { id: contentId },
        data: {
          slug: data.slug,
          title: data.title,
          body: data.body,
          kind: data.kind,
          isPublished: data.isPublished,
          sortOrder: data.sortOrder,
          authorId: admin.id,
        },
      });
    } else {
      const created = await prisma.contentPage.create({ data });
      contentId = created.id;
    }

    await writeAuditLog({
      tenantId: tenant.id,
      actorId: admin.id,
      action: body.id ? "content.update" : "content.create",
      entity: "ContentPage",
      entityId: contentId,
      meta: { slug, kind },
    });
    return NextResponse.json({ ok: true, id: contentId });
  }

  if (action === "delete-content") {
    const id = String(body.id || "");
    if (!id) return NextResponse.json({ error: "id gerekli" }, { status: 400 });

    await prisma.contentPage.delete({ where: { id } });
    await writeAuditLog({
      tenantId: tenant.id,
      actorId: admin.id,
      action: "content.delete",
      entity: "ContentPage",
      entityId: id,
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "assign-shop-subscription") {
    const userId = String(body.userId || "");
    const packageId = String(body.packageId || "");
    const note = String(body.note || "").trim();

    if (!userId || !packageId) {
      return NextResponse.json({ error: "userId ve packageId zorunlu" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return NextResponse.json({ error: "Kullanıcı bulunamadı" }, { status: 404 });

    const pkg = await prisma.shopPackage.findUnique({ where: { id: packageId } });
    if (!pkg) return NextResponse.json({ error: "Paket bulunamadı" }, { status: 404 });

    let shopId: string | null = null;
    const { isCorporateAccount } = await import("@/lib/accountTypes");
    if (isCorporateAccount(user.accountType)) {
      const { shop } = await ensureUserShop(userId);
      shopId = shop?.id || null;
    }

    const existing = await prisma.shopSubscription.findUnique({
      where: { userId },
      include: { package: true },
    });
    const hadActive =
      Boolean(existing) &&
      existing!.isActive &&
      existing!.endsAt > new Date();

    const now = new Date();
    const { calcPackagePurchase } = await import("@/lib/shopPackageBilling");
    const calc = calcPackagePurchase({
      billingType: pkg.billingType,
      unitPriceTl: Number(pkg.monthlyPrice) || 0,
      months: body.months,
      days: body.days,
      years: body.years,
      minDays: pkg.minDays,
      maxDays: pkg.maxDays,
      from: now,
    });

    const subscription = await prisma.shopSubscription.upsert({
      where: { userId },
      create: {
        userId,
        shopId,
        packageId,
        startsAt: now,
        endsAt: calc.endsAt,
        isActive: true,
      },
      update: {
        shopId,
        packageId,
        startsAt: now,
        endsAt: calc.endsAt,
        isActive: true,
      },
      include: { package: true, shop: true },
    });

    await writeAuditLog({
      tenantId: tenant.id,
      actorId: admin.id,
      action: hadActive ? "shopSubscription.change" : "shopSubscription.assign",
      entity: "ShopSubscription",
      entityId: subscription.id,
      meta: {
        userId,
        packageId,
        shopId,
        billingType: calc.billingType,
        months: calc.months || null,
        days: calc.days || null,
        years: calc.years || null,
        previousPackageId: existing?.packageId || null,
        note: note || null,
      },
    });

    const { recordShopSubscriptionPayment } = await import("@/core/services/revenueService");
    if (calc.amountTl > 0) {
      await recordShopSubscriptionPayment({
        userId,
        tenantId: tenant.id,
        amountTl: calc.amountTl,
        packageId,
        months:
          calc.months ||
          (calc.years || 0) * 12 ||
          Math.max(1, Math.ceil((calc.days || 1) / 30)),
        subscriptionId: subscription.id,
        accountType: String(user.accountType),
        simulatedBy: admin.id,
      });
    }

    const { notifyUser } = await import("@/core/notify");
    const endsLabel = calc.endsAt.toLocaleDateString("tr-TR");
    const periodLabel =
      calc.billingType === "DAILY"
        ? `${calc.days} gün · ${pkg.listingLimit} ilan hakkı`
        : calc.billingType === "YEARLY"
          ? `${calc.years} yıl · ${pkg.listingLimit} ilan / dönem`
          : `${calc.months} ay · ${pkg.listingLimit} ilan / dönem`;
    if (hadActive) {
      const prevName = existing?.package?.name || "önceki paket";
      await notifyUser(userId, {
        eventKey: "shop_package_changed",
        title: "Paketiniz güncellendi",
        body: `Paketiniz «${prevName}» yerine «${pkg.name}» olarak değiştirildi (${periodLabel}). Bitiş: ${endsLabel}.${
          note ? ` Not: ${note}` : ""
        }`,
        link: "/hesabim?s=ozet",
      });
    } else {
      await notifyUser(userId, {
        eventKey: "shop_package_assigned",
        title: "Paket tanımlandı",
        body: `Hesabınıza «${pkg.name}» paketi tanımlandı (${periodLabel}). Bitiş: ${endsLabel}.${
          note ? ` Not: ${note}` : ""
        }`,
        link: "/hesabim?s=ozet",
      });
    }

    return NextResponse.json({
      ok: true,
      subscription,
      amountTl: calc.amountTl,
      changed: hadActive,
    });
  }

  if (action === "cancel-shop-subscription") {
    const userId = String(body.userId || "");
    const shopId = String(body.shopId || "");
    const note = String(body.note || "").trim();

    if (!userId && !shopId) {
      return NextResponse.json({ error: "userId veya shopId gerekli" }, { status: 400 });
    }

    const sub = userId
      ? await prisma.shopSubscription.findUnique({
          where: { userId },
          include: { package: true, user: { select: { id: true, name: true } } },
        })
      : await prisma.shopSubscription.findUnique({
          where: { shopId },
          include: { package: true, user: { select: { id: true, name: true } } },
        });

    if (!sub) {
      return NextResponse.json({ error: "Aktif abonelik bulunamadı" }, { status: 404 });
    }

    const updated = await prisma.shopSubscription.update({
      where: { id: sub.id },
      data: {
        isActive: false,
        endsAt: new Date(),
      },
      include: { package: true },
    });

    await writeAuditLog({
      tenantId: tenant.id,
      actorId: admin.id,
      action: "shopSubscription.cancel",
      entity: "ShopSubscription",
      entityId: sub.id,
      meta: {
        userId: sub.userId,
        shopId: sub.shopId,
        packageId: sub.packageId,
        packageName: sub.package?.name || null,
        note: note || null,
      },
    });

    const { notifyUser } = await import("@/core/notify");
    const pkgName = sub.package?.name || "kurumsal paket";
    await notifyUser(sub.userId, {
      eventKey: "shop_package_cancelled",
      title: "Kurumsal paketiniz iptal edildi",
      body: `Kullanım sözleşmesi gereği «${pkgName}» paket aboneliğiniz yönetici tarafından iptal edilmiştir. İlan verme hakkınız paket yenilenene kadar durur.${
        note ? ` Açıklama: ${note}` : ""
      }`,
      link: "/hesabim?s=ozet",
    });

    return NextResponse.json({ ok: true, subscription: updated });
  }

  if (action === "set-bid-status") {
    const bidId = String(body.bidId || "");
    const status = body.status as BidStatus;
    if (!bidId || !status) {
      return NextResponse.json({ error: "bidId ve status zorunlu" }, { status: 400 });
    }
    if (!Object.values(BidStatus).includes(status)) {
      return NextResponse.json({ error: "Geçersiz teklif durumu" }, { status: 400 });
    }

    await prisma.bid.update({
      where: { id: bidId },
      data: { status },
    });

    await writeAuditLog({
      tenantId: tenant.id,
      actorId: admin.id,
      action: "bid.setStatus",
      entity: "Bid",
      entityId: bidId,
      meta: { status },
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "mark-message-read") {
    const messageId = String(body.messageId || "");
    if (!messageId) {
      return NextResponse.json({ error: "messageId zorunlu" }, { status: 400 });
    }
    const isRead = body.isRead !== undefined ? Boolean(body.isRead) : true;

    await prisma.message.update({
      where: { id: messageId },
      data: { isRead },
    });

    await writeAuditLog({
      tenantId: tenant.id,
      actorId: admin.id,
      action: "message.markRead",
      entity: "Message",
      entityId: messageId,
      meta: { isRead },
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "save-revenue-finance") {
    const {
      REVENUE_FINANCE_SETTING_KEY,
      normalizeRevenueFinance,
    } = await import("@/lib/revenueFinance");
    const finance = normalizeRevenueFinance(body.finance);
    await setSetting(REVENUE_FINANCE_SETTING_KEY, finance);
    invalidateSettingsCache();
    await writeAuditLog({
      tenantId: tenant.id,
      actorId: admin.id,
      action: "revenue.finance.save",
      entity: "SystemSetting",
      entityId: REVENUE_FINANCE_SETTING_KEY,
      meta: finance as object,
    });
    return NextResponse.json({ ok: true, finance });
  }

  if (action === "add-revenue-expense") {
    const {
      REVENUE_EXPENSES_SETTING_KEY,
      normalizeRevenueExpenses,
      EXPENSE_CATEGORIES,
      buildExpenseRow,
    } = await import("@/lib/revenueFinance");
    const title = String(body.title || "").trim();
    const amountTl = Number(body.amountTl);
    if (!title || !Number.isFinite(amountTl) || amountTl < 0) {
      return NextResponse.json({ error: "Başlık ve tutar gerekli" }, { status: 400 });
    }
    const cat = String(body.category || "DIGER").toUpperCase();
    const allowed = new Set(EXPENSE_CATEGORIES.map((c) => c.value));
    const category = allowed.has(cat as (typeof EXPENSE_CATEGORIES)[number]["value"])
      ? cat
      : "DIGER";
    const spentAt = body.spentAt ? new Date(String(body.spentAt)) : new Date();
    const row = buildExpenseRow({
      title,
      amountTl,
      vatPercent: Number(body.vatPercent ?? 20),
      amountIncludesVat: body.amountIncludesVat !== false,
      category,
      note: String(body.note || "").trim(),
      spentAt: (Number.isNaN(spentAt.getTime()) ? new Date() : spentAt).toISOString(),
    });
    const existing = normalizeRevenueExpenses(await getSetting(REVENUE_EXPENSES_SETTING_KEY, []));
    const next = [row, ...existing].slice(0, 500);
    await setSetting(REVENUE_EXPENSES_SETTING_KEY, next);
    invalidateSettingsCache();
    await writeAuditLog({
      tenantId: tenant.id,
      actorId: admin.id,
      action: "revenue.expense.add",
      entity: "Expense",
      entityId: row.id,
      meta: { title: row.title, amountTl: row.amountTl, vatTl: row.vatTl },
    });
    return NextResponse.json({ ok: true, expense: row });
  }

  if (action === "delete-revenue-expense") {
    const {
      REVENUE_EXPENSES_SETTING_KEY,
      normalizeRevenueExpenses,
    } = await import("@/lib/revenueFinance");
    const id = String(body.id || "").trim();
    if (!id) return NextResponse.json({ error: "id gerekli" }, { status: 400 });
    const existing = normalizeRevenueExpenses(await getSetting(REVENUE_EXPENSES_SETTING_KEY, []));
    const next = existing.filter((e) => e.id !== id);
    await setSetting(REVENUE_EXPENSES_SETTING_KEY, next);
    invalidateSettingsCache();
    await writeAuditLog({
      tenantId: tenant.id,
      actorId: admin.id,
      action: "revenue.expense.delete",
      entity: "Expense",
      entityId: id,
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "simulate-payment") {
    const userId = String(body.userId || "");
    const amountTl = Number(body.amountTl);
    const purpose = String(body.purpose || "manual");
    const tokenAmount = Number(body.tokenAmount || 0);

    if (!userId || !Number.isFinite(amountTl) || amountTl < 0) {
      return NextResponse.json({ error: "userId ve amountTl zorunlu" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return NextResponse.json({ error: "Kullanıcı bulunamadı" }, { status: 404 });

    const result = await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          tenantId: tenant.id,
          userId,
          amountTl: Math.round(amountTl),
          purpose,
          status: PaymentStatus.SIMULATED,
          meta: {
            simulatedBy: admin.id,
            tokenAmount: purpose === "token_purchase" ? tokenAmount : undefined,
          },
        },
      });

      let balance = user.tokenBalance;
      if (purpose === "token_purchase" && tokenAmount > 0) {
        const updated = await tx.user.update({
          where: { id: userId },
          data: { tokenBalance: { increment: tokenAmount } },
        });
        balance = updated.tokenBalance;
        await tx.tokenLedger.create({
          data: {
            userId,
            delta: tokenAmount,
            balanceAfter: balance,
            reason: "admin_simulate_purchase",
            meta: { paymentId: payment.id, amountTl },
          },
        });
      }

      return { payment, balance };
    });

    await writeAuditLog({
      tenantId: tenant.id,
      actorId: admin.id,
      action: "payment.simulate",
      entity: "Payment",
      entityId: result.payment.id,
      meta: { userId, amountTl, purpose, tokenAmount },
    });

    return NextResponse.json({
      ok: true,
      payment: result.payment,
      tokenBalance: result.balance,
    });
  }

  if (action === "preview-payment-delete") {
    const paymentId = String(body.paymentId || "");
    if (!paymentId) {
      return NextResponse.json({ error: "paymentId zorunlu" }, { status: 400 });
    }
    const { previewPaymentDelete } = await import("@/core/services/paymentDeleteService");
    const preview = await previewPaymentDelete(paymentId);
    if (!preview.canDelete) {
      return NextResponse.json({ error: preview.error || "Önizleme başarısız" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, effects: preview.effects });
  }

  if (action === "delete-payment") {
    const paymentId = String(body.paymentId || "");
    if (!paymentId) {
      return NextResponse.json({ error: "paymentId zorunlu" }, { status: 400 });
    }
    try {
      const { deletePaymentCascade } = await import("@/core/services/paymentDeleteService");
      const result = await deletePaymentCascade({
        paymentId,
        adminId: admin.id,
        tenantId: tenant.id,
      });
      return NextResponse.json(result);
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Ödeme silinemedi" },
        { status: 400 }
      );
    }
  }

  if (action === "list-escrow") {
    const deals = await listEscrowDeals({
      status: body.status ? String(body.status) : undefined,
      listingId: body.listingId ? String(body.listingId) : undefined,
      buyerId: body.buyerId ? String(body.buyerId) : undefined,
      sellerId: body.sellerId ? String(body.sellerId) : undefined,
      q: body.q ? String(body.q) : undefined,
      take: body.take ? Number(body.take) : undefined,
    });
    return NextResponse.json({
      deals: deals.map((d) => ({
        ...d,
        listing: d.listing ? { ...d.listing, askPrice: Number(d.listing.askPrice) } : d.listing,
      })),
    });
  }

  if (action === "escrow-pool-summary") {
    const [summary, settings] = await Promise.all([
      getEscrowPoolSummary(),
      getEscrowRuntimeSettings(),
    ]);
    return NextResponse.json({
      summary,
      pool: {
        name: settings.poolName,
        iban: settings.poolIban,
        bank: settings.poolBank,
      },
    });
  }

  if (action === "escrow-release") {
    try {
      const deal = await adminRelease(String(body.dealId || ""), admin.id, body.note || null);
      return NextResponse.json({ ok: true, deal });
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "İşlem başarısız" },
        { status: 400 }
      );
    }
  }

  if (action === "escrow-refund") {
    try {
      const deal = await adminRefund(String(body.dealId || ""), admin.id, body.note || null);
      return NextResponse.json({ ok: true, deal });
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "İşlem başarısız" },
        { status: 400 }
      );
    }
  }

  if (action === "escrow-dispute") {
    try {
      const deal = await adminMarkDisputed(
        String(body.dealId || ""),
        admin.id,
        body.reason || null,
        body.note || null
      );
      return NextResponse.json({ ok: true, deal });
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "İşlem başarısız" },
        { status: 400 }
      );
    }
  }

  if (action === "escrow-process-timeouts") {
    const result = await processEscrowTimeouts();
    await writeAuditLog({
      tenantId: tenant.id,
      actorId: admin.id,
      action: "escrow.process_timeouts",
      entity: "EscrowDeal",
      meta: result,
    });
    return NextResponse.json(result);
  }

  return NextResponse.json({ error: "Bilinmeyen aksiyon" }, { status: 400 });
}
