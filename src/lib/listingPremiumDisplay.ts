/** Premium başlık gösterimi: büyük harf = Türkçe UPPERCASE */
export function formatPremiumTitle(
  title: string,
  opts?: { titleLarge?: boolean | null } | null
): string {
  const t = String(title || "");
  if (opts?.titleLarge) return t.toLocaleUpperCase("tr-TR");
  return t;
}

export type PremiumBadgeRule =
  | "never"
  | "paid"
  | "store"
  | "featured"
  | "premium_2"
  | "premium_3"
  | "premium_4";

export type PremiumBadgeListing = {
  titleBold?: boolean | null;
  titleLarge?: boolean | null;
  isColored?: boolean | null;
  featuredDays?: number | null;
  isFeatured?: boolean | null;
  featuredUntil?: string | Date | null;
  shopId?: string | null;
};

/** İlan verirken seçilebilen 4 premium özellik */
export function countPremiumFeatures(listing: PremiumBadgeListing): number {
  let n = 0;
  if (listing.titleBold) n += 1;
  if (listing.titleLarge) n += 1;
  if (listing.isColored) n += 1;
  if ((listing.featuredDays || 0) > 0) n += 1;
  return n;
}

export function isFeaturedHomepageActive(listing: PremiumBadgeListing): boolean {
  if (listing.isFeatured) return true;
  if (listing.featuredUntil && new Date(listing.featuredUntil).getTime() > Date.now()) return true;
  return false;
}

/**
 * Admin `premium_badge_rule` ayarına göre Premium rozeti.
 * - paid: ilan ücreti / POS ödemesi yapılmış
 * - store: mağaza ilanı (shopId veya emlakçı/galerici)
 * - featured: ana sayfa öne çıkarma aktif
 * - premium_N: en az N premium özellik alınmış
 */
export function shouldShowPremiumBadge(
  listing: PremiumBadgeListing,
  rule: string | null | undefined,
  opts?: { isPaid?: boolean; isStore?: boolean }
): boolean {
  const r = (rule || "premium_3") as PremiumBadgeRule;
  switch (r) {
    case "never":
      return false;
    case "paid":
      return Boolean(opts?.isPaid);
    case "store":
      return Boolean(opts?.isStore || listing.shopId);
    case "featured":
      return isFeaturedHomepageActive(listing) || (listing.featuredDays || 0) > 0;
    case "premium_2":
      return countPremiumFeatures(listing) >= 2;
    case "premium_3":
      return countPremiumFeatures(listing) >= 3;
    case "premium_4":
      return countPremiumFeatures(listing) >= 4;
    default:
      return countPremiumFeatures(listing) >= 3;
  }
}
