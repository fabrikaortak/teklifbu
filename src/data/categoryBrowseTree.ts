import { SHOP_SUBCATEGORIES, childSlug } from "@/data/shopCategories";
import { shopChildrenFor } from "@/data/shopBrowseChildren";
import {
  brandsForSubtype,
  modelRequiresTrim,
  modelsForBrand,
} from "@/data/vehicleCatalog";
import { PREMIUM_CATEGORY_SEEDS, childPremiumSlug } from "@/data/premiumCategories";
import { buildVasitaBrowseNode } from "@/lib/vasitaBrowseFromTarget";

/** Sol menü + URL filtresi eşlemesi (Sahibinden tarzı). */
export type BrowseFilter = {
  category?: string;
  dealType?: "SATILIK" | "KIRALIK" | "DEVREN_SATILIK" | "DEVREN_KIRALIK" | "";
  /** attributes.subtype — daire, villa, otomobil… */
  subtype?: string;
  /** attributes.rentalPeriod — gunluk */
  rental?: "gunluk" | "";
  brand?: string;
  model?: string;
  trim?: string;
};

export type BrowseNode = {
  id: string;
  name: string;
  filter: BrowseFilter;
  children?: BrowseNode[];
  /** Sol menüde «Durumu» gibi ayırıcı başlık (tıklanmaz) */
  kind?: "section";
};

const KONUT_TYPES: Array<{ slug: string; name: string }> = [
  { slug: "daire", name: "Daire" },
  { slug: "residence", name: "Residence" },
  { slug: "mustakil-ev", name: "Müstakil Ev" },
  { slug: "villa", name: "Villa" },
  { slug: "ciftlik-evi", name: "Çiftlik Evi" },
  { slug: "kosk-konak", name: "Köşk & Konak" },
  { slug: "yali", name: "Yalı" },
  { slug: "yali-dairesi", name: "Yalı Dairesi" },
  { slug: "yazlik", name: "Yazlık" },
  { slug: "prefabrik-ev", name: "Prefabrik Ev" },
  { slug: "kooperatif", name: "Kooperatif" },
];

const GUNLUK_TYPES: Array<{ slug: string; name: string }> = [
  { slug: "daire", name: "Daire" },
  { slug: "residence", name: "Residence" },
  { slug: "mustakil-ev", name: "Müstakil Ev" },
  { slug: "villa", name: "Villa" },
  { slug: "yazlik", name: "Yazlık" },
  { slug: "apart", name: "Apart" },
];

const ISYERI_TYPES: Array<{ slug: string; name: string }> = [
  { slug: "buro-ofis", name: "Büro & Ofis" },
  { slug: "dukkan-magaza", name: "Dükkan & Mağaza" },
  { slug: "plaza", name: "Plaza" },
  { slug: "depo-antrepo", name: "Depo & Antrepo" },
  { slug: "fabrika", name: "Fabrika & Üretim Tesisi" },
  { slug: "atolye", name: "Atölye" },
  { slug: "avm", name: "Alışveriş Merkezi" },
  { slug: "cafe-restoran", name: "Cafe & Restoran" },
  { slug: "spa-salon", name: "Spa, Salon & Spor" },
  { slug: "eczane", name: "Eczane" },
  { slug: "yeni-isyeri", name: "Diğer İşyeri" },
];

const ARSA_TYPES: Array<{ slug: string; name: string }> = [
  { slug: "imarli", name: "İmarlı" },
  { slug: "tarla", name: "Tarla" },
  { slug: "bahce", name: "Bahçe" },
  { slug: "bag", name: "Bağ" },
  { slug: "sera", name: "Sera" },
  { slug: "ciftlik", name: "Çiftlik" },
  { slug: "zeytinlik", name: "Zeytinlik" },
  { slug: "denize-sifir", name: "Denize Sıfır" },
];

const ARAC_TYPES: Array<{ slug: string; name: string }> = [
  { slug: "otomobil", name: "Otomobil" },
  { slug: "arazi-suv-pickup", name: "Arazi, SUV & Pickup" },
  { slug: "elektrikli-araclar", name: "Elektrikli Araçlar" },
  { slug: "motosiklet", name: "Motosiklet" },
  { slug: "minivan-panelvan", name: "Minivan & Panelvan" },
  { slug: "ticari-araclar", name: "Ticari Araçlar" },
  { slug: "kiralik-araclar", name: "Kiralık Araçlar" },
  { slug: "deniz-araclari", name: "Deniz Araçları" },
  { slug: "hasarli-araclar", name: "Hasarlı Araçlar" },
  { slug: "karavan", name: "Karavan" },
  { slug: "klasik-araclar", name: "Klasik Araçlar" },
  { slug: "hava-araclari", name: "Hava Araçları" },
  { slug: "ucak", name: "Uçak" },
  { slug: "atv", name: "ATV" },
  { slug: "utv", name: "UTV" },
  { slug: "engelli-plakali", name: "Engelli Plakalı Araçlar" },
];

function leafNodes(
  parentId: string,
  types: Array<{ slug: string; name: string }>,
  base: BrowseFilter
): BrowseNode[] {
  return types.map((t) => ({
    id: `${parentId}/${t.slug}`,
    name: t.name,
    filter: { ...base, subtype: t.slug },
  }));
}

function shopBranch(rootSlug: string, rootName: string): BrowseNode {
  return {
    id: rootSlug,
    name: rootName,
    filter: { category: rootSlug },
    children: SHOP_SUBCATEGORIES.map((s) => {
      const id = childSlug(rootSlug, s.slug);
      const children = shopChildrenFor(rootSlug, s.slug, id) as BrowseNode[];
      return {
        id,
        name: s.name,
        filter: { category: id },
        children: children.length ? children : undefined,
      };
    }),
  };
}

const KONUT_DEAL_CHILDREN: BrowseNode[] = [
  {
    id: "konut/satilik",
    name: "Satılık",
    filter: { category: "konut", dealType: "SATILIK" },
    children: leafNodes("konut/satilik", KONUT_TYPES, { category: "konut", dealType: "SATILIK" }),
  },
  {
    id: "konut/kiralik",
    name: "Kiralık",
    filter: { category: "konut", dealType: "KIRALIK" },
    children: leafNodes("konut/kiralik", KONUT_TYPES, { category: "konut", dealType: "KIRALIK" }),
  },
  {
    id: "konut/devren-satilik",
    name: "Devren Satılık",
    filter: { category: "konut", dealType: "DEVREN_SATILIK" },
    children: leafNodes("konut/devren-satilik", KONUT_TYPES, {
      category: "konut",
      dealType: "DEVREN_SATILIK",
    }),
  },
  {
    id: "konut/devren-kiralik",
    name: "Devren Kiralık",
    filter: { category: "konut", dealType: "DEVREN_KIRALIK" },
    children: leafNodes("konut/devren-kiralik", KONUT_TYPES, {
      category: "konut",
      dealType: "DEVREN_KIRALIK",
    }),
  },
  {
    id: "konut/gunluk",
    name: "Günlük Kiralık",
    filter: { category: "konut", dealType: "KIRALIK", rental: "gunluk" },
    children: leafNodes("konut/gunluk", GUNLUK_TYPES, {
      category: "konut",
      dealType: "KIRALIK",
      rental: "gunluk",
    }),
  },
];

const ISYERI_NODE: BrowseNode = {
  id: "isyeri",
  name: "İşyeri",
  filter: { category: "isyeri" },
  children: [
    {
      id: "isyeri/satilik",
      name: "Satılık",
      filter: { category: "isyeri", dealType: "SATILIK" },
      children: leafNodes("isyeri/satilik", ISYERI_TYPES, { category: "isyeri", dealType: "SATILIK" }),
    },
    {
      id: "isyeri/kiralik",
      name: "Kiralık",
      filter: { category: "isyeri", dealType: "KIRALIK" },
      children: leafNodes("isyeri/kiralik", ISYERI_TYPES, { category: "isyeri", dealType: "KIRALIK" }),
    },
    {
      id: "isyeri/devren-satilik",
      name: "Devren Satılık",
      filter: { category: "isyeri", dealType: "DEVREN_SATILIK" },
      children: leafNodes("isyeri/devren-satilik", ISYERI_TYPES, {
        category: "isyeri",
        dealType: "DEVREN_SATILIK",
      }),
    },
    {
      id: "isyeri/devren-kiralik",
      name: "Devren Kiralık",
      filter: { category: "isyeri", dealType: "DEVREN_KIRALIK" },
      children: leafNodes("isyeri/devren-kiralik", ISYERI_TYPES, {
        category: "isyeri",
        dealType: "DEVREN_KIRALIK",
      }),
    },
  ],
};

const ARSA_NODE: BrowseNode = {
  id: "arsa",
  name: "Arsa",
  filter: { category: "arsa" },
  children: [
    {
      id: "arsa/satilik",
      name: "Satılık",
      filter: { category: "arsa", dealType: "SATILIK" },
      children: leafNodes("arsa/satilik", ARSA_TYPES, { category: "arsa", dealType: "SATILIK" }),
    },
    {
      id: "arsa/kiralik",
      name: "Kiralık",
      filter: { category: "arsa", dealType: "KIRALIK" },
      children: leafNodes("arsa/kiralik", ARSA_TYPES, { category: "arsa", dealType: "KIRALIK" }),
    },
  ],
};

/**
 * ⚠️ FALLBACK ONLY ⚠️ — built from the static JSON target tree (vasitaBrowseFromTarget.ts).
 * Runtime source of truth for the Vasıta browse tree is the DB (src/lib/vasitaBrowseFromDb.ts
 * + GET /api/catalog/tree?format=vasita-browse + useVasitaBrowseTree hook). The primary
 * ilan-ver form path merges the live DB tree with this module's static Emlak branch — see
 * src/app/ilan-ver/page.tsx. This constant only feeds server-side/synchronous consumers
 * (e.g. listingCreateService validation) that cannot await a client fetch.
 */
const VASITA_NODE: BrowseNode = buildVasitaBrowseNode();

/**
 * Ana menü kökleri: yalnızca Emlak + Vasıta.
 * İşyeri / Arsa → Emlak altında; alışveriş kökleri ayrı export’ta.
 */
export const CATEGORY_BROWSE_TREE: BrowseNode[] = [
  {
    id: "emlak",
    name: "Emlak",
    filter: { category: "konut,isyeri,arsa" },
    children: [
      {
        id: "konut",
        name: "Konut",
        filter: { category: "konut" },
        children: KONUT_DEAL_CHILDREN,
      },
      ISYERI_NODE,
      ARSA_NODE,
    ],
  },
  VASITA_NODE,
];

/** Alışveriş vitrin ağacı (ana menüde kök olarak gösterilmez) */
export const SHOP_BROWSE_TREE: BrowseNode[] = [
  shopBranch("ikinci-el", "İkinci El"),
  shopBranch("sifir-urun", "Sıfır"),
];

/** Doğrulama / path eşlemesi: ana + alışveriş */
export const ALL_BROWSE_TREE: BrowseNode[] = [...CATEGORY_BROWSE_TREE, ...SHOP_BROWSE_TREE];

/** İlan verirken kategoriye göre alt tip seçenekleri */
export function subtypesForCategory(categorySlug: string): Array<{ slug: string; name: string }> {
  if (categorySlug === "konut" || categorySlug === "kiralik") return KONUT_TYPES;
  if (categorySlug === "isyeri") return ISYERI_TYPES;
  if (categorySlug === "arsa") return ARSA_TYPES;
  if (categorySlug === "arac") return ARAC_TYPES;
  return [];
}

/** İlan yayınında kategori / alt tip zorunluluğu */
export function validateListingCategorySelection(input: {
  categorySlug?: string | null;
  dealType?: string | null;
  attributes?: Record<string, unknown> | null;
}): string | null {
  const slug = String(input.categorySlug || "").trim();
  if (!slug) return "İlan kategorisi seçmelisiniz. Kategori seçilmeden ilan yayınlanamaz.";

  // Premium kapasite kategorileri (browse tree dışında)
  if (slug.startsWith("premium-")) {
    const ok = PREMIUM_CATEGORY_SEEDS.some(
      (r) =>
        slug === r.slug || r.children.some((c) => childPremiumSlug(r.slug, c.slug) === slug)
    );
    if (!ok) return "Geçerli bir premium kategori seçin (otel, lojistik veya yolculuk).";
    return null;
  }

  const attrs = input.attributes || {};
  const subtype = String(attrs.subtype || "").trim();
  const rental = String(attrs.rentalPeriod || "").trim();
  const dealType = String(input.dealType || "").trim();
  const brand = String(attrs.brand || "").trim();
  const model = String(attrs.model || "").trim();
  const trim = String(attrs.trim || "").trim();

  const path = matchBrowsePath({
    category: slug,
    dealType,
    subtype,
    rental,
  });
  if (!path.length) {
    return "Geçerli bir kategori yolu seçin (ör. Emlak › Satılık › Villa).";
  }
  const leaf = findBrowseNode(path[path.length - 1]);

  // Vasıta: merdiven otomobil → marka → model → (paket/versiyon)
  // Primary cascade is DB (/api/vasita/catalog). vehicleCatalog.ts is emergency fallback —
  // if brand is in the static list, validate model/trim there; otherwise require non-empty
  // brand+model (DB-seeded brands not yet mirrored in the TS fallback).
  if (slug === "arac") {
    if (!subtype) return "Vasıta alt kategorisi seçin (ör. Otomobil, Motosiklet).";
    if (!brand) return "Araç markası seçmelisiniz.";
    if (!model) return "Araç modeli seçmelisiniz.";
    const brands = brandsForSubtype(subtype);
    if (brands.length && brands.some((b) => b.slug === brand)) {
      const models = modelsForBrand(subtype, brand);
      if (models.length && !models.some((m) => m.slug === model)) {
        return "Geçerli bir model seçin.";
      }
      if (modelRequiresTrim(subtype, brand, model) && !trim) {
        return "Model paket / motor seçeneğini seçmelisiniz.";
      }
    }
    return null;
  }

  if (!leaf || leaf.children?.length) {
    return "Kategori seçimini tamamlayın. Alt tipi seçmeden ilan yayınlanamaz (ör. Daire, Villa).";
  }

  const subtypes = subtypesForCategory(slug);
  if (subtypes.length) {
    if (!subtype) {
      return "Alt kategori / tip seçmelisiniz (ör. Daire, Villa, Otomobil).";
    }
    if (!subtypes.some((s) => s.slug === subtype)) {
      return "Geçerli bir alt kategori seçin.";
    }
  }
  return null;
}

export function findBrowseNode(id: string, nodes: BrowseNode[] = ALL_BROWSE_TREE): BrowseNode | null {
  for (const n of nodes) {
    if (n.id === id) return n;
    if (n.children) {
      const found = findBrowseNode(id, n.children);
      if (found) return found;
    }
  }
  return null;
}

function categoryParts(cat?: string): string[] {
  return String(cat || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function categoryMatches(nodeCat: string | undefined, filterCat: string): boolean {
  if (!nodeCat) return true;
  if (nodeCat === filterCat) return true;
  const nodeParts = categoryParts(nodeCat);
  const filterParts = categoryParts(filterCat);
  if (filterParts.length === 1) {
    const one = filterParts[0];
    if (nodeParts.includes(one)) return true;
    // alışveriş: kök «ikinci-el» → çocuk «ikinci-el-cep-telefonu»
    if (nodeParts.length === 1 && one.startsWith(`${nodeParts[0]}-`)) return true;
    return false;
  }
  // Ara düğüm (virgüllü liste): seçilen slug’lar düğümün altında olmalı
  return filterParts.every((p) => nodeParts.includes(p));
}

/** Mevcut filtreye en uygun düğüm yolu (accordion açmak için). */
export function matchBrowsePath(
  filters: {
    category: string;
    dealType: string;
    subtype: string;
    rental: string;
  },
  nodes: BrowseNode[] = ALL_BROWSE_TREE
): string[] {
  if (!filters.category) return [];

  // Eski «kiralik» kökü → Konut / Kiralık
  const category = filters.category === "kiralik" ? "konut" : filters.category;
  const dealType =
    filters.category === "kiralik" && !filters.dealType ? "KIRALIK" : filters.dealType;
  const filterParts = categoryParts(category);

  const path: string[] = [];

  function compatible(node: BrowseNode): boolean {
    const f = node.filter;
    if (f.category && !categoryMatches(f.category, category)) return false;
    if (f.dealType && dealType && f.dealType !== dealType) return false;
    if (f.dealType && !dealType) return false;
    if (f.subtype && filters.subtype && f.subtype !== filters.subtype) return false;
    if (f.subtype && !filters.subtype) return false;
    if (f.rental && filters.rental && f.rental !== filters.rental) return false;
    if (f.rental && !filters.rental) return false;
    return true;
  }

  function score(node: BrowseNode): number {
    if (!compatible(node)) return -1;
    const f = node.filter;
    let s = 0;
    const parts = categoryParts(f.category);
    // Tam filtre eşleşmesi (ara düğüm veya yaprak) en yüksek puan
    if (f.category === category) s += 12;
    else if (filterParts.length === 1 && parts.length === 1 && parts[0] === filterParts[0]) s += 6;
    else if (filterParts.length === 1 && parts.includes(filterParts[0])) s += 3;
    else if (filterParts.length > 1 && filterParts.every((p) => parts.includes(p))) {
      // Daha dar düğüm (daha az slug) tercih edilir — Sıfır / İkinci El vs ana grup
      s += 4 + Math.max(0, 6 - Math.abs(parts.length - filterParts.length));
    }
    if (f.dealType && f.dealType === dealType) s += 3;
    if (f.subtype && f.subtype === filters.subtype) s += 5;
    if (f.rental && f.rental === filters.rental) s += 3;
    // Yaprak + tam kategori → ekstra
    if (!node.children?.length && filterParts.length === 1 && parts[0] === filterParts[0]) s += 4;
    return s;
  }

  function walk(list: BrowseNode[], trail: string[]) {
    let best: BrowseNode | null = null;
    let bestScore = -1;
    for (const n of list) {
      const sc = score(n);
      if (sc > bestScore) {
        bestScore = sc;
        best = n;
      }
    }
    if (!best || bestScore < 0) return;
    const next = [...trail, best.id];
    path.length = 0;
    path.push(...next);
    if (best.children?.length) walk(best.children, next);
  }

  walk(nodes, []);
  return path;
}

export function browseFilterToSearchPatch(filter: BrowseFilter): {
  category: string;
  dealType: "" | "SATILIK" | "KIRALIK" | "DEVREN_SATILIK" | "DEVREN_KIRALIK";
  subtype: string;
  rental: string;
  brand: string;
  model: string;
  trim: string;
} {
  return {
    category: filter.category || "",
    dealType: (filter.dealType || "") as "" | "SATILIK" | "KIRALIK" | "DEVREN_SATILIK" | "DEVREN_KIRALIK",
    subtype: filter.subtype || "",
    rental: filter.rental || "",
    brand: filter.brand || "",
    model: filter.model || "",
    trim: filter.trim || "",
  };
}

export { ARAC_TYPES, KONUT_TYPES };
