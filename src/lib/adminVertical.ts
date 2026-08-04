/**
 * Admin panel dikeyleri (Platform + 3 vertical).
 *
 * Teklif = bir ilana verilen bid/offer. Her dikey yalnızca kendi ilanlarına
 * ait teklifleri gösterir (listing.category dikey filtresiyle).
 */

export type AdminVertical = "emlak-vasita" | "alisveris" | "premium";

export const ADMIN_VERTICALS: AdminVertical[] = ["emlak-vasita", "alisveris", "premium"];

export const ADMIN_VERTICAL_META: Record<
  AdminVertical,
  { label: string; shortLabel: string; basePath: string; contentSlugPrefix: string }
> = {
  "emlak-vasita": {
    label: "Vasıta & Emlak",
    shortLabel: "Emlak / Vasıta",
    basePath: "/admin/emlak-vasita",
    contentSlugPrefix: "emlak-",
  },
  alisveris: {
    label: "Alışveriş",
    shortLabel: "Alışveriş",
    basePath: "/admin/alisveris",
    contentSlugPrefix: "alisveris-",
  },
  premium: {
    label: "Premium",
    shortLabel: "Premium",
    basePath: "/admin/premium",
    contentSlugPrefix: "premium-",
  },
};

/** İş / tarım / sanayi makineleri alışveriş değil; emlak-vasita altında. */
const MACHINE_SLUG_PARTS = ["is-makinesi", "tarim-makinesi", "sanayi-makinesi"] as const;

export function parseAdminVertical(s: string | null | undefined): AdminVertical | null {
  if (!s) return null;
  const v = s.trim().toLowerCase();
  if (v === "emlak-vasita" || v === "alisveris" || v === "premium") return v;
  return null;
}

function slugHasMachinePart(slug: string): boolean {
  return MACHINE_SLUG_PARTS.some((p) => slug.includes(p));
}

/** Alışveriş shop kökleri (makine altları hariç). */
export function isAlisverisCategorySlug(slug: string): boolean {
  if (slugHasMachinePart(slug)) return false;
  return slug.startsWith("ikinci-el") || slug.startsWith("sifir-urun") || slug === "diger";
}

export function isPremiumCategoryRow(cat: { slug?: string | null; isPremium?: boolean | null }): boolean {
  const slug = String(cat.slug || "");
  return Boolean(cat.isPremium) || slug.startsWith("premium-");
}

export function categoryMatchesVertical(
  cat: { slug?: string | null; isPremium?: boolean | null },
  vertical: AdminVertical
): boolean {
  const slug = String(cat.slug || "");
  const premium = isPremiumCategoryRow(cat);

  if (vertical === "premium") return premium;

  if (vertical === "alisveris") {
    if (premium) return false;
    return isAlisverisCategorySlug(slug);
  }

  // emlak-vasita: premium değil ve alışveriş (makinesiz) değil → klasik + makineler
  if (premium) return false;
  return !isAlisverisCategorySlug(slug);
}

/**
 * Prisma Category where for listings / bids filtering.
 * listingWhere.category = categoryWhereForVertical(v)
 */
export function categoryWhereForVertical(v: AdminVertical): Record<string, unknown> {
  const machineOr = MACHINE_SLUG_PARTS.map((p) => ({ slug: { contains: p } }));

  if (v === "premium") {
    return {
      OR: [{ isPremium: true }, { slug: { startsWith: "premium-" } }],
    };
  }

  if (v === "alisveris") {
    return {
      AND: [
        { isPremium: false },
        { NOT: { slug: { startsWith: "premium-" } } },
        {
          OR: [
            { slug: { startsWith: "ikinci-el" } },
            { slug: { startsWith: "sifir-urun" } },
            { slug: "diger" },
          ],
        },
        { NOT: { OR: machineOr } },
      ],
    };
  }

  // emlak-vasita: not premium, and not (alisveris without machines)
  return {
    AND: [
      { isPremium: false },
      { NOT: { slug: { startsWith: "premium-" } } },
      {
        NOT: {
          AND: [
            {
              OR: [
                { slug: { startsWith: "ikinci-el" } },
                { slug: { startsWith: "sifir-urun" } },
                { slug: "diger" },
              ],
            },
            { NOT: { OR: machineOr } },
          ],
        },
      },
    ],
  };
}

/** İçerik / reklam slug’larını dikeye göre süz (prefix yoksa hepsi geçer). */
export function contentMatchesVertical(slug: string, vertical: AdminVertical): boolean {
  const s = String(slug || "").toLowerCase();
  const prefix = ADMIN_VERTICAL_META[vertical].contentSlugPrefix;
  const otherPrefixes = ADMIN_VERTICALS.filter((x) => x !== vertical).map(
    (x) => ADMIN_VERTICAL_META[x].contentSlugPrefix
  );
  // Explicit vertical prefix → match
  if (s.startsWith(prefix)) return true;
  // Belongs to another vertical → exclude
  if (otherPrefixes.some((p) => s.startsWith(p))) return false;
  // Unprefixed / global → show under all verticals (caller may still show full panel)
  return true;
}
