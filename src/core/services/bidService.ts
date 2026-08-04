import { BidStatus, ListingStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { guardPlaceBid } from "@/core/guards/bidGuard";
import { getSettingsMap } from "@/core/settings";
import { notifyUser } from "@/core/notify";
import { generateListingNo } from "@/lib/listingNo";
import { notifyListingFavoriters } from "@/core/services/favoriteNotify";
import { formatTl } from "@/lib/format";

export async function placeBid(input: {
  listingId: string;
  bidderId: string;
  amount: number;
  durationDays: number;
}) {
  const { isOffersEnabled } = await import("@/core/services/marketplaceModeService");
  if (!(await isOffersEnabled())) {
    return {
      ok: false as const,
      error: "Bu sitede teklif sistemi kapalı. İlan sahibiyle iletişim kurabilirsiniz.",
      code: "OFFERS_DISABLED" as const,
      requiredTokens: undefined,
      balance: undefined,
    };
  }

  const guard = await guardPlaceBid(input);
  if (!guard.allowed) {
    return {
      ok: false as const,
      error: guard.reason,
      code: guard.code,
      requiredTokens: guard.requiredTokens,
      balance: guard.balance,
    };
  }

  const settings = guard.settings!;
  const listing = guard.listing!;
  const tokenCost = guard.tokenCost!;
  const replaces = Boolean(settings.second_bid_replaces_previous);

  let expiresAt = new Date(Date.now() + input.durationDays * 24 * 60 * 60 * 1000);
  const canExceed = Boolean(settings.bid_can_exceed_listing_end);
  const policy = String(settings.bid_exceed_policy || "clamp");
  if (listing.endsAt && !canExceed && policy === "clamp" && expiresAt > listing.endsAt) {
    expiresAt = listing.endsAt;
  }

  const result = await prisma.$transaction(async (tx) => {
    if (replaces) {
      await tx.bid.updateMany({
        where: { listingId: input.listingId, bidderId: input.bidderId, status: BidStatus.ACTIVE },
        data: { status: BidStatus.WITHDRAWN },
      });
    }

    const bid = await tx.bid.create({
      data: {
        listingId: input.listingId,
        bidderId: input.bidderId,
        amount: BigInt(input.amount),
        durationDays: input.durationDays,
        expiresAt,
        status: BidStatus.ACTIVE,
        tokensSpent: tokenCost,
      },
    });

    const user = await tx.user.update({
      where: { id: input.bidderId },
      data: { tokenBalance: { decrement: tokenCost } },
    });

    await tx.tokenLedger.create({
      data: {
        userId: input.bidderId,
        delta: -tokenCost,
        balanceAfter: user.tokenBalance,
        reason: "bid",
        meta: { listingId: input.listingId, bidId: bid.id },
      },
    });

    const activeBids = await tx.bid.findMany({
      where: { listingId: input.listingId, status: BidStatus.ACTIVE },
      orderBy: { amount: "desc" },
    });
    const highest = activeBids[0]?.amount ?? BigInt(0);

    await tx.listing.update({
      where: { id: input.listingId },
      data: {
        highestBid: highest,
        bidCount: activeBids.length,
      },
    });

    return bid;
  });

  await notifyUser(listing.sellerId, {
    title: "Yeni teklif aldınız",
    body: `${listing.title} ilanınıza yeni teklif geldi.`,
    eventKey: "bid_received",
    link: `/ilan/${listing.id}`,
  });

  const ask = Number(listing.askPrice);
  const prevHigh = Number(listing.highestBid || 0);
  const bidAmount = input.amount;
  const exclude = [listing.sellerId, input.bidderId];

  if (Number.isFinite(ask) && bidAmount > ask) {
    await notifyListingFavoriters(
      listing.id,
      {
        title: "Favori ilanınıza fiyatından yüksek teklif geldi",
        body: `"${listing.title}" için ${formatTl(bidAmount)} teklif verildi (ilan: ${formatTl(ask)}).`,
        eventKey: "favorite_bid_over_ask",
        link: `/ilan/${listing.id}`,
      },
      { excludeUserIds: exclude }
    );
  }

  if (bidAmount > prevHigh && prevHigh > 0) {
    await notifyListingFavoriters(
      listing.id,
      {
        title: "Favori ilanınızda yeni en yüksek teklif",
        body: `"${listing.title}" en yüksek teklifi ${formatTl(bidAmount)} oldu.`,
        eventKey: "favorite_new_high_bid",
        link: `/ilan/${listing.id}`,
      },
      { excludeUserIds: exclude }
    );
  } else if (prevHigh <= 0 && bidAmount > 0) {
    await notifyListingFavoriters(
      listing.id,
      {
        title: "Favori ilanınıza ilk teklif geldi",
        body: `"${listing.title}" için ilk teklif: ${formatTl(bidAmount)}.`,
        eventKey: "favorite_new_high_bid",
        link: `/ilan/${listing.id}`,
      },
      { excludeUserIds: exclude }
    );
  }

  return { ok: true as const, bid: result };
}

export async function approveBid(input: { listingId: string; bidId: string; sellerId: string }) {
  const settings = await getSettingsMap();
  const listing = await prisma.listing.findUnique({ where: { id: input.listingId } });
  if (!listing || listing.sellerId !== input.sellerId) {
    return { ok: false as const, error: "Yetkisiz" };
  }

  const bid = await prisma.bid.findUnique({ where: { id: input.bidId } });
  if (!bid || bid.listingId !== input.listingId) {
    return { ok: false as const, error: "Teklif bulunamadı" };
  }
  if (bid.status !== BidStatus.ACTIVE) {
    return { ok: false as const, error: "Teklif onaylanabilir durumda değil" };
  }
  if (bid.expiresAt.getTime() < Date.now()) {
    await prisma.bid.update({ where: { id: bid.id }, data: { status: BidStatus.EXPIRED } });
    return { ok: false as const, error: "Teklif süresi dolmuş, onaylanamaz" };
  }

  const rejectOthers = Boolean(settings.on_approve_reject_others);
  const mode = String(settings.approval_mode || "meeting");

  await prisma.$transaction(async (tx) => {
    await tx.bid.update({ where: { id: bid.id }, data: { status: BidStatus.APPROVED } });
    if (rejectOthers) {
      await tx.bid.updateMany({
        where: { listingId: input.listingId, id: { not: bid.id }, status: BidStatus.ACTIVE },
        data: { status: BidStatus.REJECTED },
      });
    }
    await tx.listing.update({
      where: { id: input.listingId },
      data: {
        approvedBidId: bid.id,
        status: mode === "sale" ? ListingStatus.APPROVED : ListingStatus.APPROVED,
      },
    });
  });

  await notifyUser(bid.bidderId, {
    title: mode === "sale" ? "Teklifiniz satış için onaylandı" : "Teklifiniz görüşmeye açıldı",
    body: `${listing.title} sonuçlandı — satıcı iletişim bilgileri açıldı.`,
    eventKey: "bid_approved",
    link: `/ilan/${listing.id}`,
  });

  return { ok: true as const, approvalMode: mode };
}

export async function processExpiredListings() {
  const { processExpiredListings: run } = await import("@/core/services/listingExpiryService");
  return run();
}

export async function republishListing(listingId: string, sellerId: string) {
  const settings = await getSettingsMap();
  const listing = await prisma.listing.findUnique({ where: { id: listingId } });
  if (!listing || listing.sellerId !== sellerId) return { ok: false as const, error: "Yetkisiz" };
  if (listing.status !== ListingStatus.EXPIRED) return { ok: false as const, error: "İlan yeniden yayınlanamaz" };
  if (listing.republishAvailableAt && listing.republishAvailableAt > new Date()) {
    return { ok: false as const, error: "Bekleme süresi dolmadı" };
  }

  const mode = String(settings.republish_mode || "same_reset");
  const minDays = Number(settings.listing_min_days ?? 3);
  const endsAt = new Date(Date.now() + minDays * 24 * 60 * 60 * 1000);

  if (mode === "new_copy") {
    const listingNo = await generateListingNo();
    const copy = await prisma.listing.create({
      data: {
        listingNo,
        sellerId,
        categoryId: listing.categoryId,
        title: listing.title,
        description: listing.description,
        city: listing.city,
        district: listing.district,
        neighborhood: listing.neighborhood,
        dealType: listing.dealType,
        askPrice: listing.askPrice,
        status: ListingStatus.ACTIVE,
        startsAt: new Date(),
        endsAt,
        coverImage: listing.coverImage,
        images: listing.images,
        attributes: listing.attributes ?? undefined,
        contactPhone: listing.contactPhone,
        escrowEligible: listing.escrowEligible,
      },
    });
    return { ok: true as const, listingId: copy.id };
  }

  await prisma.$transaction(async (tx) => {
    await tx.bid.deleteMany({ where: { listingId } });
    await tx.listing.update({
      where: { id: listingId },
      data: {
        status: ListingStatus.ACTIVE,
        highestBid: BigInt(0),
        bidCount: 0,
        approvedBidId: null,
        startsAt: new Date(),
        endsAt,
        selectionEndsAt: null,
        republishAvailableAt: null,
      },
    });
  });

  return { ok: true as const, listingId };
}

async function refundBidTokens(input: {
  tx: Prisma.TransactionClient;
  userId: string;
  bidId: string;
  listingId: string;
  tokens: number;
  reason: string;
  description: string;
  requestId?: string | null;
}) {
  if (input.tokens <= 0) return null;
  const user = await input.tx.user.update({
    where: { id: input.userId },
    data: { tokenBalance: { increment: input.tokens } },
  });
  await input.tx.tokenLedger.create({
    data: {
      userId: input.userId,
      delta: input.tokens,
      balanceAfter: user.tokenBalance,
      reason: input.reason,
      meta: { listingId: input.listingId, bidId: input.bidId },
    },
  });
  const refund = await input.tx.tokenRefund.create({
    data: {
      userId: input.userId,
      bidId: input.bidId,
      listingId: input.listingId,
      requestId: input.requestId || null,
      amount: input.tokens,
      reason: input.reason,
      description: input.description,
    },
  });
  return refund;
}

function assertBidderCanRevise(listing: {
  bidderReviseUntil: Date | null;
  lastChangeAt: Date | null;
  lastChangeDiff: unknown;
}) {
  if (!listing.lastChangeDiff || !listing.lastChangeAt) {
    return { ok: false as const, error: "Bu ilanda güncel bir düzenleme yok" };
  }
  if (!listing.bidderReviseUntil || listing.bidderReviseUntil.getTime() <= Date.now()) {
    return { ok: false as const, error: "Teklif revize süresi dolmuş" };
  }
  return { ok: true as const };
}

/** İlan değişikliği sonrası teklif sahibi teklifini çeker — jeton iade */
export async function withdrawBidAfterListingChange(input: {
  listingId: string;
  bidId: string;
  bidderId: string;
}) {
  const listing = await prisma.listing.findUnique({ where: { id: input.listingId } });
  if (!listing) return { ok: false as const, error: "İlan bulunamadı" };
  const gate = assertBidderCanRevise(listing);
  if (!gate.ok) return gate;

  const bid = await prisma.bid.findUnique({ where: { id: input.bidId } });
  if (!bid || bid.listingId !== input.listingId || bid.bidderId !== input.bidderId) {
    return { ok: false as const, error: "Teklif bulunamadı" };
  }
  if (bid.status !== BidStatus.ACTIVE) {
    return { ok: false as const, error: "Teklif aktif değil" };
  }

  const tokens = Math.max(0, bid.tokensSpent || 0);
  await prisma.$transaction(async (tx) => {
    await tx.bid.update({
      where: { id: bid.id },
      data: { status: BidStatus.WITHDRAWN },
    });
    await refundBidTokens({
      tx,
      userId: input.bidderId,
      bidId: bid.id,
      listingId: listing.id,
      tokens,
      reason: "listing_change_withdraw",
      description: `"${listing.title}" ilanında değişiklik sonrası teklif silindi — ${tokens} jeton iade.`,
      requestId: listing.lastChangeRequestId,
    });
    const activeBids = await tx.bid.findMany({
      where: { listingId: listing.id, status: BidStatus.ACTIVE },
      orderBy: { amount: "desc" },
    });
    await tx.listing.update({
      where: { id: listing.id },
      data: {
        highestBid: activeBids[0]?.amount ?? BigInt(0),
        bidCount: activeBids.length,
      },
    });
  });

  await notifyUser(listing.sellerId, {
    title: "Bir teklif geri çekildi",
    body: `"${listing.title}" ilanınızda bir teklif, düzenleme sonrası geri çekildi.`,
    eventKey: "bid_withdrawn",
    link: `/ilan/${listing.id}`,
  });

  return { ok: true as const, refundedTokens: tokens };
}

/** İlan değişikliği sonrası teklif tutarını güncelle — eski jeton iade, yeni teklif için yeniden kesilir */
export async function reviseBidAfterListingChange(input: {
  listingId: string;
  bidId: string;
  bidderId: string;
  amount: number;
  durationDays: number;
}) {
  const listing = await prisma.listing.findUnique({ where: { id: input.listingId } });
  if (!listing) return { ok: false as const, error: "İlan bulunamadı" };
  const gate = assertBidderCanRevise(listing);
  if (!gate.ok) return gate;

  const bid = await prisma.bid.findUnique({ where: { id: input.bidId } });
  if (!bid || bid.listingId !== input.listingId || bid.bidderId !== input.bidderId) {
    return { ok: false as const, error: "Teklif bulunamadı" };
  }
  if (bid.status !== BidStatus.ACTIVE) {
    return { ok: false as const, error: "Teklif aktif değil" };
  }

  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false as const, error: "Geçerli tutar girin" };
  }

  const refundTokens = Math.max(0, bid.tokensSpent || 0);
  // Yeni teklif için jeton tekrar alınır (iade + yerleştir)
  await prisma.$transaction(async (tx) => {
    await tx.bid.update({
      where: { id: bid.id },
      data: { status: BidStatus.WITHDRAWN },
    });
    await refundBidTokens({
      tx,
      userId: input.bidderId,
      bidId: bid.id,
      listingId: listing.id,
      tokens: refundTokens,
      reason: "listing_change_revise",
      description: `"${listing.title}" düzenleme sonrası teklif güncellemesi — eski teklif jetonu iade (${refundTokens}).`,
      requestId: listing.lastChangeRequestId,
    });
    const activeBids = await tx.bid.findMany({
      where: { listingId: listing.id, status: BidStatus.ACTIVE },
      orderBy: { amount: "desc" },
    });
    await tx.listing.update({
      where: { id: listing.id },
      data: {
        highestBid: activeBids[0]?.amount ?? BigInt(0),
        bidCount: activeBids.length,
      },
    });
  });

  const placed = await placeBid({
    listingId: input.listingId,
    bidderId: input.bidderId,
    amount,
    durationDays: Math.max(1, Number(input.durationDays) || bid.durationDays || 3),
  });
  if (!placed.ok) {
    return {
      ok: false as const,
      error: placed.error || "Yeni teklif verilemedi",
      code: placed.code,
      requiredTokens: placed.requiredTokens,
      balance: placed.balance,
      refundedTokens: refundTokens,
    };
  }

  return { ok: true as const, bidId: placed.bid.id, refundedTokens: refundTokens };
}
