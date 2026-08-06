import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getSetting } from "@/core/settings";
import { serializeListing } from "@/lib/format";
import { ListingStatus, PaymentStatus } from "@prisma/client";
import { processExpiredListings } from "@/core/services/bidService";
import { attachEidsBadge, attachEidsBadgeMany } from "@/core/services/eidsService";
import { isListingNoQuery, normalizeListingNoQuery } from "@/lib/listingNo";
import { canSellerEditListing } from "@/lib/listingStatus";
import { shouldShowPremiumBadge } from "@/lib/listingPremiumDisplay";
import { assertEscrowModuleAvailable } from "@/core/services/escrowService";
import { resolveElectricListingAttrs } from "@/lib/vasitaElectric";

export async function GET(req: Request) {
  await processExpiredListings();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const featured = searchParams.get("featured");
  const category = searchParams.get("category");
  const q = searchParams.get("q");
  const live = searchParams.get("live");
  const city = searchParams.get("city");
  const district = searchParams.get("district");
  const neighborhood = searchParams.get("neighborhood");
  const dealType = searchParams.get("type");
  const minPrice = searchParams.get("minPrice");
  const maxPrice = searchParams.get("maxPrice");
  const subtype = searchParams.get("subtype");
  const rental = searchParams.get("rental");
  const brand = searchParams.get("brand");
  const model = searchParams.get("model");
  const trim = searchParams.get("trim");

  if (live === "1") {
    const limitN = Math.min(60, Math.max(8, Math.floor(Number(searchParams.get("limit") || 40) || 40)));
    const listingFilter: Record<string, unknown> = {};
    if (category) {
      const { resolveCategoryFilterIds } = await import("@/lib/syncCategories");
      const slugs = category.split(",").map((s) => s.trim()).filter(Boolean);
      const allIds: string[] = [];
      for (const slug of slugs) {
        const ids = await resolveCategoryFilterIds(prisma, slug);
        if (ids?.length) allIds.push(...ids);
      }
      if (allIds.length) listingFilter.categoryId = { in: [...new Set(allIds)] };
      else listingFilter.category = { slug: slugs[0] || category };
    }
    if (city) listingFilter.city = { equals: city, mode: "insensitive" };
    if (district) listingFilter.district = { equals: district, mode: "insensitive" };

    const recent = await prisma.bid.findMany({
      take: limitN,
      orderBy: { createdAt: "desc" },
      where: Object.keys(listingFilter).length ? { listing: listingFilter } : undefined,
      include: {
        listing: {
          select: {
            id: true,
            title: true,
            city: true,
            district: true,
            coverImage: true,
            askPrice: true,
            highestBid: true,
            status: true,
            category: { select: { name: true, slug: true } },
          },
        },
      },
    });

    const listingIds = [...new Set(recent.map((b) => b.listingId))];
    const history =
      listingIds.length > 0
        ? await prisma.bid.findMany({
            where: { listingId: { in: listingIds } },
            orderBy: { createdAt: "desc" },
            select: { id: true, listingId: true, amount: true, createdAt: true },
            take: Math.min(600, Math.max(listingIds.length * 12, 40)),
          })
        : [];
    const byListing = new Map<string, typeof history>();
    for (const row of history) {
      const arr = byListing.get(row.listingId) || [];
      arr.push(row);
      byListing.set(row.listingId, arr);
    }

    function previousAmount(bid: { id: string; listingId: string; createdAt: Date }) {
      const rows = byListing.get(bid.listingId) || [];
      for (const row of rows) {
        if (row.id === bid.id) continue;
        if (row.createdAt.getTime() < bid.createdAt.getTime()) return Number(row.amount);
      }
      return null;
    }

    return NextResponse.json({
      mode: "live",
      items: recent.map((b) => ({
        id: b.id,
        amount: Number(b.amount),
        previousAmount: previousAmount(b),
        createdAt: b.createdAt,
        listing: {
          ...b.listing,
          askPrice: Number(b.listing.askPrice),
          highestBid: Number(b.listing.highestBid),
        },
      })),
    });
  }

  const sold = searchParams.get("sold");
  const ending =
    searchParams.get("ending") === "1" || searchParams.get("sort") === "ending";
  const mostBids =
    searchParams.get("mostBids") === "today" || searchParams.get("mostBids") === "1";
  const forYou = searchParams.get("forYou") === "1";
  const profitSort =
    sold === "1" &&
    (searchParams.get("sort") === "profit" || searchParams.get("profit") === "1");
  /** Şerit (carousel): format=sales — tam liste /ilanlar?sold=1 ana sorguya düşer */
  if (sold === "1" && searchParams.get("format") === "sales") {
    const limitN = Math.min(24, Math.max(4, Math.floor(Number(searchParams.get("limit") || 16) || 16)));
    const rows = await prisma.listing.findMany({
      where: { status: ListingStatus.APPROVED },
      orderBy: [{ updatedAt: "desc" }],
      take: Math.min(80, Math.max(limitN * 4, 32)),
      include: {
        category: true,
        approvedBid: { select: { amount: true, createdAt: true, updatedAt: true } },
      },
    });
    const sales = rows
      .map((l) => ({
        id: l.id,
        title: l.title,
        city: l.city,
        district: l.district,
        neighborhood: l.neighborhood,
        coverImage: l.coverImage,
        askPrice: Number(l.askPrice),
        highestBid: Number(l.highestBid),
        finalPrice: l.approvedBid ? Number(l.approvedBid.amount) : Number(l.highestBid),
        soldAt: l.approvedBid?.updatedAt || l.approvedBid?.createdAt || l.updatedAt,
        category: l.category ? { name: l.category.name, slug: l.category.slug } : null,
        attributes: l.attributes,
      }))
      .sort((a, b) => new Date(b.soldAt).getTime() - new Date(a.soldAt).getTime())
      .slice(0, limitN);
    return NextResponse.json({ sales });
  }

  if (id) {
    const listing = await prisma.listing.findUnique({
      where: { id },
      include: {
        category: { include: { parent: { select: { slug: true, name: true } } } },
        seller: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            phoneVerified: true,
            memberSince: true,
            updatedAt: true,
            accountType: true,
            profile: true,
            commercialSubtypes: true,
            commercialStatus: true,
            logoUrl: true,
            isPremiumSeller: true,
            premiumSellerUntil: true,
            eidsIdentityVerifiedAt: true,
            eidsKullaniciKodu: true,
            ownedShops: { select: { id: true, name: true, slug: true }, take: 1 },
          },
        },
        approvedBid: true,
      },
    });
    if (!listing) return NextResponse.json({ error: "Yok" }, { status: 404 });

    const session = await getSession();
    const isOwner = session?.id === listing.sellerId;
    const isAdmin = session?.role === "ADMIN";
    const isPublic =
      listing.status === ListingStatus.ACTIVE ||
      listing.status === ListingStatus.SELECTION ||
      listing.status === ListingStatus.APPROVED;

    if (!isPublic && !isOwner && !isAdmin) {
      return NextResponse.json({ error: "Bu ilan henüz yayında değil" }, { status: 404 });
    }

    if (isPublic) {
      await prisma.listing.update({ where: { id }, data: { viewCount: { increment: 1 } } });
    }

    const {
      accessAllows,
      getCategoryAccessRule,
      resolveTopCategorySlug,
    } = await import("@/lib/categoryAccess");
    const { parseCommercialProfile } = await import("@/data/commercialProfile");
    const { isCorporateAccount } = await import("@/lib/accountTypes");
    const {
      memberYearsLabel,
      isPremiumSellerActive,
      getSellerReviewSettings,
    } = await import("@/core/services/sellerReviewService");

    let hasApprovedDeal = false;
    if (session && listing.approvedBidId) {
      const approved = listing.approvedBid;
      if (approved && (approved.bidderId === session.id || listing.sellerId === session.id)) {
        hasApprovedDeal = true;
      }
    }

    const topSlug = resolveTopCategorySlug(listing.category);
    const visibilityMap = await getSetting<Record<string, unknown>>(
      "seller_visibility_by_category",
      {}
    );
    const { isClassifiedMode } = await import("@/core/services/marketplaceModeService");
    const classified = await isClassifiedMode();
    const rule = classified
      ? { identity: "logged_in" as const, contact: "logged_in" as const, messaging: "logged_in" as const }
      : getCategoryAccessRule(visibilityMap, topSlug);
    const gateCtx = {
      loggedIn: Boolean(session?.id),
      hasApprovedDeal,
      isSellerOrAdmin: Boolean(isOwner || isAdmin),
    };
    const showIdentity = accessAllows(rule.identity, gateCtx);
    const showContact = accessAllows(rule.contact, gateCtx);
    const canMessageByRule = accessAllows(rule.messaging, gateCtx);

    const contactReveal = await getSetting<{ phone?: boolean; name?: boolean }>("contact_reveal", {
      phone: true,
      name: true,
    });
    const allowLiveEdit = await getSetting<boolean>("listing_edit_while_live", true);
    const canEdit = isOwner
      ? canSellerEditListing(listing.status, { allowLiveEdit: allowLiveEdit !== false })
      : false;

    const escrowCheck = await assertEscrowModuleAvailable();
    const { isBuyButtonOpen, getBuyButtonLabel } = await import("@/core/services/listingExpiryService");
    const { isAlisverisCategorySlug } = await import("@/data/classicBrowseTree");
    const shoppingListing = isAlisverisCategorySlug(listing.category?.slug);
    const buyOpen = await isBuyButtonOpen({
      status: listing.status,
      endsAt: listing.endsAt,
      escrowEligible: listing.escrowEligible,
      forceEligible: shoppingListing,
    });
    const escrowAvailable = escrowCheck.allowed && buyOpen;
    const buyLabel = await getBuyButtonLabel();
    const escrowSettings = escrowCheck.allowed
      ? {
          buttonLabel: buyLabel || escrowCheck.settings.buttonLabel,
          shipDaysOptions: escrowCheck.settings.shipDaysOptions,
          defaultShipDays: escrowCheck.settings.defaultShipDays,
          requireSellerIban: shoppingListing ? false : escrowCheck.settings.requireSellerIban,
          commissionPercent: escrowCheck.settings.commissionPercent,
        }
      : null;

    const serialized = serializeListing(listing);
    const { approvedBid, seller: _seller, category: _cat, ...listingRest } = serialized as typeof serialized & {
      approvedBid?: { id: string; bidderId: string; amount: bigint | number; status: string } | null;
      seller?: unknown;
      category?: unknown;
    };

    let isFavorited = false;
    let isSellerFavorited = false;
    if (session?.id) {
      const [fav, sellerFav] = await Promise.all([
        prisma.favorite.findUnique({
          where: { userId_listingId: { userId: session.id, listingId: listing.id } },
          select: { id: true },
        }),
        prisma.favoriteSeller.findUnique({
          where: {
            userId_sellerId: { userId: session.id, sellerId: listing.sellerId },
          },
          select: { id: true },
        }),
      ]);
      isFavorited = Boolean(fav);
      isSellerFavorited = Boolean(sellerFav);
    }

    const commercial = parseCommercialProfile(listing.seller.profile);
    const isCommercial = isCorporateAccount(listing.seller.accountType);
    const showName = showIdentity && contactReveal.name !== false;
    const showPhone = showContact && contactReveal.phone !== false;

    const { EditRequestStatus, BidStatus } = await import("@prisma/client");
    const [showPremiumBadge, showYearsBadge, showPremiumStoreBadge, reviewSettings, reviewAgg, sellerListingStats, bidDecisionStats, lastListingActivity] =
      await Promise.all([
        getSetting<boolean>("commercial_premium_badge_enabled", true),
        getSetting<boolean>("commercial_member_years_badge_enabled", true),
        getSetting<boolean>("premium_store_badge_enabled", true),
        getSellerReviewSettings(),
        isCommercial
          ? prisma.sellerReview.aggregate({
              where: {
                sellerId: listing.sellerId,
                status: EditRequestStatus.APPROVED,
              },
              _count: { _all: true },
              _avg: { rating: true },
            })
          : Promise.resolve({ _count: { _all: 0 }, _avg: { rating: null } }),
        isCommercial
          ? prisma.listing.groupBy({
              by: ["status"],
              where: {
                sellerId: listing.sellerId,
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
            })
          : Promise.resolve([] as Array<{ status: string; _count: { _all: number } }>),
        isCommercial
          ? prisma.bid.groupBy({
              by: ["status"],
              where: {
                listing: { sellerId: listing.sellerId },
                status: { in: [BidStatus.APPROVED, BidStatus.REJECTED] },
              },
              _count: { _all: true },
            })
          : Promise.resolve([] as Array<{ status: string; _count: { _all: number } }>),
        isCommercial
          ? prisma.listing.findFirst({
              where: { sellerId: listing.sellerId },
              orderBy: { updatedAt: "desc" },
              select: { updatedAt: true },
            })
          : Promise.resolve(null),
      ]);

    const premiumActive = isPremiumSellerActive(listing.seller);

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

    const lastActiveAt = (() => {
      const a = listing.seller.updatedAt ? new Date(listing.seller.updatedAt).getTime() : 0;
      const b = lastListingActivity?.updatedAt ? new Date(lastListingActivity.updatedAt).getTime() : 0;
      const t = Math.max(a, b);
      return t > 0 ? new Date(t).toISOString() : null;
    })();

    const taxFilled = Boolean(String(commercial.taxNumber || "").replace(/\D/g, "").length >= 10);
    const verifications = isCommercial
      ? {
          identity: Boolean(listing.seller.eidsIdentityVerifiedAt || listing.seller.eidsKullaniciKodu),
          tax: listing.seller.commercialStatus === "APPROVED" && taxFilled,
          phone: Boolean(listing.seller.phoneVerified),
          email: Boolean(listing.seller.email),
        }
      : null;

    return NextResponse.json({
      listing: await attachEidsBadge({
        ...listingRest,
        category: listing.category
          ? {
              id: listing.category.id,
              name: listing.category.name,
              slug: listing.category.slug,
              parent: listing.category.parent
                ? { slug: listing.category.parent.slug, name: listing.category.parent.name }
                : null,
            }
          : null,
        topCategorySlug: topSlug,
        accessRule: rule,
        reviewsEnabled: reviewSettings.enabled,
        isFavorited,
        canEdit,
        escrowEligible: Boolean(listing.escrowEligible),
        escrowAvailable,
        ...(escrowAvailable ? { escrowSettings } : {}),
        approvedBidId: listing.approvedBidId,
        approvedBid: approvedBid
          ? {
              id: approvedBid.id,
              bidderId: approvedBid.bidderId,
              amount: Number(approvedBid.amount),
              status: approvedBid.status,
            }
          : null,
        seller: {
          id: listing.seller.id,
          name: showName ? listing.seller.name : null,
          phone: showPhone
            ? listing.seller.phone || listing.contactPhone || null
            : null,
          memberSince: listing.seller.memberSince,
          memberYearsLabel: memberYearsLabel(listing.seller.memberSince),
          accountType: listing.seller.accountType,
          isCommercial,
          commercialTitle: showIdentity && isCommercial ? commercial.commercialTitle || null : null,
          yetkiBelgeNo: showIdentity && isCommercial ? commercial.yetkiBelgeNo || null : null,
          logoUrl: showIdentity && isCommercial ? listing.seller.logoUrl || null : null,
          isPremiumSeller: premiumActive,
          showPremiumBadge: showPremiumBadge !== false,
          showPremiumStoreBadge: showPremiumStoreBadge !== false,
          showYearsBadge: showYearsBadge !== false,
          reviewCount: reviewAgg._count._all || 0,
          avgRating: reviewAgg._avg.rating,
          shopId: listing.seller.ownedShops[0]?.id || null,
          shopName: listing.seller.ownedShops[0]?.name || null,
          identityVisible: showIdentity,
          contactVisible: showContact,
          messagingAllowed: canMessageByRule,
          isSellerFavorited,
          verifications,
          stats: isCommercial
            ? {
                totalListings,
                successfulSales,
                bidAcceptanceRate,
                avgResponseMinutes: null as number | null,
              }
            : null,
          lastActiveAt: isCommercial ? lastActiveAt : null,
        },
      }),
    });
  }

  const where: Record<string, unknown> = {};

  if (sold === "1" || profitSort) {
    where.status = ListingStatus.APPROVED;
  } else if (ending || mostBids || forYou) {
    where.status = ListingStatus.ACTIVE;
  } else {
    const { publicListingStatusWhere } = await import("@/core/services/listingExpiryService");
    Object.assign(where, await publicListingStatusWhere());
  }

  if (ending) {
    const now = new Date();
    const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000);
    where.endsAt = { gte: now, lte: in48h };
  }

  if (mostBids) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    where.bids = { some: { createdAt: { gte: today } } };
  }

  if (featured === "1") {
    where.isFeatured = true;
    where.AND = [
      ...((where.AND as unknown[]) || []),
      {
        OR: [{ featuredUntil: null }, { featuredUntil: { gt: new Date() } }],
      },
    ];
  }
  if (category) {
    const { resolveCategoryFilterIds } = await import("@/lib/syncCategories");
    const slugs = category.split(",").map((s) => s.trim()).filter(Boolean);
    const allIds: string[] = [];
    for (const slug of slugs) {
      const ids = await resolveCategoryFilterIds(prisma, slug);
      if (ids?.length) allIds.push(...ids);
    }
    if (allIds.length) where.categoryId = { in: [...new Set(allIds)] };
    else where.category = { slug: slugs[0] || category };
  }
  const sellerId = searchParams.get("sellerId");
  if (sellerId) where.sellerId = sellerId;
  // Premium izolasyonu: Listing sorgusuna isPremium dokunulmaz.
  // Premium tıklanınca zaten category=premium-* ile daralır; klasik vitrin tüm ilanları gösterir.
  if (city) where.city = { equals: city, mode: "insensitive" };
  if (district) where.district = { equals: district, mode: "insensitive" };
  if (neighborhood) where.neighborhood = { equals: neighborhood, mode: "insensitive" };
  if (dealType === "SATILIK" || dealType === "KIRALIK" || dealType === "DEVREN_SATILIK" || dealType === "DEVREN_KIRALIK") {
    where.dealType = dealType;
  }
  if (subtype) {
    const electric = resolveElectricListingAttrs(subtype);
    if (electric) {
      where.AND = [
        ...((where.AND as unknown[]) || []),
        { attributes: { path: ["subtype"], equals: electric.subtype } },
        {
          OR: [
            { attributes: { path: ["fuel"], equals: electric.fuel } },
            { attributes: { path: ["fuelType"], equals: electric.fuel } },
            { attributes: { path: ["fuel"], equals: "Elektrik" } },
            { attributes: { path: ["fuel"], equals: "ELEKTRIK" } },
          ],
        },
      ];
    } else {
      where.AND = [
        ...((where.AND as unknown[]) || []),
        { attributes: { path: ["subtype"], equals: subtype } },
      ];
    }
  }
  if (rental === "gunluk") {
    where.AND = [
      ...((where.AND as unknown[]) || []),
      { attributes: { path: ["rentalPeriod"], equals: "gunluk" } },
    ];
  }
  if (brand) {
    where.AND = [...((where.AND as unknown[]) || []), { attributes: { path: ["brand"], equals: brand } }];
  }
  if (model) {
    where.AND = [...((where.AND as unknown[]) || []), { attributes: { path: ["model"], equals: model } }];
  }
  if (trim) {
    where.AND = [...((where.AND as unknown[]) || []), { attributes: { path: ["trim"], equals: trim } }];
  }

  const priceFilter: { gte?: bigint; lte?: bigint } = {};
  if (minPrice && Number.isFinite(Number(minPrice))) priceFilter.gte = BigInt(Number(minPrice));
  if (maxPrice && Number.isFinite(Number(maxPrice))) priceFilter.lte = BigInt(Number(maxPrice));
  if (Object.keys(priceFilter).length) where.askPrice = priceFilter;

  if (q) {
    const qTrim = q.trim();
    const noDigits = normalizeListingNoQuery(qTrim);
    if (isListingNoQuery(qTrim) || noDigits.length === 12) {
      where.OR = [{ listingNo: noDigits }];
    } else if (noDigits.length >= 6 && /^\d[\d\s-]*$/.test(qTrim)) {
      // Kısmi ilan numarası araması
      where.OR = [{ listingNo: { contains: noDigits } }];
    } else {
      where.OR = [
        { title: { contains: qTrim, mode: "insensitive" } },
        { city: { contains: qTrim, mode: "insensitive" } },
        { district: { contains: qTrim, mode: "insensitive" } },
        { neighborhood: { contains: qTrim, mode: "insensitive" } },
        ...(noDigits.length >= 4 ? [{ listingNo: { contains: noDigits } }] : []),
      ];
    }
  }

  const home = searchParams.get("home");
  const limitRaw = searchParams.get("limit");
  const pageRaw = Math.floor(Number(searchParams.get("page") || 1) || 1);
  const page = Math.max(1, pageRaw);
  let take = 40;
  let skip = 0;
  let pageSize = 40;
  let paginateHome = false;
  if (featured === "1" || home === "1") {
    const [colsRaw, rowsRaw] = await Promise.all([
      getSetting<string>("v2_home_grid_cols", "4"),
      getSetting<string>("home_listings_rows", "3"),
    ]);
    const cols = colsRaw === "5" || colsRaw === "6" ? Number(colsRaw) : 4;
    const rows = Math.min(8, Math.max(3, Math.floor(Number(rowsRaw) || 3)));
    pageSize = cols * rows;
    take = pageSize;
    skip = (page - 1) * pageSize;
    paginateHome = true;
  } else if (limitRaw != null && limitRaw !== "") {
    const n = Number(limitRaw);
    if (Number.isFinite(n)) take = Math.min(120, Math.max(1, Math.floor(n)));
    pageSize = take;
  }

  /** Ana sayfa vitrin / insight modları */
  const orderBy =
    ending
      ? [{ endsAt: "asc" as const }]
      : sold === "1" || profitSort
        ? [{ updatedAt: "desc" as const }]
        : forYou || paginateHome
          ? [{ isFeatured: "desc" as const }, { createdAt: "desc" as const }]
          : [{ createdAt: "desc" as const }];

  // Bugün en çok teklif: önce bugünkü teklif sayısına göre sırala
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let listings: any[] = [];
  let homeTotal = 0;
  let todayBidCountById = new Map<string, number>();

  if (mostBids) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const { bids: _bidsFilter, ...listingWhereForBids } = where as {
      bids?: unknown;
      [k: string]: unknown;
    };
    void _bidsFilter;
    const grouped = await prisma.bid.groupBy({
      by: ["listingId"],
      where: {
        createdAt: { gte: today },
        listing: listingWhereForBids,
      },
      _count: { _all: true },
      orderBy: { _count: { listingId: "desc" } },
      take: Math.min(120, take * 2),
    });
    todayBidCountById = new Map(grouped.map((g) => [g.listingId, g._count._all]));
    const ids = grouped.map((g) => g.listingId).slice(0, take);
    const rows = ids.length
      ? await prisma.listing.findMany({
          where: { id: { in: ids } },
          include: {
            category: true,
            seller: { select: { accountType: true } },
            approvedBid: { select: { amount: true, createdAt: true, updatedAt: true } },
          },
        })
      : [];
    const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
    listings = ids.map((id) => byId[id]).filter(Boolean);
    homeTotal = grouped.length;
  } else {
    const fetchTake = profitSort ? Math.min(120, Math.max(take * 3, 60)) : take;
    const [rows, total] = await Promise.all([
      prisma.listing.findMany({
        where,
        include: {
          category: true,
          seller: { select: { accountType: true } },
          approvedBid: { select: { amount: true, createdAt: true, updatedAt: true } },
        },
        orderBy,
        take: fetchTake,
        skip: paginateHome ? skip : 0,
      }),
      paginateHome || ending || sold === "1" || forYou
        ? prisma.listing.count({ where })
        : Promise.resolve(0),
    ]);
    listings = rows;
    homeTotal = total;
  }

  const session = await getSession();
  let favIds = new Set<string>();
  if (session?.id && listings.length) {
    const favs = await prisma.favorite.findMany({
      where: { userId: session.id, listingId: { in: listings.map((l) => l.id) } },
      select: { listingId: true },
    });
    favIds = new Set(favs.map((f) => f.listingId));
  }

  const { getMarketplaceHomeStats } = await import("@/core/services/marketplaceStatsService");
  const stats = await getMarketplaceHomeStats();

  const premiumBadgeRule = await getSetting<string>("premium_badge_rule", "premium_3");

  let paidListingIds = new Set<string>();
  if (premiumBadgeRule === "paid" && listings.length) {
    const payments = await prisma.payment.findMany({
      where: {
        purpose: "listing_fee",
        status: { in: [PaymentStatus.PAID, PaymentStatus.SIMULATED] },
      },
      select: { meta: true },
      take: 800,
      orderBy: { createdAt: "desc" },
    });
    for (const p of payments) {
      const meta = p.meta as { listingId?: string } | null;
      if (meta?.listingId) paidListingIds.add(String(meta.listingId));
    }
  }

  const rootCategoriesRaw = await prisma.category.findMany({
    where: { isActive: true, parentId: null },
    orderBy: { sortOrder: "asc" },
    include: {
      children: {
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
        select: { id: true, slug: true, name: true, icon: true, sortOrder: true },
      },
      _count: { select: { listings: true } },
    },
  });
  // Premium kökleri klasik kategori chip/facet listesinden çıkar (slug ile — DB flag sorgusu yok)
  const rootCategories = rootCategoriesRaw.filter((c) => !String(c.slug).startsWith("premium-"));

  const categories = await Promise.all(
    rootCategories.map(async (c) => {
      const childIds = c.children.map((ch) => ch.id);
      const listingCount =
        childIds.length === 0
          ? c._count.listings
          : await prisma.listing.count({
              where: {
                categoryId: { in: [c.id, ...childIds] },
                status: { in: [ListingStatus.ACTIVE, ListingStatus.SELECTION, ListingStatus.APPROVED] },
              },
            });
      return {
        id: c.id,
        slug: c.slug,
        name: c.name,
        icon: c.icon,
        sortOrder: c.sortOrder,
        parentId: null as string | null,
        children: c.children,
        _count: { listings: listingCount },
      };
    })
  );

  // İlan oluşturma: yaprak kategoriler (alışveriş altları + emlak kökleri)
  const listingCategories = [
    ...categories
      .filter((c) => !c.children.length)
      .map((c) => ({ id: c.id, slug: c.slug, name: c.name, group: null as string | null })),
    ...categories.flatMap((c) =>
      c.children.map((ch) => ({
        id: ch.id,
        slug: ch.slug,
        name: ch.name,
        group: c.name,
      }))
    ),
  ];

  const { getFacetCounts } = await import("@/lib/facetCounts");
  const facets = await getFacetCounts();

  const totalPages = paginateHome ? Math.max(1, Math.ceil(homeTotal / pageSize)) : 1;

  const mapped = await attachEidsBadgeMany(
    listings.map((l) => {
      const { seller, approvedBid, ...rest } = l;
      const isStore =
        Boolean(rest.shopId) ||
        seller.accountType === "EMLAKCI" ||
        seller.accountType === "GALERICI" ||
        seller.accountType === "TICARI";
      const finalPrice = approvedBid ? Number(approvedBid.amount) : null;
      const soldAt = approvedBid?.updatedAt || approvedBid?.createdAt || rest.updatedAt;
      const ask = Number(rest.askPrice);
      const profit =
        finalPrice != null && (sold === "1" || profitSort) ? finalPrice - ask : null;
      const todayBids = todayBidCountById.get(l.id);
      return {
        ...serializeListing(rest),
        finalPrice,
        soldAt,
        profit: profit != null && profit > 0 ? profit : profitSort ? profit : null,
        bidCountToday: todayBids ?? undefined,
        isFavorited: favIds.has(l.id),
        showPremiumBadge: shouldShowPremiumBadge(rest, premiumBadgeRule, {
          isPaid: paidListingIds.has(l.id),
          isStore,
        }),
      };
    })
  );

  let listingsOut = mapped;
  if (profitSort) {
    listingsOut = [...mapped]
      .filter((x) => (x.profit ?? 0) > 0)
      .sort((a, b) => (b.profit || 0) - (a.profit || 0))
      .slice(0, take);
    homeTotal = listingsOut.length;
  } else if (sold === "1") {
    listingsOut = [...mapped].sort(
      (a, b) => new Date(String(b.soldAt || 0)).getTime() - new Date(String(a.soldAt || 0)).getTime()
    );
  } else if (mostBids) {
    listingsOut = mapped.map((x) => ({
      ...x,
      bidCount: x.bidCountToday ?? x.bidCount,
    }));
  }

  const mode = profitSort
    ? "profit"
    : sold === "1"
      ? "sold"
      : ending
        ? "ending"
        : mostBids
          ? "mostBids"
          : forYou
            ? "forYou"
            : "default";

  return NextResponse.json({
    mode,
    listings: listingsOut,
    premiumBadgeRule,
    stats,
    categories,
    listingCategories,
    facets,
    pagination: paginateHome
      ? {
          page: Math.min(page, totalPages),
          pageSize,
          total: homeTotal,
          totalPages,
        }
      : undefined,
  });
}

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Giriş gerekli" }, { status: 401 });
    const body = await req.json();

    const { createListingForSeller } = await import("@/core/services/listingCreateService");
    const result = await createListingForSeller(session, body);
    if (!result.ok) {
      return NextResponse.json(result.body, { status: result.status });
    }
    return NextResponse.json({
      ok: true,
      id: result.listingId,
      status: result.status,
      message: result.message,
    });
  } catch (e) {
    console.error("[POST /api/listings]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "İlan oluşturulamadı" },
      { status: 500 }
    );
  }
}
