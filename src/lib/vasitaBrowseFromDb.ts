/**
 * Vasıta browse tree — RUNTIME SOURCE OF TRUTH.
 * Builds BrowseNode[] from Prisma Category rows where path === "arac" or starts with "arac/".
 * Browse meta (browseRole, catalogScope, requiredFilters, mapsToAttribute, legacySubtype)
 * is read from Category.description via the `VASITA_META:` prefix — written by
 * scripts/apply-vehicle-stage1-categories.ts.
 *
 * On empty/invalid DB rows callers should fall back to buildVasitaBrowseNode() (JSON) —
 * see GET /api/catalog/tree?format=vasita-browse and useVasitaBrowseTree.
 */
import type { BrowseNode } from "@/data/categoryBrowseTree";
import { buildVasitaBrowseNode } from "@/lib/vasitaBrowseFromTarget";
import { filterForMeta, parseVasitaMeta, readBrowseExtraAttrs, type VasitaMeta } from "@/lib/vasitaBrowseMeta";

export { readBrowseExtraAttrs };

export type VasitaCategoryRow = {
  id: string;
  slug: string;
  name: string;
  path: string | null;
  parentId: string | null;
  sortOrder: number;
  description: string | null;
  isActive: boolean;
};

export type VasitaBrowseMeta = {
  source: "db" | "fallback-json";
  warning?: string;
};

function leafSlugFromPath(path: string | null, fallbackSlug: string): string {
  if (!path) return fallbackSlug;
  const parts = path.split("/");
  return parts[parts.length - 1] || fallbackSlug;
}

/** Builds the Vasıta root BrowseNode from DB rows, or null if rows don't form a usable tree. */
export function buildVasitaBrowseFromDb(rows: VasitaCategoryRow[]): BrowseNode | null {
  const active = rows.filter(
    (r) => r.isActive && r.path && (r.path === "arac" || r.path.startsWith("arac/"))
  );
  const root = active.find((r) => r.path === "arac");
  if (!root) return null;
  const rootId = root.id;

  const byParent = new Map<string, VasitaCategoryRow[]>();
  for (const r of active) {
    if (r.id === rootId) continue;
    const key = r.parentId || "";
    const list = byParent.get(key) || [];
    list.push(r);
    byParent.set(key, list);
  }
  for (const list of byParent.values()) {
    list.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "tr"));
  }

  const metaById = new Map<string, VasitaMeta | null>();
  for (const r of active) metaById.set(r.id, parseVasitaMeta(r.description));

  function build(row: VasitaCategoryRow, parentRow?: VasitaCategoryRow): BrowseNode {
    const kids = byParent.get(row.id) || [];
    const children = kids.map((k) => build(k, row));
    const meta = metaById.get(row.id);
    // Main-nav nodes (direct children of arac) act as top-of-hierarchy for filter
    // purposes — same convention as vasitaBrowseFromTarget.ts (parent=undefined there).
    const isMain = parentRow?.id === rootId;
    const effectiveParentRow = isMain ? undefined : parentRow;
    const parentMeta = effectiveParentRow ? metaById.get(effectiveParentRow.id) : null;
    const leaf = leafSlugFromPath(row.path, row.slug);
    return {
      id: row.path || row.slug,
      name: row.name,
      filter: filterForMeta(meta, leaf, Boolean(effectiveParentRow), parentMeta),
      children: children.length ? children : undefined,
    };
  }

  const children = (byParent.get(root.id) || []).map((k) => build(k, root));
  return { id: "arac", name: root.name, filter: { category: "arac" }, children };
}

export function fallbackVasitaBrowseTree(reason: string): { root: BrowseNode; meta: VasitaBrowseMeta } {
  console.warn("[vasita-browse] FALLBACK JSON tree:", reason);
  return { root: buildVasitaBrowseNode(), meta: { source: "fallback-json", warning: reason } };
}

export function resolveVasitaBrowseTree(
  rows: VasitaCategoryRow[] | null | undefined
): { root: BrowseNode; meta: VasitaBrowseMeta } {
  if (!rows?.length) return fallbackVasitaBrowseTree("empty db rows");
  const node = buildVasitaBrowseFromDb(rows);
  if (!node || !node.children?.length) {
    return fallbackVasitaBrowseTree("db transform produced empty tree");
  }
  return { root: node, meta: { source: "db" } };
}
