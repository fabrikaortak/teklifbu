/**
 * ⚠️ EMERGENCY FALLBACK ONLY ⚠️
 * Vasıta browse tree built directly from the Stage1 target JSON
 * (src/data/vertical-taxonomy/vehicle-stage1-target-tree.json).
 *
 * Runtime source of truth is the DB (see src/lib/vasitaBrowseFromDb.ts +
 * GET /api/catalog/tree?format=vasita-browse). This module is only used when:
 *  - the API/DB is unavailable (useVasitaBrowseTree hook fallback), or
 *  - categoryBrowseTree.ts needs a synchronous default before the client fetch resolves.
 *
 * Listing filter: category=arac + subtype=catalogKey (brand cascade).
 * Safe for client import (no fs).
 */
import type { BrowseFilter, BrowseNode } from "@/data/categoryBrowseTree";
import targetTree from "@/data/vertical-taxonomy/vehicle-stage1-target-tree.json";
import {
  CATALOG_SCOPE_TO_SUBTYPE,
  filterForMeta,
  readBrowseExtraAttrs,
  type VasitaMeta,
} from "@/lib/vasitaBrowseMeta";

export { CATALOG_SCOPE_TO_SUBTYPE, readBrowseExtraAttrs };

type TargetNode = {
  name: string;
  slug: string;
  path: string;
  browseRole?: string;
  catalogScope?: string | null;
  requiredFilters?: Record<string, unknown>;
  mapsToAttribute?: Record<string, string>;
  children?: TargetNode[];
};

type FilterWithAttrs = BrowseFilter & { _attrs?: Record<string, string> };

function toMeta(n: TargetNode): VasitaMeta {
  return {
    browseRole: n.browseRole,
    catalogScope: n.catalogScope ?? null,
    requiredFilters: n.requiredFilters,
    mapsToAttribute: n.mapsToAttribute,
  };
}

function toBrowse(n: TargetNode, parent?: TargetNode): BrowseNode {
  const children = (n.children || []).map((c) => toBrowse(c, n));
  return {
    id: n.path,
    name: n.name,
    filter: filterForMeta(toMeta(n), n.slug, Boolean(parent), parent ? toMeta(parent) : null),
    children: children.length ? children : undefined,
  };
}

/** Vasıta root BrowseNode for CATEGORY_BROWSE_TREE (FALLBACK). */
export function buildVasitaBrowseNode(): BrowseNode {
  const mainNav = (targetTree as { mainNav: TargetNode[] }).mainNav || [];
  return {
    id: "arac",
    name: "Vasıta",
    filter: { category: "arac" },
    children: mainNav.map((m) => toBrowse(m)),
  };
}

export type { FilterWithAttrs };
