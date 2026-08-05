"use client";

import { useEffect, useState } from "react";
import type { BrowseNode } from "@/data/categoryBrowseTree";
import { ALISVERIS_BROWSE_TREE } from "@/data/classicBrowseTree";
import type { AlisverisBrowseMeta } from "@/lib/alisverisBrowseFromDb";

type State = {
  tree: BrowseNode[];
  meta: AlisverisBrowseMeta;
  loading: boolean;
};

/**
 * Alışveriş browse ağacı — /api/catalog/tree?format=browse
 * Hata/boş → TS emergency fallback (boş menü yok).
 */
export function useAlisverisBrowseTree() {
  const [state, setState] = useState<State>({
    tree: ALISVERIS_BROWSE_TREE,
    meta: { source: "fallback-ts", warning: "loading" },
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/catalog/tree?format=browse", { cache: "no-store" });
        const data = await res.json();
        if (cancelled) return;
        if (data.ok && Array.isArray(data.browseTree) && data.browseTree.length) {
          setState({
            tree: data.browseTree,
            meta: data.meta || { source: "db" },
            loading: false,
          });
          if (data.meta?.source === "fallback-ts" || data.degraded) {
            console.warn("[useAlisverisBrowseTree] degraded/fallback", data.meta);
          }
          return;
        }
        console.warn("[useAlisverisBrowseTree] empty/invalid API → TS fallback");
        setState({
          tree: ALISVERIS_BROWSE_TREE,
          meta: { source: "fallback-ts", warning: "api_empty" },
          loading: false,
        });
      } catch (e) {
        console.warn("[useAlisverisBrowseTree] fetch failed → TS fallback", e);
        if (!cancelled) {
          setState({
            tree: ALISVERIS_BROWSE_TREE,
            meta: { source: "fallback-ts", warning: String(e) },
            loading: false,
          });
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
