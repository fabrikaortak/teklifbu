import { BidStatus, ListingStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSettingsMap } from "@/core/settings";
import { isOffersEnabled } from "@/core/services/marketplaceModeService";
import {
  normalizeListingExpiryRules,
  resolveListingExpiryKind,
  type ListingExpiryRules,
} from "@/lib/listingExpiryRules";

function daysMs(days: number) {
  return Math.max(0, days) * 24 * 60 * 60 * 1000;
}

function minutesMs(mins: number) {
  return Math.max(0, mins) * 60 * 1000;
}

export async function getListingExpiryRules(): Promise<ListingExpiryRules> {
  const settings = await getSettingsMap();
  const rules = normalizeListingExpiryRules(settings.listing_expiry_rules);
  // Eski ayar ile senkron
  const legacy = Number(settings.post_end_selection_minutes);
  if (Number.isFinite(legacy) && legacy >= 0 && !settings.listing_expiry_rules) {
    rules.bidding.selectionMinutes = legacy;
  }
  return rules;
}

/** Vitrin / liste için status filtresi */
export async function publicListingStatusWhere(now = new Date()) {
  const rules = await getListingExpiryRules();
  const maxExpiredDays = Math.max(
    rules.bidding.expiredVisibleDays,
    rules.classified.afterEnd === "hide_immediate" ? 0 : rules.classified.graceDays,
    rules.buy.afterEnd === "hide_immediate" ? 0 : rules.buy.graceDays,
    rules.classified.expiredVisibleDays,
    rules.buy.expiredVisibleDays
  );
  const maxApprovedDays =
    rules.bidding.onApprove === "hide_immediate" ? 0 : rules.bidding.approvedVisibleDays;

  const expiredAfter = new Date(now.getTime() - daysMs(maxExpiredDays));
  const approvedAfter = new Date(now.getTime() - daysMs(maxApprovedDays));

  const or: object[] = [
    { status: { in: [ListingStatus.ACTIVE, ListingStatus.SELECTION] } },
  ];
  if (maxExpiredDays > 0) {
    or.push({
      status: ListingStatus.EXPIRED,
      updatedAt: { gte: expiredAfter },
    });
  }
  if (maxApprovedDays > 0) {
    or.push({
      status: ListingStatus.APPROVED,
      updatedAt: { gte: approvedAfter },
    });
  } else {
    // Onay sonrası hemen kalksa bile “satılanlar” feed’i APPROVED ister — sold=1 ayrı
    or.push({ status: ListingStatus.APPROVED });
  }

  return { OR: or };
}

/**
 * ACTIVE + endsAt geçmiş ilanları kurallara göre SELECTION / EXPIRED yapar;
 * görünürlük süresi biten EXPIRED / APPROVED → ARCHIVED.
 */
export async function processExpiredListings() {
  const settings = await getSettingsMap();
  const rules = normalizeListingExpiryRules(settings.listing_expiry_rules);
  const offersEnabled = await isOffersEnabled();
  const now = new Date();
  const waitHours = Number(settings.republish_wait_hours ?? 24);

  const ending = await prisma.listing.findMany({
    where: { status: ListingStatus.ACTIVE, endsAt: { lte: now } },
    select: {
      id: true,
      endsAt: true,
      escrowEligible: true,
      approvedBidId: true,
    },
  });

  for (const l of ending) {
    const kind = resolveListingExpiryKind({
      offersEnabled,
      escrowEligible: l.escrowEligible,
    });

    if (kind === "bidding") {
      if (rules.bidding.afterEnd === "selection") {
        const mins = rules.bidding.selectionMinutes;
        await prisma.listing.update({
          where: { id: l.id },
          data: {
            status: ListingStatus.SELECTION,
            selectionEndsAt: new Date(now.getTime() + minutesMs(mins)),
          },
        });
      } else if (rules.bidding.afterEnd === "grace") {
        await prisma.listing.update({
          where: { id: l.id },
          data: {
            status: ListingStatus.SELECTION,
            selectionEndsAt: new Date(now.getTime() + minutesMs(rules.bidding.graceMinutes)),
          },
        });
      } else {
        await expireListing(l.id, now, waitHours);
      }
      continue;
    }

    // classified / buy → EXPIRED (görünürlük günleri public filter’da)
    await expireListing(l.id, now, waitHours);
  }

  // Seçim penceresi bitti, onay yok
  const selectionDone = await prisma.listing.findMany({
    where: {
      status: ListingStatus.SELECTION,
      selectionEndsAt: { lte: now },
      approvedBidId: null,
    },
    select: { id: true },
  });
  for (const l of selectionDone) {
    await expireListing(l.id, now, waitHours);
  }

  await prisma.bid.updateMany({
    where: { status: BidStatus.ACTIVE, expiresAt: { lte: now } },
    data: { status: BidStatus.EXPIRED },
  });

  // Görünürlük süresi bitenleri arşivle
  const expiredCutBidding = new Date(now.getTime() - daysMs(rules.bidding.expiredVisibleDays));
  const expiredCutClassified = new Date(
    now.getTime() -
      daysMs(
        rules.classified.afterEnd === "hide_immediate"
          ? 0
          : Math.max(rules.classified.graceDays, rules.classified.expiredVisibleDays)
      )
  );
  const expiredCutBuy = new Date(
    now.getTime() -
      daysMs(
        rules.buy.afterEnd === "hide_immediate"
          ? 0
          : Math.max(rules.buy.graceDays, rules.buy.expiredVisibleDays)
      )
  );
  // Tek kesim: en kısa olmayan — arşiv için listing bazında kind gerekir; güvenli: min cut = oldest allowed
  const archiveExpiredBefore = new Date(
    Math.min(expiredCutBidding.getTime(), expiredCutClassified.getTime(), expiredCutBuy.getTime())
  );

  await prisma.listing.updateMany({
    where: {
      status: ListingStatus.EXPIRED,
      updatedAt: { lt: archiveExpiredBefore },
    },
    data: { status: ListingStatus.ARCHIVED },
  });

  if (rules.bidding.onApprove === "hide_immediate") {
    await prisma.listing.updateMany({
      where: {
        status: ListingStatus.APPROVED,
        // yeni onaylananları hemen arşivleme — updatedAt ~ now; 1 dk pay
        updatedAt: { lt: new Date(now.getTime() - 60 * 1000) },
      },
      data: { status: ListingStatus.ARCHIVED },
    });
  } else if (rules.bidding.approvedVisibleDays > 0) {
    await prisma.listing.updateMany({
      where: {
        status: ListingStatus.APPROVED,
        updatedAt: { lt: new Date(now.getTime() - daysMs(rules.bidding.approvedVisibleDays)) },
      },
      data: { status: ListingStatus.ARCHIVED },
    });
  }
}

async function expireListing(id: string, now: Date, waitHours: number) {
  await prisma.listing.update({
    where: { id },
    data: {
      status: ListingStatus.EXPIRED,
      republishAvailableAt: new Date(now.getTime() + waitHours * 60 * 60 * 1000),
      selectionEndsAt: null,
    },
  });
  await prisma.bid.updateMany({
    where: { listingId: id, status: BidStatus.ACTIVE },
    data: { status: BidStatus.EXPIRED },
  });
}

/** Hibrit: teklif süresi bitmiş / SELECTION iken Al kapalı mı? */
export async function isBuyButtonOpen(listing: {
  status: string;
  endsAt?: Date | string | null;
  escrowEligible?: boolean | null;
}) {
  if (!listing.escrowEligible) return false;
  const rules = await getListingExpiryRules();
  if (!rules.buy.closesWhenBiddingEnds) return listing.status === "ACTIVE" || listing.status === "SELECTION";
  if (listing.status !== "ACTIVE") return false;
  if (!listing.endsAt) return true;
  return new Date(listing.endsAt).getTime() > Date.now();
}

export async function getBuyButtonLabel() {
  const rules = await getListingExpiryRules();
  return rules.buyButtonLabel || "Satın al";
}
