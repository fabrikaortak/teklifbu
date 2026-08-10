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

/** Aynı sayfada Home/Nav/Strip üç kez çağırsa tek fetch */
let inflight: Promise<State> | null = null;
let sharedCache: State | null = null;

async function fetchBrowseTree(): Promise<State> {
  if (sharedCache && !sharedCache.loading && sharedCache.meta.source === "db") {
    return sharedCache;
  }
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const res = await fetch("/api/catalog/tree?format=browse");
      const data = await res.json();
      if (data.ok && Array.isArray(data.browseTree) && data.browseTree.length) {
        const next: State = {
          tree: data.browseTree,
          meta: data.meta || { source: "db" },
          loading: false,
        };
        if (data.meta?.source === "fallback-ts" || data.degraded) {
          console.warn("[useAlisverisBrowseTree] degraded/fallback", data.meta);
        }
        sharedCache = next;
        return next;
      }
      console.warn("[useAlisverisBrowseTree] empty/invalid API → TS fallback");
      const fallback: State = {
        tree: ALISVERIS_BROWSE_TREE,
        meta: { source: "fallback-ts", warning: "api_empty" },
        loading: false,
      };
      sharedCache = fallback;
      return fallback;
    } catch (e) {
      console.warn("[useAlisverisBrowseTree] fetch failed → TS fallback", e);
      const fallback: State = {
        tree: ALISVERIS_BROWSE_TREE,
        meta: { source: "fallback-ts", warning: String(e) },
        loading: false,
      };
      sharedCache = fallback;
      return fallback;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

/**
 * Alışveriş browse ağacı — /api/catalog/tree?format=browse
 * Hata/boş → TS emergency fallback (boş menü yok).
 */
export function useAlisverisBrowseTree() {
  const [state, setState] = useState<State>(() =>
    sharedCache && !sharedCache.loading
      ? sharedCache
      : {
          tree: ALISVERIS_BROWSE_TREE,
          meta: { source: "fallback-ts", warning: "loading" },
          loading: true,
        }
  );

  useEffect(() => {
    let cancelled = false;
    void fetchBrowseTree().then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
