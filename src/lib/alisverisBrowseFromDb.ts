/**
 * DB catalog tree → BrowseNode (UI).
 * Sistem kökleri (ikinci-el / sifir-urun) gizlenir; ana kategoriler birleştirilir.
 * API down → ALISVERIS_BROWSE_TREE emergency fallback.
 *
 * Filtre kategorisi: yalnızca düğüm slug'ı (veya ana için iki kök slug).
 * Altları listings API `resolveCategoryFilterIds` path ile genişletir —
 * tüm leaf slug'larını join etmek payload/URL'i şişirir ve UI'da ham kod yığını gösterir.
 */
import type { BrowseNode } from "@/data/categoryBrowseTree";
import { ALISVERIS_BROWSE_TREE } from "@/data/classicBrowseTree";
import type { CatalogTreeNode } from "@/core/services/catalog/categoryTreeService";

export type AlisverisBrowseMeta = {
  source: "db" | "fallback-ts";
  warning?: string;
};

function catalogToBrowse(node: CatalogTreeNode): BrowseNode {
  const kids = (node.children || []).map(catalogToBrowse);
  return {
    id: node.slug,
    name: node.name,
    filter: { category: node.slug },
    children: kids.length ? kids : undefined,
    ...(node.icon ? { icon: node.icon } : {}),
    ...(node.image ? { image: node.image } : {}),
  } as BrowseNode & { icon?: string; image?: string };
}

function anaKey(slug: string): string {
  return slug.replace(/^(ikinci-el|sifir-urun)__/, "");
}

/**
 * DB roots → kullanıcı menüsü (Elektronik, Moda…).
 * Her ana altında İkinci El / Sıfır koşul dalları (görünür; sistem kökü değil).
 */
export function buildAlisverisBrowseFromDb(roots: CatalogTreeNode[]): BrowseNode[] {
  const ikinci = roots.find((r) => r.slug === "ikinci-el");
  const sifir = roots.find((r) => r.slug === "sifir-urun");

  type Acc = {
    key: string;
    name: string;
    sortOrder: number;
    icon?: string | null;
    image?: string | null;
    ikinci?: CatalogTreeNode;
    sifir?: CatalogTreeNode;
  };

  const map = new Map<string, Acc>();

  function ingest(side: "ikinci" | "sifir", node: CatalogTreeNode) {
    const key = anaKey(node.slug);
    if (!key || key === node.slug) return;
    let acc = map.get(key);
    if (!acc) {
      acc = {
        key,
        name: node.name,
        sortOrder: node.sortOrder ?? 0,
        icon: node.icon,
        image: node.image,
      };
      map.set(key, acc);
    }
    if (side === "ikinci") acc.ikinci = node;
    else acc.sifir = node;
    if (node.sortOrder != null && node.sortOrder < acc.sortOrder) acc.sortOrder = node.sortOrder;
  }

  for (const c of ikinci?.children || []) ingest("ikinci", c);
  for (const c of sifir?.children || []) ingest("sifir", c);

  return [...map.values()]
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "tr"))
    .map((acc) => {
      const conditionChildren: BrowseNode[] = [];
      if (acc.ikinci) {
        conditionChildren.push({
          id: `alisveris/${acc.key}/ikinci-el`,
          name: "İkinci El",
          filter: { category: acc.ikinci.slug },
          children: (acc.ikinci.children || []).map(catalogToBrowse),
        });
      }
      if (acc.sifir) {
        conditionChildren.push({
          id: `alisveris/${acc.key}/sifir-urun`,
          name: "Sıfır",
          filter: { category: acc.sifir.slug },
          children: (acc.sifir.children || []).map(catalogToBrowse),
        });
      }
      const topSlugs = [acc.ikinci?.slug, acc.sifir?.slug].filter(Boolean) as string[];
      return {
        id: `alisveris/${acc.key}`,
        name: acc.name,
        filter: { category: topSlugs.join(",") },
        children: conditionChildren.length ? conditionChildren : undefined,
        ...(acc.icon ? { icon: acc.icon } : {}),
        ...(acc.image ? { image: acc.image } : {}),
      } as BrowseNode;
    });
}

export function fallbackAlisverisBrowseTree(reason: string): {
  tree: BrowseNode[];
  meta: AlisverisBrowseMeta;
} {
  console.warn("[catalog-browse] FALLBACK TS tree:", reason);
  return {
    tree: ALISVERIS_BROWSE_TREE,
    meta: { source: "fallback-ts", warning: reason },
  };
}

export function resolveAlisverisBrowseTree(roots: CatalogTreeNode[] | null | undefined): {
  tree: BrowseNode[];
  meta: AlisverisBrowseMeta;
} {
  if (!roots?.length) {
    return fallbackAlisverisBrowseTree("empty db roots");
  }
  const tree = buildAlisverisBrowseFromDb(roots);
  if (!tree.length) {
    return fallbackAlisverisBrowseTree("db transform produced empty tree");
  }
  return { tree, meta: { source: "db" } };
}
