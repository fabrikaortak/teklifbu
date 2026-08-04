import { prisma } from "@/lib/db";
import { getSetting } from "@/core/settings";
import { resolveListingFee, type ListingFeeDecision } from "@/core/services/listingFeeService";
import { buildListingFeeInvoice, type ListingFeeInvoice } from "@/lib/listingFeeInvoice";

export type PremiumOptions = {
  titleBold?: boolean;
  titleLarge?: boolean;
  isColored?: boolean;
  /** 0 | 3 | 7 */
  featuredDays?: number;
};

export type PremiumPrices = {
  titleBoldTl: number;
  titleLargeTl: number;
  coloredTl: number;
  feature3dTl: number;
  feature7dTl: number;
};

export type PremiumTokenPrices = {
  titleBoldTokens: number;
  titleLargeTokens: number;
  coloredTokens: number;
  feature3dTokens: number;
  feature7dTokens: number;
};

export type ListingTotalFee = ListingFeeDecision & {
  baseFeeTl: number;
  premiumFeeTl: number;
  premiumBreakdown: Array<{ key: string; label: string; amountTl: number }>;
  totalFeeTl: number;
  invoice: ListingFeeInvoice;
};

export async function getPremiumPrices(): Promise<PremiumPrices> {
  const [titleBoldTl, titleLargeTl, coloredTl, feature3dTl, feature7dTl] = await Promise.all([
    getSetting<number>("premium_title_bold_tl", 49),
    getSetting<number>("premium_title_large_tl", 49),
    getSetting<number>("premium_colored_tl", 79),
    getSetting<number>("premium_feature_3d_tl", 149),
    getSetting<number>("premium_feature_7d_tl", 249),
  ]);
  return {
    titleBoldTl: Math.max(0, Number(titleBoldTl) || 0),
    titleLargeTl: Math.max(0, Number(titleLargeTl) || 0),
    coloredTl: Math.max(0, Number(coloredTl) || 0),
    feature3dTl: Math.max(0, Number(feature3dTl) || 0),
    feature7dTl: Math.max(0, Number(feature7dTl) || 0),
  };
}

export async function getPremiumTokenPrices(): Promise<PremiumTokenPrices> {
  const [titleBoldTokens, titleLargeTokens, coloredTokens, feature3dTokens, feature7dTokens] =
    await Promise.all([
      getSetting<number>("premium_title_bold_tokens", 5),
      getSetting<number>("premium_title_large_tokens", 5),
      getSetting<number>("premium_colored_tokens", 8),
      getSetting<number>("premium_feature_3d_tokens", 15),
      getSetting<number>("premium_feature_7d_tokens", 25),
    ]);
  return {
    titleBoldTokens: Math.max(0, Math.floor(Number(titleBoldTokens) || 0)),
    titleLargeTokens: Math.max(0, Math.floor(Number(titleLargeTokens) || 0)),
    coloredTokens: Math.max(0, Math.floor(Number(coloredTokens) || 0)),
    feature3dTokens: Math.max(0, Math.floor(Number(feature3dTokens) || 0)),
    feature7dTokens: Math.max(0, Math.floor(Number(feature7dTokens) || 0)),
  };
}

export async function isPremiumPayWithTokensEnabled(): Promise<boolean> {
  const { isPaymentTokensOnly } = await import("@/core/services/paymentModeService");
  if (await isPaymentTokensOnly()) return true;
  return (await getSetting<boolean>("premium_pay_with_tokens_enabled", false)) === true;
}

export function normalizePremium(raw: PremiumOptions | null | undefined): Required<PremiumOptions> {
  const days = Number(raw?.featuredDays || 0);
  return {
    titleBold: Boolean(raw?.titleBold),
    titleLarge: Boolean(raw?.titleLarge),
    isColored: Boolean(raw?.isColored),
    featuredDays: days === 7 || days === 3 ? days : 0,
  };
}

export function calcPremiumFeeTl(premium: Required<PremiumOptions>, prices: PremiumPrices) {
  const breakdown: Array<{ key: string; label: string; amountTl: number }> = [];
  if (premium.titleBold && prices.titleBoldTl > 0) {
    breakdown.push({ key: "titleBold", label: "Kalın başlık", amountTl: prices.titleBoldTl });
  }
  if (premium.titleLarge && prices.titleLargeTl > 0) {
    breakdown.push({ key: "titleLarge", label: "Büyük harf başlık", amountTl: prices.titleLargeTl });
  }
  if (premium.isColored && prices.coloredTl > 0) {
    breakdown.push({ key: "isColored", label: "Renkli ilan", amountTl: prices.coloredTl });
  }
  if (premium.featuredDays === 3 && prices.feature3dTl > 0) {
    breakdown.push({ key: "feature3d", label: "3 gün ana sayfa", amountTl: prices.feature3dTl });
  }
  if (premium.featuredDays === 7 && prices.feature7dTl > 0) {
    breakdown.push({ key: "feature7d", label: "7 gün ana sayfa", amountTl: prices.feature7dTl });
  }
  const premiumFeeTl = breakdown.reduce((s, x) => s + x.amountTl, 0);
  return { premiumFeeTl, premiumBreakdown: breakdown };
}

export function calcPremiumFeeTokens(
  premium: Required<PremiumOptions>,
  prices: PremiumTokenPrices,
  discountPercent = 0
) {
  const breakdown: Array<{ key: string; label: string; tokens: number }> = [];
  if (premium.titleBold && prices.titleBoldTokens > 0) {
    breakdown.push({ key: "titleBold", label: "Kalın başlık", tokens: prices.titleBoldTokens });
  }
  if (premium.titleLarge && prices.titleLargeTokens > 0) {
    breakdown.push({ key: "titleLarge", label: "Büyük harf başlık", tokens: prices.titleLargeTokens });
  }
  if (premium.isColored && prices.coloredTokens > 0) {
    breakdown.push({ key: "isColored", label: "Renkli ilan", tokens: prices.coloredTokens });
  }
  if (premium.featuredDays === 3 && prices.feature3dTokens > 0) {
    breakdown.push({ key: "feature3d", label: "3 gün ana sayfa", tokens: prices.feature3dTokens });
  }
  if (premium.featuredDays === 7 && prices.feature7dTokens > 0) {
    breakdown.push({ key: "feature7d", label: "7 gün ana sayfa", tokens: prices.feature7dTokens });
  }
  const raw = breakdown.reduce((s, x) => s + x.tokens, 0);
  const pct = Math.max(0, Math.min(100, Number(discountPercent) || 0));
  const premiumFeeTokens = pct > 0 ? Math.max(0, Math.ceil(raw * (1 - pct / 100))) : raw;
  return { premiumFeeTokens, premiumTokenBreakdown: breakdown };
}

/** Temel ilan ücreti (premium hariç) — jetonla premium ödendikten sonra POS tutarı. */
export async function resolveListingBaseFeeOnly(userId: string): Promise<ListingTotalFee> {
  return resolveListingTotalFee(userId, {
    titleBold: false,
    titleLarge: false,
    isColored: false,
    featuredDays: 0,
  });
}

async function getCorporatePremiumDiscount(userId: string): Promise<{
  percent: number;
  packageName: string | null;
}> {
  const sub = await prisma.shopSubscription.findFirst({
    where: {
      userId,
      isActive: true,
      endsAt: { gt: new Date() },
    },
    include: {
      package: { select: { name: true, premiumDiscountPercent: true, isActive: true } },
    },
  });
  if (!sub?.package?.isActive) return { percent: 0, packageName: null };
  const percent = Math.max(0, Math.min(100, Number(sub.package.premiumDiscountPercent) || 0));
  return { percent, packageName: sub.package.name || null };
}

/** Temel ilan ücreti + seçilen premium özellikler (+ kurumsal indirim + KDV) */
export async function resolveListingTotalFee(
  userId: string,
  premiumRaw?: PremiumOptions | null
): Promise<ListingTotalFee> {
  const base = await resolveListingFee(userId);
  const prices = await getPremiumPrices();
  const premium = normalizePremium(premiumRaw);
  const { premiumFeeTl, premiumBreakdown } = calcPremiumFeeTl(premium, prices);
  const baseFeeTl = base.requiresFee ? base.feeTl : 0;

  const [corp, vatPercent, pricesIncludeVat] = await Promise.all([
    getCorporatePremiumDiscount(userId),
    getSetting<number>("listing_fee_vat_percent", 20),
    getSetting<boolean>("listing_fee_prices_include_vat", true),
  ]);

  const invoice = buildListingFeeInvoice({
    baseFeeTl,
    premiumBreakdown,
    corporateDiscountPercent: corp.percent,
    packageName: corp.packageName,
    vatPercent: Number(vatPercent) || 0,
    pricesIncludeVat: pricesIncludeVat !== false,
  });

  const totalFeeTl = invoice.payableTl;
  return {
    ...base,
    baseFeeTl,
    premiumFeeTl,
    premiumBreakdown,
    totalFeeTl,
    feeTl: totalFeeTl,
    requiresFee: totalFeeTl > 0,
    invoice,
  };
}

/** Premium özelliklerin jeton maliyeti (kurumsal indirim dahil). */
export async function quotePremiumTokensForUser(
  userId: string,
  premiumRaw?: PremiumOptions | null
): Promise<{
  enabled: boolean;
  premiumFeeTokens: number;
  premiumTokenBreakdown: Array<{ key: string; label: string; tokens: number }>;
  discountPercent: number;
}> {
  const enabled = await isPremiumPayWithTokensEnabled();
  if (!enabled) {
    return { enabled: false, premiumFeeTokens: 0, premiumTokenBreakdown: [], discountPercent: 0 };
  }
  const premium = normalizePremium(premiumRaw);
  const [prices, corp] = await Promise.all([
    getPremiumTokenPrices(),
    getCorporatePremiumDiscount(userId),
  ]);
  const { premiumFeeTokens, premiumTokenBreakdown } = calcPremiumFeeTokens(
    premium,
    prices,
    corp.percent
  );
  return {
    enabled: true,
    premiumFeeTokens,
    premiumTokenBreakdown,
    discountPercent: corp.percent,
  };
}

/**
 * İlan ücreti jeton teklifi.
 * - Yalnızca jeton: tüm ödenecek TL (KDV/indirim dahil) jetona çevrilir.
 * - Aksi halde: yalnızca premium özellik jeton fiyatları.
 */
export async function quoteListingFeeTokensForUser(
  userId: string,
  premiumRaw?: PremiumOptions | null
): Promise<{
  enabled: boolean;
  tokensOnly: boolean;
  totalFeeTokens: number;
  baseFeeTokens: number;
  premiumFeeTokens: number;
  premiumTokenBreakdown: Array<{ key: string; label: string; tokens: number }>;
}> {
  const { isPaymentTokensOnly, convertTlToTokens } = await import(
    "@/core/services/paymentModeService"
  );
  const tokensOnly = await isPaymentTokensOnly();
  const premiumQuote = await quotePremiumTokensForUser(userId, premiumRaw);

  if (tokensOnly) {
    const fee = await resolveListingTotalFee(userId, premiumRaw);
    const totalFeeTokens =
      fee.totalFeeTl > 0 ? await convertTlToTokens(fee.totalFeeTl) : 0;
    return {
      enabled: totalFeeTokens > 0,
      tokensOnly: true,
      totalFeeTokens,
      baseFeeTokens: totalFeeTokens,
      premiumFeeTokens: 0,
      premiumTokenBreakdown: [],
    };
  }

  if (!premiumQuote.enabled) {
    return {
      enabled: false,
      tokensOnly: false,
      totalFeeTokens: 0,
      baseFeeTokens: 0,
      premiumFeeTokens: 0,
      premiumTokenBreakdown: [],
    };
  }

  return {
    enabled: true,
    tokensOnly: false,
    totalFeeTokens: premiumQuote.premiumFeeTokens,
    baseFeeTokens: 0,
    premiumFeeTokens: premiumQuote.premiumFeeTokens,
    premiumTokenBreakdown: premiumQuote.premiumTokenBreakdown,
  };
}


