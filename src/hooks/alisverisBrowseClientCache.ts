import type { BrowseNode } from "@/data/categoryBrowseTree";
import type { AlisverisBrowseMeta } from "@/lib/alisverisBrowseFromDb";

export type AlisverisBrowseState = {
  tree: BrowseNode[];
  meta: AlisverisBrowseMeta;
  loading: boolean;
};

let sharedCache: AlisverisBrowseState | null = null;

export function getAlisverisBrowseSharedCache() {
  return sharedCache;
}

export function setAlisverisBrowseSharedCache(state: AlisverisBrowseState) {
  sharedCache = state;
}

/** Layout SSR ağacını client modül cache'ine yaz (klasik 5'li flash'ı önler). */
export function seedAlisverisBrowseTree(tree: BrowseNode[]) {
  if (!tree.length) return;
  if (sharedCache && !sharedCache.loading && sharedCache.meta.source === "db") return;
  sharedCache = { tree, meta: { source: "db" }, loading: false };
}
