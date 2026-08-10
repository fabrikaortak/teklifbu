import type { BrowseNode } from "@/data/categoryBrowseTree";

/** İkinci El / Sıfır kök slug’ını kırp → ortak anahtar */
export function megaLeafKey(idOrSlug: string): string {
  return idOrSlug
    .replace(/^(ikinci-el|sifir-urun)__/, "")
    .replace(/^alisveris\//, "")
    .split("/")
    .pop() || idOrSlug;
}

/**
 * Ana kategori (Elektronik…) altındaki İkinci El / Sıfır dallarını
 * L2 listesine birleştirir (Telefon ve Aksesuar tek satır).
 */
export function mergeMegaL2(main: BrowseNode | null | undefined): BrowseNode[] {
  if (!main?.children?.length) return [];

  const looksLikeCondition = main.children.every(
    (c) => c.name === "İkinci El" || c.name === "Sıfır" || /\/(ikinci-el|sifir-urun)$/.test(c.id)
  );

  if (!looksLikeCondition) {
    return main.children.filter((c) => c.kind !== "section");
  }

  const map = new Map<string, BrowseNode>();

  for (const branch of main.children) {
    for (const l2 of branch.children || []) {
      if (l2.kind === "section") continue;
      const key = megaLeafKey(l2.id);
      const prev = map.get(key);
      if (!prev) {
        map.set(key, {
          id: l2.id,
          name: l2.name,
          filter: { ...l2.filter },
          children: [...(l2.children || [])],
        });
        continue;
      }
      const cats = new Set<string>();
      for (const s of String(prev.filter.category || "").split(",")) {
        const t = s.trim();
        if (t) cats.add(t);
      }
      for (const s of String(l2.filter.category || "").split(",")) {
        const t = s.trim();
        if (t) cats.add(t);
      }
      const childMap = new Map<string, BrowseNode>();
      for (const ch of [...(prev.children || []), ...(l2.children || [])]) {
        const ck = megaLeafKey(ch.id);
        const existing = childMap.get(ck);
        if (!existing) {
          childMap.set(ck, { ...ch, children: [...(ch.children || [])] });
          continue;
        }
        const grand = new Map<string, BrowseNode>();
        for (const g of [...(existing.children || []), ...(ch.children || [])]) {
          grand.set(megaLeafKey(g.id), g);
        }
        childMap.set(ck, {
          ...existing,
          filter: {
            category: [existing.filter.category, ch.filter.category]
              .filter(Boolean)
              .join(","),
          },
          children: [...grand.values()],
        });
      }
      map.set(key, {
        ...prev,
        filter: { category: [...cats].join(",") },
        children: [...childMap.values()],
      });
    }
  }

  return [...map.values()];
}

export function browseCategoryValue(node: BrowseNode): string {
  return String(node.filter?.category || "").trim();
}
