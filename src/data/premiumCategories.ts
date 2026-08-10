/** Premium / kapasite dikeyleri — otel, lojistik, yolculuk paylaşımı */

export type PremiumVertical = "hotel" | "logistics" | "rideshare";

export type PremiumCategorySeed = {
  slug: string;
  name: string;
  icon: string;
  sortOrder: number;
  vertical: PremiumVertical;
  children: Array<{ slug: string; name: string; icon: string; sortOrder: number }>;
};

export const PREMIUM_VERTICAL_META: Record<
  PremiumVertical,
  { label: string; settingKey: string; description: string }
> = {
  hotel: {
    label: "Otel Konaklama",
    settingKey: "hotel",
    description: "Boş oda / son dakika konaklama teklifleri",
  },
  logistics: {
    label: "Lojistik Taşıma",
    settingKey: "logistics",
    description: "Parsiyel veya tam yük nakliye teklifleri",
  },
  rideshare: {
    label: "Yolculuk Paylaşımı",
    settingKey: "rideshare",
    description: "Şehir içi / şehirler arası koltuk paylaşımı",
  },
};

export const PREMIUM_CATEGORY_SEEDS: PremiumCategorySeed[] = [
  {
    slug: "premium-otel",
    name: "Otel Konaklama",
    icon: "hotel",
    sortOrder: 200,
    vertical: "hotel",
    children: [
      { slug: "standart-oda", name: "Standart Oda", icon: "bed", sortOrder: 1 },
      { slug: "suit", name: "Suit / Deluxe", icon: "bed", sortOrder: 2 },
      { slug: "gunluk-konaklama", name: "Günlük Konaklama", icon: "calendar", sortOrder: 3 },
      { slug: "son-dakika", name: "Son Dakika (16:00+)", icon: "clock", sortOrder: 4 },
    ],
  },
  {
    slug: "premium-lojistik",
    name: "Lojistik Taşıma",
    icon: "truck",
    sortOrder: 210,
    vertical: "logistics",
    children: [
      { slug: "parsiyel", name: "Parsiyel Yük", icon: "package", sortOrder: 1 },
      { slug: "tam-yuk", name: "Tam Yük", icon: "truck", sortOrder: 2 },
      { slug: "sehir-ici-nakliye", name: "Şehir İçi Nakliye", icon: "map", sortOrder: 3 },
      { slug: "sehirler-arasi-nakliye", name: "Şehirler Arası", icon: "map", sortOrder: 4 },
    ],
  },
  {
    slug: "premium-yolculuk",
    name: "Yolculuk Paylaşımı",
    icon: "users",
    sortOrder: 220,
    vertical: "rideshare",
    children: [
      { slug: "sehir-ici", name: "Şehir İçi", icon: "car", sortOrder: 1 },
      { slug: "sehirler-arasi", name: "Şehirler Arası", icon: "car", sortOrder: 2 },
      { slug: "havaalani", name: "Havaalanı Transfer", icon: "plane", sortOrder: 3 },
    ],
  },
];

export function isPremiumCategorySlug(slug?: string | null): boolean {
  if (!slug) return false;
  if (slug === "premium") return true;
  return slug.startsWith("premium-") || PREMIUM_CATEGORY_SEEDS.some((r) => slug.startsWith(r.slug));
}

export function premiumVerticalEnabled(
  enabled: Record<string, boolean> | null | undefined,
  vertical: PremiumVertical
): boolean {
  if (!enabled || typeof enabled !== "object") return true;
  return enabled[vertical] !== false;
}

export function anyPremiumVerticalEnabled(
  enabled: Record<string, boolean> | null | undefined
): boolean {
  return PREMIUM_CATEGORY_SEEDS.some((r) => premiumVerticalEnabled(enabled, r.vertical));
}

export function filterPremiumSeedsByEnabled(
  enabled: Record<string, boolean> | null | undefined
): PremiumCategorySeed[] {
  return PREMIUM_CATEGORY_SEEDS.filter((r) => premiumVerticalEnabled(enabled, r.vertical));
}

export function premiumVerticalFromSlug(slug?: string | null): PremiumVertical | null {
  if (!slug) return null;
  for (const root of PREMIUM_CATEGORY_SEEDS) {
    if (slug === root.slug || slug.startsWith(root.slug + "-")) return root.vertical;
  }
  return null;
}

export function childPremiumSlug(rootSlug: string, childSlug: string) {
  return `${rootSlug}-${childSlug}`;
}
