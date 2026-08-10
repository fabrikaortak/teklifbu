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

const LS_KEY = "teklifbu:alisveris-browse:v2";
const LS_TTL_MS = 60 * 60_000;

/** Aynı sayfada Home/Nav/Strip üç kez çağırsa tek fetch */
let inflight: Promise<State> | null = null;
let sharedCache: State | null = null;

function readLocal(): State | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { at: number; tree: BrowseNode[]; meta: AlisverisBrowseMeta };
    if (!parsed?.tree?.length || Date.now() - parsed.at > LS_TTL_MS) return null;
    return { tree: parsed.tree, meta: parsed.meta || { source: "db" }, loading: false };
  } catch {
    return null;
  }
}

function writeLocal(state: State) {
  if (typeof window === "undefined" || state.meta.source !== "db") return;
  try {
    window.localStorage.setItem(
      LS_KEY,
      JSON.stringify({ at: Date.now(), tree: state.tree, meta: state.meta })
    );
  } catch {
    /* quota */
  }
}

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
        } else {
          writeLocal(next);
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
 * F5: localStorage anında eski menüyü gösterir, arka planda yeniler.
 */
export function useAlisverisBrowseTree() {
  const [state, setState] = useState<State>(() => {
    if (sharedCache && !sharedCache.loading) return sharedCache;
    const local = readLocal();
    if (local) {
      sharedCache = local;
      return local;
    }
    return {
      tree: ALISVERIS_BROWSE_TREE,
      meta: { source: "fallback-ts", warning: "loading" },
      loading: true,
    };
  });

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
