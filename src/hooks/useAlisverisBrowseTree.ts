"use client";

import { useEffect, useState } from "react";
import type { BrowseNode } from "@/data/categoryBrowseTree";
import { ALISVERIS_BROWSE_TREE } from "@/data/classicBrowseTree";
import type { AlisverisBrowseMeta } from "@/lib/alisverisBrowseFromDb";
import { useAlisverisBrowseInitial } from "@/components/AlisverisBrowseProvider";
import {
  getAlisverisBrowseSharedCache,
  setAlisverisBrowseSharedCache,
  type AlisverisBrowseState,
} from "@/hooks/alisverisBrowseClientCache";

const LS_KEY = "teklifbu:alisveris-browse:v2";
const LS_TTL_MS = 60 * 60_000;

let inflight: Promise<AlisverisBrowseState> | null = null;

function readLocal(): AlisverisBrowseState | null {
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

function writeLocal(state: AlisverisBrowseState) {
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

async function fetchBrowseTree(): Promise<AlisverisBrowseState> {
  const shared = getAlisverisBrowseSharedCache();
  if (shared && !shared.loading && shared.meta.source === "db") {
    return shared;
  }
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const res = await fetch("/api/catalog/tree?format=browse");
      const data = await res.json();
      if (data.ok && Array.isArray(data.browseTree) && data.browseTree.length) {
        const next: AlisverisBrowseState = {
          tree: data.browseTree,
          meta: data.meta || { source: "db" },
          loading: false,
        };
        if (data.meta?.source === "fallback-ts" || data.degraded) {
          console.warn("[useAlisverisBrowseTree] degraded/fallback", data.meta);
        } else {
          writeLocal(next);
        }
        setAlisverisBrowseSharedCache(next);
        return next;
      }
      console.warn("[useAlisverisBrowseTree] empty/invalid API → TS fallback");
      const fallback: AlisverisBrowseState = {
        tree: ALISVERIS_BROWSE_TREE,
        meta: { source: "fallback-ts", warning: "api_empty" },
        loading: false,
      };
      setAlisverisBrowseSharedCache(fallback);
      return fallback;
    } catch (e) {
      console.warn("[useAlisverisBrowseTree] fetch failed → TS fallback", e);
      const fallback: AlisverisBrowseState = {
        tree: ALISVERIS_BROWSE_TREE,
        meta: { source: "fallback-ts", warning: String(e) },
        loading: false,
      };
      setAlisverisBrowseSharedCache(fallback);
      return fallback;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

/**
 * Alışveriş browse ağacı — SSR seed + /api/catalog/tree?format=browse
 * İlk açılışta klasik 5'li menü göstermez (layout'tan gelen DB ağacı).
 */
export function useAlisverisBrowseTree() {
  const ssrTree = useAlisverisBrowseInitial();

  const [state, setState] = useState<AlisverisBrowseState>(() => {
    const shared = getAlisverisBrowseSharedCache();
    if (shared && !shared.loading) return shared;
    if (ssrTree?.length) {
      const seeded: AlisverisBrowseState = { tree: ssrTree, meta: { source: "db" }, loading: false };
      setAlisverisBrowseSharedCache(seeded);
      return seeded;
    }
    const local = readLocal();
    if (local) {
      setAlisverisBrowseSharedCache(local);
      return local;
    }
    return {
      tree: [],
      meta: { source: "db", warning: "loading" },
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
