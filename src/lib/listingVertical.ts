/**
 * İlan / katalog dikeyi çözümleme (emlak | vasita | alisveris | premium).
 * Esas kaynak: Category slug + path + parent zinciri; browse fallback.
 */

export type ListingVertical = "emlak" | "vasita" | "alisveris" | "premium" | "unknown";

export type VerticalCategoryInput = {
  slug?: string | null;
  path?: string | null;
  isPremium?: boolean | null;
  premiumVertical?: string | null;
  parentSlugs?: string[];
};

const EMLAK_ROOTS = new Set(["konut", "isyeri", "arsa", "kiralik", "emlak"]);
const VASITA_ROOTS = new Set(["arac", "vasita"]);
const MACHINE_PARTS = ["is-makinesi", "tarim-makinesi", "sanayi-makinesi"] as const;

function slugHasMachine(slug: string): boolean {
  return MACHINE_PARTS.some((p) => slug.includes(p));
}

function tokensFromCategory(cat: VerticalCategoryInput): string[] {
  const out: string[] = [];
  const push = (s?: string | null) => {
    const t = String(s || "").trim().toLowerCase();
    if (!t) return;
    out.push(t);
    for (const part of t.split(/[/_-]+/)) {
      if (part) out.push(part);
    }
  };
  push(cat.slug);
  push(cat.path);
  for (const p of cat.parentSlugs || []) push(p);
  return out;
}

function isShoppingSlug(slug: string): boolean {
  if (!slug) return false;
  if (slugHasMachine(slug)) return false;
  return (
    slug === "ikinci-el" ||
    slug === "sifir-urun" ||
    slug === "diger" ||
    slug.startsWith("ikinci-el") ||
    slug.startsWith("sifir-urun")
  );
}

/**
 * Senkron çözümleyici — category satırı + opsiyonel parent slug’ları ile.
 */
export function resolveListingVertical(
  cat: VerticalCategoryInput | null | undefined,
  opts?: {
    attributes?: Record<string, unknown> | null;
    listingKind?: string | null;
  }
): ListingVertical {
  const kind = String(opts?.listingKind || "").toLowerCase();
  if (kind === "premium") return "premium";
  if (kind === "alisveris") return "alisveris";
  if (kind === "genel") {
    // genel = emlak/vasıta; altını slug’dan ayır
  }

  if (!cat) return "unknown";

  const slug = String(cat.slug || "").toLowerCase();
  if (cat.isPremium || cat.premiumVertical || slug.startsWith("premium-")) {
    return "premium";
  }

  const tokens = tokensFromCategory(cat);
  const all = [slug, ...(cat.parentSlugs || []).map((s) => s.toLowerCase()), String(cat.path || "").toLowerCase()];

  // Alışveriş (makine hariç)
  if (all.some((s) => isShoppingSlug(s)) || tokens.some((t) => t === "ikinci" || t === "sifir")) {
    if (all.some((s) => slugHasMachine(s))) return "vasita";
    if (isShoppingSlug(slug) || (cat.path || "").includes("ikinci-el") || (cat.path || "").includes("sifir-urun")) {
      return "alisveris";
    }
  }

  // Makine / vasıta
  if (all.some((s) => slugHasMachine(s))) return "vasita";
  for (const t of tokens) {
    if (VASITA_ROOTS.has(t) || t === "otomobil" || t === "motosiklet") return "vasita";
  }
  if (slug === "arac" || slug.startsWith("arac-") || slug.startsWith("arac__")) return "vasita";

  // Emlak
  for (const t of tokens) {
    if (EMLAK_ROOTS.has(t)) return "emlak";
  }
  if (slug === "konut" || slug === "isyeri" || slug === "arsa" || slug === "kiralik") return "emlak";

  // Browse fallback via attributes (emlak subtype without deep DB children)
  const attrs = opts?.attributes || {};
  const subtype = String(attrs.subtype || "").toLowerCase();
  if (slug === "konut" || slug === "isyeri" || slug === "arsa") return "emlak";
  if (slug === "arac") return "vasita";
  if (kind === "genel" && subtype) {
    // genel formda konut/arac zaten yukarıda
  }

  // path segments
  const path = String(cat.path || "").toLowerCase();
  if (path.split("/").some((p) => EMLAK_ROOTS.has(p))) return "emlak";
  if (path.split("/").some((p) => VASITA_ROOTS.has(p))) return "vasita";
  if (path.includes("ikinci-el") || path.includes("sifir-urun")) return "alisveris";

  return "unknown";
}

/** Parent zincirini yükleyip dikey çöz. */
export async function resolveListingVerticalFromDb(opts: {
  categoryId?: string | null;
  categorySlug?: string | null;
  attributes?: Record<string, unknown> | null;
  listingKind?: string | null;
  /** Prisma client veya tx */
  db?: {
    category: {
      findFirst: (args: unknown) => Promise<{
        id: string;
        slug: string;
        path: string | null;
        isPremium: boolean;
        premiumVertical: string | null;
        parentId: string | null;
      } | null>;
    };
  };
}): Promise<ListingVertical> {
  const { prisma } = await import("@/lib/db");
  const db = opts.db || prisma;

  const where = opts.categoryId
    ? { id: String(opts.categoryId) }
    : opts.categorySlug
      ? { slug: String(opts.categorySlug) }
      : null;
  if (!where) return resolveListingVertical(null, opts);

  let cat = await db.category.findFirst({
    where: { ...where, deletedAt: null },
    select: {
      id: true,
      slug: true,
      path: true,
      isPremium: true,
      premiumVertical: true,
      parentId: true,
    },
  } as never);

  if (!cat) {
    // slug fallback without deletedAt filter
    cat = await db.category.findFirst({
      where,
      select: {
        id: true,
        slug: true,
        path: true,
        isPremium: true,
        premiumVertical: true,
        parentId: true,
      },
    } as never);
  }

  if (!cat) return "unknown";

  const parentSlugs: string[] = [];
  let parentId = cat.parentId;
  let guard = 0;
  while (parentId && guard++ < 12) {
    const parent = await db.category.findFirst({
      where: { id: parentId },
      select: { id: true, slug: true, parentId: true },
    } as never);
    if (!parent) break;
    parentSlugs.push(parent.slug);
    parentId = parent.parentId;
  }

  return resolveListingVertical(
    {
      slug: cat.slug,
      path: cat.path,
      isPremium: cat.isPremium,
      premiumVertical: cat.premiumVertical,
      parentSlugs,
    },
    { attributes: opts.attributes, listingKind: opts.listingKind }
  );
}

export function requiredSubtypeForVertical(vertical: ListingVertical): string | null {
  if (vertical === "emlak") return "EMLAK_OFISI";
  if (vertical === "vasita") return "GALERI";
  if (vertical === "alisveris") return "MAGAZA";
  if (vertical === "premium") return "OTEL"; // or LOJISTIK — generic label
  return null;
}
