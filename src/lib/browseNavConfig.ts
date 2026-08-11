/** Sol menü / admin kategori ağacı — düğüm görünürlüğü, sıra ve menü adı. */

export type BrowseNavNodeState = {
  active?: boolean;
  sortOrder?: number;
  /** Sitede görünen menü adı (slug değişmez) */
  label?: string;
  /** Alışveriş PDP «Kargo & İade» sekmesindeki iade paragrafı */
  returnPolicyText?: string;
};

export type BrowseNavConfig = {
  /** true ⇒ ilanı olmayanlar ilan açılana kadar sitede görünmez */
  hideEmptyUntilListing: boolean;
  /**
   * Sahibinden tarzı: bir dal açılınca kardeş kökler gizlenir;
   * aynı satıra tekrar tıklanınca bir üst seviyeye dönülür.
   */
  sahibindenTreeExpand: boolean;
  nodes: Record<string, BrowseNavNodeState>;
};

export const DEFAULT_BROWSE_NAV_CONFIG: BrowseNavConfig = {
  hideEmptyUntilListing: true,
  sahibindenTreeExpand: true,
  nodes: {},
};

export function normalizeBrowseNavConfig(raw: unknown): BrowseNavConfig {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ...DEFAULT_BROWSE_NAV_CONFIG, nodes: {} };
  }
  const o = raw as Record<string, unknown>;
  const nodesRaw = o.nodes;
  const nodes: Record<string, BrowseNavNodeState> = {};
  if (nodesRaw && typeof nodesRaw === "object" && !Array.isArray(nodesRaw)) {
    for (const [k, v] of Object.entries(nodesRaw as Record<string, unknown>)) {
      if (!k || !v || typeof v !== "object" || Array.isArray(v)) continue;
      const n = v as Record<string, unknown>;
      const entry: BrowseNavNodeState = {};
      if (typeof n.active === "boolean") entry.active = n.active;
      if (typeof n.sortOrder === "number" && Number.isFinite(n.sortOrder)) {
        entry.sortOrder = n.sortOrder;
      }
      if (typeof n.label === "string") {
        const label = n.label.trim();
        if (label) entry.label = label;
      }
      if (typeof n.returnPolicyText === "string") {
        const returnPolicyText = n.returnPolicyText.trim();
        if (returnPolicyText) entry.returnPolicyText = returnPolicyText;
      }
      if (
        entry.active !== undefined ||
        entry.sortOrder !== undefined ||
        entry.label !== undefined ||
        entry.returnPolicyText !== undefined
      ) {
        nodes[k] = entry;
      }
    }
  }
  return {
    hideEmptyUntilListing: o.hideEmptyUntilListing !== false,
    /** Varsayılan açık — yalnızca açıkça false ise accordion */
    sahibindenTreeExpand: o.sahibindenTreeExpand !== false,
    nodes,
  };
}

/** Örn. arac/otomobil, arac/otomobil/bmw, konut/daire, premium/hotel */
export function browseNodeKey(...parts: string[]): string {
  return parts
    .map((p) => String(p || "").trim())
    .filter(Boolean)
    .join("/");
}

export function aracSubtypeKey(subtype: string) {
  return browseNodeKey("arac", subtype);
}

export function aracBrandKey(subtype: string, brand: string) {
  return browseNodeKey("arac", subtype, brand);
}

export function aracModelKey(subtype: string, brand: string, model: string) {
  return browseNodeKey("arac", subtype, brand, model);
}

export function konutSubtypeKey(subtype: string) {
  return browseNodeKey("konut", subtype);
}

export function premiumNodeKey(vertical: string, childSlug?: string) {
  return childSlug ? browseNodeKey("premium", vertical, childSlug) : browseNodeKey("premium", vertical);
}

/** Varsayılan aktif — yalnızca açıkça false ise pasif */
export function isNodeActive(config: BrowseNavConfig | null | undefined, key: string): boolean {
  if (!key) return true;
  const n = config?.nodes?.[key];
  if (!n || n.active === undefined) return true;
  return n.active !== false;
}

/** Kayıtlı sıra yoksa katalog indeksi × 10 */
export function sortOrderFor(
  config: BrowseNavConfig | null | undefined,
  key: string,
  fallbackIndex: number
): number {
  const n = config?.nodes?.[key];
  if (n && typeof n.sortOrder === "number" && Number.isFinite(n.sortOrder)) {
    return n.sortOrder;
  }
  return fallbackIndex * 10;
}

/** Kayıtlı menü adı yoksa katalog / varsayılan ad */
export function displayNameFor(
  config: BrowseNavConfig | null | undefined,
  key: string,
  fallback: string
): string {
  if (!key) return fallback;
  const label = config?.nodes?.[key]?.label;
  if (typeof label === "string" && label.trim()) return label.trim();
  return fallback;
}

/**
 * BrowseFilter / NavNode id’sinden config anahtarı.
 * Konut alt tipleri dealType yolundan bağımsız `konut/{subtype}` kullanır.
 */
export function keyFromBrowseFilter(filter: {
  category?: string;
  subtype?: string;
  brand?: string;
  model?: string;
  trim?: string;
}): string | null {
  const cat = String(filter.category || "").split(",")[0]?.trim() || "";
  const subtype = String(filter.subtype || "").trim();
  const brand = String(filter.brand || "").trim();
  const model = String(filter.model || "").trim();
  const trim = String(filter.trim || "").trim();

  if (cat === "arac" && subtype) {
    if (trim && brand && model) return browseNodeKey("arac", subtype, brand, model, trim);
    if (model && brand) return aracModelKey(subtype, brand, model);
    if (brand) return aracBrandKey(subtype, brand);
    return aracSubtypeKey(subtype);
  }

  if ((cat === "konut" || cat === "kiralik") && subtype) {
    return konutSubtypeKey(subtype);
  }

  if (cat.startsWith("premium-")) {
    // id zaten premium/{vertical}/… ise çağıran id kullanmalı
    return null;
  }

  return null;
}

/** Nav düğümü id’si config anahtarıysa onu kullan; değilse filter’dan türet */
export function resolveBrowseNodeKey(
  id: string,
  filter: {
    category?: string;
    subtype?: string;
    brand?: string;
    model?: string;
    trim?: string;
  }
): string {
  if (id.startsWith("premium/")) return id;
  if (id.startsWith("arac/") && filter.category === "arac") return id;
  const fromFilter = keyFromBrowseFilter(filter);
  if (fromFilter) return fromFilter;
  return id;
}

/** Alışveriş DB leaf → browse nav anahtarı */
export function shopLeafNodeKey(categorySlug: string) {
  return browseNodeKey("shop", "leaf", String(categorySlug || "").trim());
}

/** İkinci el alışveriş kategorisi (sıfır ürün değil) */
export function isShoppingSecondHandSlug(categorySlug?: string | null): boolean {
  const slug = String(categorySlug || "").trim().toLowerCase();
  if (!slug) return false;
  return slug === "ikinci-el" || slug.startsWith("ikinci-el-") || slug.startsWith("ikinci-el__");
}

export function returnPolicyTextForShopSlug(
  config: BrowseNavConfig | null | undefined,
  categorySlug?: string | null
): string | null {
  const slug = String(categorySlug || "").trim();
  if (!slug) return null;
  const text = config?.nodes?.[shopLeafNodeKey(slug)]?.returnPolicyText;
  if (typeof text === "string" && text.trim()) return text.trim();
  return null;
}
