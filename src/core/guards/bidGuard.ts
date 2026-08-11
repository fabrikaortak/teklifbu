import { prisma } from "@/lib/db";
import { getSettingsMap } from "@/core/settings";
import {
  amountMatchesBidStep,
  effectiveBidStep,
  resolveVerticalBidRules,
} from "@/core/services/bidRulesService";

export type GuardResult =
  | { allowed: true }
  | {
      allowed: false;
      reason: string;
      code?: string;
      requiredTokens?: number;
      balance?: number;
    };

export async function guardPlaceBid(params: {
  listingId: string;
  bidderId: string;
  amount: number;
  durationDays: number;
}): Promise<
  GuardResult & {
    settings?: Record<string, unknown>;
    listing?: Awaited<ReturnType<typeof prisma.listing.findUnique>>;
    tokenCost?: number;
    bidNumber?: number;
  }
> {
  const settings = await getSettingsMap();
  const listing = await prisma.listing.findUnique({
    where: { id: params.listingId },
    include: { category: true, bids: { where: { bidderId: params.bidderId }, orderBy: { createdAt: "asc" } } },
  });
  if (!listing) return { allowed: false, reason: "İlan bulunamadı" };
  if (listing.status !== "ACTIVE") return { allowed: false, reason: "İlan teklife kapalı" };
  if (listing.endsAt && listing.endsAt.getTime() < Date.now()) {
    return { allowed: false, reason: "İlan süresi dolmuş" };
  }
  if (listing.sellerId === params.bidderId) {
    return { allowed: false, reason: "Kendi ilanınıza teklif veremezsiniz" };
  }

  const { assertTrustAllowsBid } = await import("@/core/services/trustScoreService");
  const trust = await assertTrustAllowsBid(params.bidderId);
  if (!trust.ok) {
    return { allowed: false, reason: trust.error, code: trust.code };
  }

  const rules = resolveVerticalBidRules(listing.category.slug, settings);
  const step = effectiveBidStep(rules, listing.category.slug);
  if (!amountMatchesBidStep(params.amount, step)) {
    const stepLabel =
      step < 1
        ? step.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : step.toLocaleString("tr-TR");
    return { allowed: false, reason: `Teklif ${stepLabel} TL ve katları olmalıdır` };
  }

  const requireHigher = rules.requireHigherThanHighest;
  const highest = Number(listing.highestBid);
  if (requireHigher && highest > 0 && params.amount <= highest) {
    return { allowed: false, reason: "Teklif mevcut en yüksek tekliften yüksek olmalıdır" };
  }

  const maxBids = rules.maxBidsPerUserPerListing;
  const attemptCount = listing.bids.length;
  const replaces = rules.secondBidReplacesPrevious;
  if (!replaces && attemptCount >= maxBids) {
    return { allowed: false, reason: `Bu ilana en fazla ${maxBids} teklif verebilirsiniz` };
  }
  if (replaces && attemptCount >= maxBids) {
    return { allowed: false, reason: `Bu ilana en fazla ${maxBids} teklif hakkınız doldu` };
  }

  const bidNumber = attemptCount + 1;
  if (bidNumber > 1 && rules.secondBidMustBeHigher) {
    const last = listing.bids[listing.bids.length - 1];
    if (last && params.amount <= Number(last.amount)) {
      return { allowed: false, reason: "Yeni teklifiniz önceki teklifinizden yüksek olmalıdır" };
    }
  }

  const options = rules.durationOptionsDays;
  if (!options.includes(params.durationDays)) {
    return { allowed: false, reason: "Geçersiz teklif süresi" };
  }

  const canExceed = rules.canExceedListingEnd;
  const policy = rules.exceedPolicy;
  if (listing.endsAt && !canExceed && policy === "block") {
    const bidEnd = Date.now() + params.durationDays * 24 * 60 * 60 * 1000;
    if (bidEnd > listing.endsAt.getTime()) {
      return { allowed: false, reason: "Teklif süresi ilan bitişini aşamaz" };
    }
  }

  const costByCat = (settings.token_cost_by_category as Record<string, number>) || {};
  const costByNum = (settings.token_cost_by_bid_number as Record<string, number>) || {};
  const base = Number(settings.token_cost_base ?? 1);
  const tokenCost = Number(
    costByNum[String(bidNumber)] ?? costByCat[listing.category.slug] ?? base
  );

  const bidder = await prisma.user.findUnique({ where: { id: params.bidderId } });
  if (!bidder) return { allowed: false, reason: "Kullanıcı bulunamadı" };
  if (!bidder.phoneVerified) return { allowed: false, reason: "Telefon doğrulaması gerekli" };
  if (bidder.tokenBalance < tokenCost) {
    return {
      allowed: false,
      reason: `Yetersiz jeton (gerekli: ${tokenCost}, bakiyeniz: ${bidder.tokenBalance})`,
      code: "INSUFFICIENT_TOKENS",
      requiredTokens: tokenCost,
      balance: bidder.tokenBalance,
    };
  }

  return { allowed: true, settings, listing, tokenCost, bidNumber };
}
