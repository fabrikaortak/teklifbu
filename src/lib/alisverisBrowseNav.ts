import type { BrowseNode } from "@/data/categoryBrowseTree";
import {
  getBrowseTreeMemory,
  getCatalogTreeCached,
  setBrowseTreeMemory,
} from "@/core/services/catalog/catalogTreeCache";
import { resolveAlisverisBrowseTree, slimBrowseNodes } from "@/lib/alisverisBrowseFromDb";

/** Sol menü / SSR: sığ DB ağacı (markasız). */
export async function getAlisverisBrowseNavTree(): Promise<BrowseNode[]> {
  const hit = getBrowseTreeMemory();
  if (hit?.browseTree?.length) return hit.browseTree;

  const roots = await getCatalogTreeCached("all");
  const { tree: full, meta } = resolveAlisverisBrowseTree(roots);
  const browseTree = slimBrowseNodes(full, 2);
  if (meta.source !== "fallback-ts" && browseTree.length) {
    setBrowseTreeMemory({ browseTree, meta });
  }
  return browseTree;
}
