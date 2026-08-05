import { SHOP_SUBCATEGORIES, childSlug } from "@/data/shopCategories";
import { shopChildrenFor } from "@/data/shopBrowseChildren";
import { CATEGORY_BROWSE_TREE, type BrowseNode } from "@/data/categoryBrowseTree";

/** Sahibinden tarzı grup → alışveriş alt kategori slug'ları */
export const CLASSIC_SHOP_GROUPS: Record<string, string[]> = {
  elektronik: [
    "cep-telefonu",
    "bilgisayar",
    "tablet",
    "tv-goruntu-ses",
    "beyaz-esya",
    "elektrikli-ev-aletleri",
    "ev-elektronigi",
    "oyun-konsol",
    "fotograf-kamera",
    "teknik-elektronik",
  ],
  "ev-yasam": ["ev-dekorasyon", "bahce-yapi-market", "pet-shop", "yiyecek-icecek", "ofis-kirtasiye"],
  moda: ["giyim-aksesuar", "ayakkabi-canta", "saat-taki", "kisisel-bakim", "anne-bebek"],
  hobi: ["spor-outdoor", "hobi-oyuncak", "kitap-dergi-film", "muzik", "antika-koleksiyon"],
  "is-makineleri": ["is-makinesi", "tarim-makinesi", "sanayi-makinesi", "bahce-yapi-market", "teknik-elektronik"],
  diger: ["diger-alisveris"],
};

/** Ana alışveriş vitrin grupları (İş Makineleri Vasıta altında kaldı) */
export const ALISVERIS_GROUP_IDS = ["elektronik", "ev-yasam", "moda", "hobi", "diger"] as const;
export type AlisverisGroupId = (typeof ALISVERIS_GROUP_IDS)[number];

const ALISVERIS_SUB_SLUGS = new Set(
  ALISVERIS_GROUP_IDS.flatMap((id) => CLASSIC_SHOP_GROUPS[id] || [])
);

function shopLeaves(rootSlug: string, subSlugs?: string[]): BrowseNode[] {
  const subs = subSlugs
    ? SHOP_SUBCATEGORIES.filter((s) => subSlugs.includes(s.slug))
    : SHOP_SUBCATEGORIES;
  return subs.map((s) => {
    const id = childSlug(rootSlug, s.slug);
    const children = shopChildrenFor(rootSlug, s.slug, id) as BrowseNode[];
    return {
      id,
      name: s.name,
      filter: { category: id },
      children: children.length ? children : undefined,
    };
  });
}

function shopGroupNode(id: string, name: string, subSlugs: string[]): BrowseNode {
  const roots = ["ikinci-el", "sifir-urun"] as const;
  const allSlugs = roots.flatMap((root) => subSlugs.map((s) => childSlug(root, s)));
  return {
    id,
    name,
    filter: { category: allSlugs.join(",") },
    children: roots.map((root) => {
      const leaves = shopLeaves(root, subSlugs);
      return {
        id: `${id}/${root}`,
        name: root === "sifir-urun" ? "Sıfır" : "İkinci El",
        filter: { category: leaves.map((l) => l.filter.category).join(",") },
        children: leaves,
      };
    }),
  };
}

const emlak = CATEGORY_BROWSE_TREE.find((n) => n.id === "emlak")!;
const vasita = CATEGORY_BROWSE_TREE.find((n) => n.id === "arac")!;

/**
 * Ana sayfa sol menü: yalnızca Emlak + Vasıta.
 * Alışveriş → /alisveris (ayrı anasayfa).
 */
export const CLASSIC_BROWSE_TREE: BrowseNode[] = [
  { ...emlak, name: "Emlak" },
  { ...vasita, name: "Vasıta" },
];

/**
 * /alisveris sol menü kök ağacı — premium dikeyleri gibi izole.
 */
export const ALISVERIS_BROWSE_TREE: BrowseNode[] = [
  shopGroupNode("elektronik", "Elektronik", CLASSIC_SHOP_GROUPS.elektronik),
  shopGroupNode("ev-yasam", "Ev & Yaşam", CLASSIC_SHOP_GROUPS["ev-yasam"]),
  shopGroupNode("moda", "Moda & Aksesuar", CLASSIC_SHOP_GROUPS.moda),
  shopGroupNode("hobi", "Hobi & Spor", CLASSIC_SHOP_GROUPS.hobi),
  {
    id: "diger",
    name: "Diğer",
    filter: { category: "diger,ikinci-el-diger-alisveris,sifir-urun-diger-alisveris" },
    children: [
      { id: "diger/root", name: "Genel", filter: { category: "diger" } },
      ...shopLeaves("ikinci-el", CLASSIC_SHOP_GROUPS.diger),
      ...shopLeaves("sifir-urun", CLASSIC_SHOP_GROUPS.diger),
    ],
  },
];

export function findClassicBrowseNode(
  id: string,
  nodes: BrowseNode[] = CLASSIC_BROWSE_TREE
): BrowseNode | null {
  for (const n of nodes) {
    if (n.id === id) return n;
    if (n.children) {
      const found = findClassicBrowseNode(id, n.children);
      if (found) return found;
    }
  }
  if (nodes === CLASSIC_BROWSE_TREE) {
    return findClassicBrowseNode(id, ALISVERIS_BROWSE_TREE);
  }
  return null;
}

/** Şerit / kısayol → ağaç kök filtre kategorisi */
export function classicRootCategory(rootId: string): string {
  const node =
    CLASSIC_BROWSE_TREE.find((n) => n.id === rootId) ||
    ALISVERIS_BROWSE_TREE.find((n) => n.id === rootId);
  return node?.filter.category || rootId;
}

/** Tüm alışveriş kök filtreleri (vitrin «hepsi») */
export function allAlisverisCategoryParam(): string {
  return ALISVERIS_BROWSE_TREE.map((n) => n.filter.category || "")
    .filter(Boolean)
    .join(",");
}

export function isAlisverisCategorySlug(slug?: string | null): boolean {
  if (!slug) return false;
  const parts = slug.split(",").map((s) => s.trim()).filter(Boolean);
  if (parts.length > 1) return parts.some((p) => isAlisverisCategorySlug(p));

  if ((ALISVERIS_GROUP_IDS as readonly string[]).includes(slug)) return true;
  if (slug === "alisveris") return true;
  if (slug === "ikinci-el" || slug === "sifir-urun") return true;
  if (slug.startsWith("ikinci-el__") || slug.startsWith("sifir-urun__")) return true;

  for (const sub of ALISVERIS_SUB_SLUGS) {
    if (slug === sub) return true;
    if (slug === `ikinci-el-${sub}` || slug === `sifir-urun-${sub}`) return true;
    if (slug.startsWith(`ikinci-el-${sub}-`) || slug.startsWith(`sifir-urun-${sub}-`)) return true;
    if (slug.startsWith(`ikinci-el-${sub}__`) || slug.startsWith(`sifir-urun-${sub}__`)) return true;
  }

  if (slug === "diger") return true;

  return false;
}

/** Ana sayfa kökleri: Emlak (konut/isyeri/arsa) + Vasıta */
export const EMLAK_VASITA_CATEGORY_PARAM = "konut,isyeri,arsa,arac";

export function allEmlakVasitaCategoryParam(): string {
  return EMLAK_VASITA_CATEGORY_PARAM;
}

export function isEmlakVasitaCategorySlug(slug?: string | null): boolean {
  if (!slug) return false;
  const parts = slug.split(",").map((s) => s.trim()).filter(Boolean);
  if (parts.length > 1) {
    return parts.every((p) => isEmlakVasitaCategorySlug(p));
  }
  if (slug === "konut" || slug === "isyeri" || slug === "arsa" || slug === "arac") return true;
  if (slug === "emlak" || slug === "vasita") return true;
  if (slug === "kiralik") return true; // eski slug → konut kiralık
  return false;
}
