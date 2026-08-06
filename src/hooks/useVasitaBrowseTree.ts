"use client";

import { useEffect, useState } from "react";
import type { BrowseNode } from "@/data/categoryBrowseTree";
import { buildVasitaBrowseNode } from "@/lib/vasitaBrowseFromTarget";
import type { VasitaBrowseMeta } from "@/lib/vasitaBrowseFromDb";

type State = {
  /** Vasıta root node (id="arac"); .children is the 15-ish main-nav list. */
  root: BrowseNode;
  tree: BrowseNode[];
  meta: VasitaBrowseMeta;
  loading: boolean;
};

/** Aynı sayfada birden çok tüketici çağırsa tek fetch */
let inflight: Promise<State> | null = null;
let sharedCache: State | null = null;

function fallbackState(warning: string): State {
  const root = buildVasitaBrowseNode();
  return { root, tree: root.children || [], meta: { source: "fallback-json", warning }, loading: false };
}

async function fetchVasitaBrowseTree(): Promise<State> {
  if (sharedCache && !sharedCache.loading && sharedCache.meta.source === "db") {
    return sharedCache;
  }
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const res = await fetch("/api/catalog/tree?format=vasita-browse", { cache: "no-store" });
      const data = await res.json();
      if (data.ok && Array.isArray(data.browseTree) && data.browseTree.length) {
        const root: BrowseNode = data.root || {
          id: "arac",
          name: "Vasıta",
          filter: { category: "arac" },
          children: data.browseTree,
        };
        const next: State = {
          root,
          tree: data.browseTree,
          meta: data.meta || { source: "db" },
          loading: false,
        };
        if (data.meta?.source === "fallback-json" || data.degraded) {
          console.warn("[useVasitaBrowseTree] degraded/fallback", data.meta);
        }
        sharedCache = next;
        return next;
      }
      console.warn("[useVasitaBrowseTree] empty/invalid API → JSON fallback");
      const fallback = fallbackState("api_empty");
      sharedCache = fallback;
      return fallback;
    } catch (e) {
      console.warn("[useVasitaBrowseTree] fetch failed → JSON fallback", e);
      const fallback = fallbackState(String(e));
      sharedCache = fallback;
      return fallback;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

/**
 * Vasıta browse ağacı — /api/catalog/tree?format=vasita-browse (DB source of truth).
 * Hata/boş → JSON emergency fallback (boş menü yok).
 */
export function useVasitaBrowseTree() {
  const [state, setState] = useState<State>(() =>
    sharedCache && !sharedCache.loading ? sharedCache : { ...fallbackState("loading"), loading: true }
  );

  useEffect(() => {
    let cancelled = false;
    void fetchVasitaBrowseTree().then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
