import { EscrowStatus, ListingStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSetting } from "@/core/settings";
import { resolveMagazaPanelAccess } from "@/lib/magazaPanelAccess";
import { parseCommercialProfile } from "@/data/commercialProfile";

const LIVE: ListingStatus[] = [ListingStatus.ACTIVE, ListingStatus.SELECTION, ListingStatus.PENDING_REVIEW];

export async function getMagazaOverview(sellerId: string) {
  const user = await prisma.user.findUnique({
    where: { id: sellerId },
    include: { ownedShops: { take: 1 }, shopSubscription: { include: { package: true } } },
  });
  if (!user) return { ok: false as const, status: 404, error: "Kullanıcı yok" };

  const access = await resolveMagazaPanelAccess(user);
  if (!access.allowed) return { ok: false as const, status: 403, error: access.reason || "Erişim yok" };

  const qaSla = Number((await getSetting<number>("seller_panel_qa_sla_hours", 24)) || 24);
  const shipReminder = Number((await getSetting<number>("seller_panel_ship_reminder_hours", 48)) || 48);
  const slaCut = new Date(Date.now() - qaSla * 3600_000);
  const shipCut = new Date(Date.now() - shipReminder * 3600_000);

  const safeCount = async (fn: () => Promise<number>) => {
    try {
      return await fn();
    } catch (e) {
      console.error("magaza overview count failed", e);
      return 0;
    }
  };

  const [
    activeListings,
    pendingListings,
    unansweredQuestions,
    overdueQuestions,
    awaitShip,
    overdueShip,
    shipped,
    disputes,
    released,
  ] = await Promise.all([
    safeCount(() => prisma.listing.count({ where: { sellerId, status: { in: LIVE } } })),
    safeCount(() => prisma.listing.count({ where: { sellerId, status: ListingStatus.PENDING_REVIEW } })),
    safeCount(() =>
      prisma.listingQuestion.count({
        where: { listing: { sellerId }, answeredAt: null, isHidden: false },
      })
    ),
    safeCount(() =>
      prisma.listingQuestion.count({
        where: {
          listing: { sellerId },
          answeredAt: null,
          isHidden: false,
          createdAt: { lt: slaCut },
        },
      })
    ),
    safeCount(() =>
      prisma.escrowDeal.count({
        where: { sellerId, status: { in: [EscrowStatus.AWAITING_SHIPMENT, EscrowStatus.FUNDED] } },
      })
    ),
    safeCount(() =>
      prisma.escrowDeal.count({
        where: {
          sellerId,
          status: { in: [EscrowStatus.AWAITING_SHIPMENT, EscrowStatus.FUNDED] },
          updatedAt: { lt: shipCut },
        },
      })
    ),
    safeCount(() =>
      prisma.escrowDeal.count({
        where: { sellerId, status: { in: [EscrowStatus.SHIPPED, EscrowStatus.BUYER_REVIEW] } },
      })
    ),
    safeCount(() => prisma.escrowDeal.count({ where: { sellerId, status: EscrowStatus.DISPUTED } })),
    safeCount(() => prisma.escrowDeal.count({ where: { sellerId, status: EscrowStatus.RELEASED } })),
  ]);

  const commercial = parseCommercialProfile(user.profile);
  const pkg = user.shopSubscription?.package;

  return {
    ok: true as const,
    access,
    shop: {
      name: commercial.commercialTitle || user.ownedShops[0]?.name || user.name || "Mağazam",
      logoUrl: user.logoUrl,
      packageName: pkg?.name || null,
      listingLimit: pkg?.listingLimit ?? null,
    },
    kpis: {
      activeListings,
      pendingListings,
      unansweredQuestions,
      overdueQuestions,
      awaitShip,
      overdueShip,
      shipped,
      disputes,
      released,
      qaSlaHours: qaSla,
      shipReminderHours: shipReminder,
    },
  };
}

export async function listSellerMagazaListings(sellerId: string) {
  const rows = await prisma.listing.findMany({
    where: { sellerId },
    orderBy: { updatedAt: "desc" },
    take: 80,
    select: {
      id: true,
      listingNo: true,
      title: true,
      status: true,
      askPrice: true,
      coverImage: true,
      city: true,
      district: true,
      escrowEligible: true,
      createdAt: true,
      updatedAt: true,
      endsAt: true,
      _count: { select: { listingQuestions: true, escrowDeals: true } },
    },
  });
  return rows.map((r) => ({
    ...r,
    askPrice: Number(r.askPrice),
    questionCount: r._count.listingQuestions,
    orderCount: r._count.escrowDeals,
  }));
}

export async function listSellerMagazaOrders(sellerId: string, status?: string) {
  const where: { sellerId: string; status?: EscrowStatus | { in: EscrowStatus[] } } = { sellerId };
  if (status === "ship") {
    where.status = { in: [EscrowStatus.AWAITING_SHIPMENT, EscrowStatus.FUNDED] };
  } else if (status === "transit") {
    where.status = { in: [EscrowStatus.SHIPPED, EscrowStatus.BUYER_REVIEW] };
  } else if (status === "done") {
    where.status = { in: [EscrowStatus.RELEASED, EscrowStatus.REFUNDED] };
  } else if (status === "dispute") {
    where.status = EscrowStatus.DISPUTED;
  } else if (status && Object.values(EscrowStatus).includes(status as EscrowStatus)) {
    where.status = status as EscrowStatus;
  }

  const rows = await prisma.escrowDeal.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    take: 100,
    include: {
      listing: { select: { id: true, title: true, coverImage: true, listingNo: true } },
      linkedOrder: {
        select: {
          id: true,
          orderNo: true,
          items: {
            take: 1,
            select: {
              productNameSnapshot: true,
              variantTitleSnapshot: true,
              productImageSnapshot: true,
              productId: true,
            },
          },
        },
      },
      sellerOffer: {
        select: {
          id: true,
          product: { select: { id: true, name: true, mainImage: true } },
          variant: { select: { title: true } },
        },
      },
      buyer: { select: { id: true, name: true, phone: true } },
    },
  });

  return rows.map((d) => {
    const item = d.linkedOrder?.items?.[0];
    const title =
      d.listing?.title ||
      (item?.productNameSnapshot
        ? `${item.productNameSnapshot}${item.variantTitleSnapshot ? ` · ${item.variantTitleSnapshot}` : ""}`
        : null) ||
      (d.sellerOffer?.product?.name
        ? `${d.sellerOffer.product.name}${
            d.sellerOffer.variant?.title ? ` · ${d.sellerOffer.variant.title}` : ""
          }`
        : null) ||
      d.linkedOrder?.orderNo ||
      "Katalog sipariş";
    const coverImage =
      d.listing?.coverImage ||
      item?.productImageSnapshot ||
      d.sellerOffer?.product?.mainImage ||
      null;
    const productId = item?.productId || d.sellerOffer?.product?.id || null;
    return {
      id: d.id,
      status: d.status,
      amountTl: d.amountTl,
      sellerPayoutTl: d.sellerPayoutTl,
      shipDays: d.shipDays,
      cargoTrackingNo: d.cargoTrackingNo,
      cargoCarrier: d.cargoCarrier,
      cargoNote: d.cargoNote,
      shippedAt: d.shippedAt?.toISOString() || null,
      shipDeadlineAt: d.shipDeadlineAt?.toISOString() || null,
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
      listing: d.listing
        ? d.listing
        : {
            id: productId || d.id,
            title,
            coverImage,
            listingNo: d.linkedOrder?.orderNo || null,
            isCatalog: true,
            productId,
          },
      buyer: { id: d.buyer.id, name: d.buyer.name },
    };
  });
}
