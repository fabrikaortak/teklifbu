/** Üst kategori bazlı satıcı kimliği / iletişim / mesajlaşma erişimi */

export type CategoryAccessMode = "approved" | "logged_in";

export type CategoryAccessRule = {
  /** İlan sahibi adı / şirket bilgisi ne zaman görünür */
  identity: CategoryAccessMode;
  /** Telefon ne zaman görünür */
  contact: CategoryAccessMode;
  /** Mesaj gönderme ne zaman açılır */
  messaging: CategoryAccessMode;
};

export const CATEGORY_ACCESS_MODES: Array<{ value: CategoryAccessMode; label: string }> = [
  { value: "approved", label: "Teklif onayından sonra" },
  { value: "logged_in", label: "Giriş yapan herkese (onaysız)" },
];

export const DEFAULT_CATEGORY_ACCESS_RULE: CategoryAccessRule = {
  identity: "approved",
  contact: "approved",
  messaging: "approved",
};

/** Üst kategori varsayılanları — admin sonra değiştirir */
export const DEFAULT_SELLER_VISIBILITY_BY_CATEGORY: Record<string, CategoryAccessRule> = {
  konut: { ...DEFAULT_CATEGORY_ACCESS_RULE },
  arac: { ...DEFAULT_CATEGORY_ACCESS_RULE },
  isyeri: { ...DEFAULT_CATEGORY_ACCESS_RULE },
  arsa: { ...DEFAULT_CATEGORY_ACCESS_RULE },
  kiralik: { ...DEFAULT_CATEGORY_ACCESS_RULE },
  // Alışveriş / teknoloji: onaysız iletişim & mesaj
  "ikinci-el": { identity: "logged_in", contact: "logged_in", messaging: "logged_in" },
  "sifir-urun": { identity: "logged_in", contact: "logged_in", messaging: "logged_in" },
  "premium-otel": { ...DEFAULT_CATEGORY_ACCESS_RULE },
  "premium-lojistik": { ...DEFAULT_CATEGORY_ACCESS_RULE },
  "premium-yolculuk": { ...DEFAULT_CATEGORY_ACCESS_RULE },
};

export function normalizeAccessMode(v: unknown): CategoryAccessMode {
  return String(v || "").toLowerCase() === "logged_in" ? "logged_in" : "approved";
}

export function parseCategoryAccessRule(raw: unknown): CategoryAccessRule {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ...DEFAULT_CATEGORY_ACCESS_RULE };
  }
  const o = raw as Record<string, unknown>;
  return {
    identity: normalizeAccessMode(o.identity),
    contact: normalizeAccessMode(o.contact),
    messaging: normalizeAccessMode(o.messaging),
  };
}

export function getCategoryAccessRule(
  map: Record<string, unknown> | null | undefined,
  topSlug: string | null | undefined
): CategoryAccessRule {
  const slug = String(topSlug || "").trim();
  if (!slug) return { ...DEFAULT_CATEGORY_ACCESS_RULE };
  const fromMap = map && typeof map === "object" ? map[slug] : undefined;
  if (fromMap) return parseCategoryAccessRule(fromMap);
  if (DEFAULT_SELLER_VISIBILITY_BY_CATEGORY[slug]) {
    return { ...DEFAULT_SELLER_VISIBILITY_BY_CATEGORY[slug] };
  }
  return { ...DEFAULT_CATEGORY_ACCESS_RULE };
}

/** listing.category → üst kategori slug (parent varsa parent, yoksa kendisi) */
export function resolveTopCategorySlug(category?: {
  slug?: string | null;
  parentId?: string | null;
  parent?: { slug?: string | null } | null;
} | null): string | null {
  if (!category) return null;
  if (category.parent?.slug) return category.parent.slug;
  const slug = String(category.slug || "").trim();
  if (!slug) return null;
  // Parent join yoksa shop alt slug'larından kök çıkar
  if (slug.startsWith("ikinci-el-")) return "ikinci-el";
  if (slug.startsWith("sifir-urun-")) return "sifir-urun";
  if (slug.startsWith("premium-")) {
    const parts = slug.split("-");
    if (parts.length >= 2) return `premium-${parts[1]}`;
  }
  return slug;
}

export function accessAllows(
  mode: CategoryAccessMode,
  ctx: { loggedIn: boolean; hasApprovedDeal: boolean; isSellerOrAdmin: boolean }
): boolean {
  if (ctx.isSellerOrAdmin) return true;
  if (!ctx.loggedIn) return false;
  if (mode === "logged_in") return true;
  return ctx.hasApprovedDeal;
}
