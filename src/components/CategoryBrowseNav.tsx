"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ChevronDown,
  ChevronRight,
  Car,
  Home,
  ShoppingBag,
  Smartphone,
  Sofa,
  Shirt,
  Bike,
  Truck,
  Package,
  type LucideIcon,
} from "lucide-react";
import {
  CATEGORY_BROWSE_TREE,
  BrowseNode,
  BrowseFilter,
  browseFilterToSearchPatch,
} from "@/data/categoryBrowseTree";
import { ALISVERIS_BROWSE_TREE, CLASSIC_BROWSE_TREE } from "@/data/classicBrowseTree";
import { buildVehicleBrandNodes, countForBrowseFilter, type FacetCounts } from "@/lib/facetHelpers";
import type { SearchFilters } from "@/components/SearchPanel";
import { getCatIcon } from "@/components/CategoryIcons";
import {
  DEFAULT_BROWSE_NAV_CONFIG,
  displayNameFor,
  isNodeActive,
  resolveBrowseNodeKey,
  sortOrderFor,
  type BrowseNavConfig,
} from "@/lib/browseNavConfig";

/** Kök satır ikonları — klasik v2 ile aynı */
const ROOT_LUCIDE: Record<string, LucideIcon> = {
  emlak: Home,
  konut: Home,
  arac: Car,
  "ikinci-el-sifir": ShoppingBag,
  "ikinci-el": ShoppingBag,
  "sifir-urun": Package,
  elektronik: Smartphone,
  "ev-yasam": Sofa,
  moda: Shirt,
  hobi: Bike,
  "is-makineleri": Truck,
  diger: Package,
  isyeri: Home,
  arsa: Home,
  kiralik: Home,
};

type Props = {
  filters: SearchFilters;
  facets?: FacetCounts | null;
  onSelect: (patch: ReturnType<typeof browseFilterToSearchPatch>) => void;
  embedded?: boolean;
  rootsOnly?: string[];
  hideHeader?: boolean;
  /** classic: Emlak+Vasıta; alisveris: /alisveris ağacı; default: tam ağaç */
  variant?: "default" | "classic" | "alisveris";
};

type NavNode = {
  id: string;
  name: string;
  filter: BrowseFilter;
  count: number;
  children?: NavNode[];
  kind?: "section";
};

function splitCats(cat?: string): string[] {
  if (!cat) return [];
  return cat.split(",").map((s) => s.trim()).filter(Boolean);
}

function isCategoryActive(facets: FacetCounts | null, filter: BrowseFilter): boolean {
  if (!facets?.activeCategorySlugs?.length) return true;
  const active = new Set(facets.activeCategorySlugs);
  const cats = splitCats(filter.category);
  if (!cats.length) return true;
  // grup: en az bir aktif slug varsa göster
  if (cats.length > 1) return cats.some((c) => active.has(c) || active.has(c.split("-")[0]));
  const c = cats[0];
  if (active.has(c)) return true;
  // kök (ikinci-el) — çocuklar aktifse kök de aktif sayılır
  if (facets.activeCategorySlugs.some((s) => s === c || s.startsWith(`${c}-`))) return true;
  return false;
}

function browseConfig(facets: FacetCounts | null): BrowseNavConfig {
  return facets?.browseNavConfig || DEFAULT_BROWSE_NAV_CONFIG;
}

function isBrowseNodeVisible(facets: FacetCounts | null, id: string, filter: BrowseFilter): boolean {
  if (filter.category === "arac" && !filter.subtype) return true; // kök Vasıta
  if ((filter.category === "konut" || filter.category === "kiralik") && !filter.subtype) return true;
  const key = resolveBrowseNodeKey(id, filter);
  return isNodeActive(browseConfig(facets), key);
}

function pruneNavTree(nodes: NavNode[], facets: FacetCounts | null): NavNode[] {
  const showEmpty = facets?.showEmptyCategories !== false;
  const cfg = browseConfig(facets);
  return nodes
    .map((n) => {
      if (n.kind === "section") return n;
      const children = n.children ? pruneNavTree(n.children, facets) : undefined;
      return { ...n, children: children?.length ? children : undefined };
    })
    .filter((n) => {
      if (n.kind === "section") return true;
      if (!isCategoryActive(facets, n.filter)) return false;
      if (!isBrowseNodeVisible(facets, n.id, n.filter)) return false;
      if (showEmpty) return true;
      if (n.count > 0) return true;
      if (n.children?.length) return true;
      return false;
    })
    .map((n, i) => ({ n, i }))
    .sort((a, b) => {
      if (a.n.kind === "section" || b.n.kind === "section") return a.i - b.i;
      const ka = resolveBrowseNodeKey(a.n.id, a.n.filter);
      const kb = resolveBrowseNodeKey(b.n.id, b.n.filter);
      return sortOrderFor(cfg, ka, a.i) - sortOrderFor(cfg, kb, b.i);
    })
    .map(({ n }) => n);
}

function toNavTree(source: BrowseNode[], facets: FacetCounts | null): NavNode[] {
  const cfg = browseConfig(facets);
  function mapNode(node: BrowseNode): NavNode {
    if (node.kind === "section") {
      return { id: node.id, name: node.name, filter: node.filter || {}, count: 0, kind: "section" };
    }
    const count = facets ? countForBrowseFilter(facets, node.filter) : 0;
    let children = node.children?.map(mapNode);
    const key = resolveBrowseNodeKey(node.id, node.filter);
    const name = displayNameFor(cfg, key, node.name);

    // Vasıta: alt tip → marka → model → paket (mevcut çocuklar korunur — örn. İş Makineleri)
    if (node.filter.category === "arac" && node.filter.subtype && facets) {
      const brands = buildVehicleBrandNodes(node.filter.subtype, facets);
      const brandNodes: NavNode[] = brands.map((b) => ({
        id: `arac/${node.filter.subtype}/${b.slug}`,
        name: b.name,
        filter: { category: "arac", subtype: node.filter.subtype, brand: b.slug },
        count: b.count,
        children: b.models.map((m) => ({
          id: `arac/${node.filter.subtype}/${b.slug}/${m.slug}`,
          name: m.name,
          filter: {
            category: "arac",
            subtype: node.filter.subtype,
            brand: b.slug,
            model: m.slug,
          },
          count: m.count,
          children: m.trims.length
            ? m.trims.map((t) => ({
                id: `arac/${node.filter.subtype}/${b.slug}/${m.slug}/${t.slug}`,
                name: t.name,
                filter: {
                  category: "arac",
                  subtype: node.filter.subtype,
                  brand: b.slug,
                  model: m.slug,
                  trim: t.slug,
                },
                count: t.count,
              }))
            : undefined,
        })),
      }));
      children = [...(children || []), ...brandNodes];
    }

    return { id: node.id, name, filter: node.filter, count, children };
  }

  return pruneNavTree(source.map(mapNode), facets);
}

function rootIcon(node: NavNode, active: boolean): ReactNode {
  const Icon = ROOT_LUCIDE[node.id] || ROOT_LUCIDE[splitCats(node.filter.category)[0] || ""];
  if (Icon) return <Icon size={16} strokeWidth={active ? 2.25 : 1.75} />;
  const slug = splitCats(node.filter.category)[0] || node.id;
  return getCatIcon(slug, 16);
}

function NodeRow({
  node,
  depth,
  openIds,
  activeId,
  onToggle,
  onPick,
}: {
  node: NavNode;
  depth: number;
  openIds: Set<string>;
  activeId: string | null;
  onToggle: (id: string) => void;
  onPick: (node: NavNode) => void;
}) {
  if (node.kind === "section") {
    return (
      <div
        className="v2-browse-section"
        style={{
          marginTop: depth === 0 ? 10 : 6,
          paddingTop: 10,
          borderTop: "1px solid var(--line)",
          paddingLeft: 8 + depth * 12,
          paddingRight: 6,
          paddingBottom: 4,
        }}
      >
        <div
          style={{
            fontSize: 13,
            fontWeight: 800,
            color: "#0f172a",
            letterSpacing: "0.02em",
          }}
        >
          {node.name}
        </div>
      </div>
    );
  }

  const hasChildren = Boolean(node.children?.length);
  const open = openIds.has(node.id);
  const active = activeId === node.id;

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 2,
          paddingLeft: 8 + depth * 12,
          paddingRight: 6,
          borderRadius: 8,
          background: active ? "rgba(255, 106, 0, 0.1)" : "transparent",
        }}
      >
        {hasChildren ? (
          <button
            type="button"
            aria-label={open ? "Kapat" : "Aç"}
            onClick={() => onToggle(node.id)}
            style={{
              border: "none",
              background: "transparent",
              padding: 4,
              cursor: "pointer",
              color: "#64748b",
              display: "grid",
              placeItems: "center",
              flexShrink: 0,
            }}
          >
            {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        ) : (
          <span style={{ width: 22, flexShrink: 0 }} />
        )}
        <button
          type="button"
          onClick={() => {
            onPick(node);
            if (hasChildren && !open) onToggle(node.id);
          }}
          style={{
            flex: 1,
            textAlign: "left",
            border: "none",
            background: "transparent",
            padding: "7px 4px",
            cursor: "pointer",
            fontWeight: active ? 800 : depth === 0 ? 750 : 600,
            fontSize: depth === 0 ? 13.5 : 12.5,
            color: active ? "var(--orange)" : depth === 0 ? "#5f6368" : "#6b7280",
            display: "flex",
            alignItems: "center",
            gap: 8,
            minWidth: 0,
          }}
        >
          {depth === 0 && (
            <span
              className="v2-side-ico"
              style={{ color: "inherit", width: 18, display: "grid", placeItems: "center", flexShrink: 0 }}
            >
              {rootIcon(node, active)}
            </span>
          )}
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
            {node.name}
          </span>
          <span style={{ color: "#94a3b8", fontWeight: 700, fontSize: 12, flexShrink: 0 }}>({node.count})</span>
        </button>
      </div>
      {hasChildren && open && (
        <div>
          {node.children!.map((ch) => (
            <NodeRow
              key={ch.id}
              node={ch}
              depth={depth + 1}
              openIds={openIds}
              activeId={activeId}
              onToggle={onToggle}
              onPick={onPick}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function categoryOverlap(filterCat: string | undefined, selected: string): boolean {
  if (!filterCat || !selected) return false;
  if (filterCat === selected) return true;
  const a = splitCats(filterCat);
  const b = splitCats(selected);
  if (a.some((x) => b.includes(x))) return true;
  if (a.length === 1 && b.some((x) => x === a[0] || x.startsWith(`${a[0]}-`))) return true;
  if (b.length === 1 && a.some((x) => x === b[0] || x.startsWith(`${b[0]}-`))) return true;
  return false;
}

function matchNavPath(filters: SearchFilters, tree: NavNode[]): string[] {
  const path: string[] = [];
  function score(n: NavNode) {
    if (n.kind === "section") return -1;
    const f = n.filter;
    let s = 0;
    if (f.category && categoryOverlap(f.category, filters.category)) {
      s += f.category === filters.category ? 8 : 4;
    } else if (f.category && filters.category) {
      return -1;
    }
    if (f.dealType && f.dealType === filters.dealType) s += 3;
    if (f.subtype && f.subtype === filters.subtype) s += 4;
    if (f.rental && f.rental === filters.rental) s += 2;
    if (f.brand && f.brand === filters.brand) s += 5;
    if (f.model && f.model === filters.model) s += 6;
    if (f.trim && f.trim === filters.trim) s += 7;
    if (f.dealType && !filters.dealType) return -1;
    if (f.subtype && !filters.subtype) return -1;
    if (f.brand && !filters.brand) return -1;
    if (f.model && !filters.model) return -1;
    if (f.trim && !filters.trim) return -1;
    if (f.rental && !filters.rental) return -1;
    return s;
  }
  function walk(nodes: NavNode[], trail: string[]) {
    let best: NavNode | null = null;
    let bestScore = -1;
    for (const n of nodes) {
      const sc = score(n);
      if (sc > bestScore) {
        bestScore = sc;
        best = n;
      }
    }
    if (!best || bestScore < 0) return;
    const next = [...trail, best.id];
    path.length = 0;
    path.push(...next);
    if (best.children?.length) walk(best.children, next);
  }
  if (filters.category) walk(tree, []);
  return path;
}

function findNodeByPath(tree: NavNode[], path: string[]): NavNode | null {
  let nodes = tree;
  let found: NavNode | null = null;
  for (const id of path) {
    found = nodes.find((n) => n.id === id && n.kind !== "section") || null;
    if (!found) return null;
    nodes = found.children || [];
  }
  return found;
}

/** Filtre eşleşmesinden Sahibinden drill yolu: çocuklu düğümler dahil, yaprak hariç */
function drillPathFromMatch(matchedPath: string[], tree: NavNode[]): string[] {
  if (!matchedPath.length) return [];
  let nodes = tree;
  const out: string[] = [];
  for (const id of matchedPath) {
    const n = nodes.find((x) => x.id === id && x.kind !== "section");
    if (!n) break;
    if (n.children?.length) {
      out.push(n.id);
      nodes = n.children;
    } else {
      break;
    }
  }
  return out;
}

function getDrillView(tree: NavNode[], path: string[]): { trail: NavNode[]; list: NavNode[] } {
  if (!path.length) {
    return { trail: [], list: tree.filter((n) => n.kind !== "section" || true) };
  }
  let nodes = tree;
  const trail: NavNode[] = [];
  for (const id of path) {
    const found = nodes.find((n) => n.id === id && n.kind !== "section");
    if (!found) break;
    trail.push(found);
    nodes = found.children || [];
  }
  // Yalnızca mevcut seviyenin çocukları — kardeş dallar yok
  return { trail, list: nodes.filter((n) => n.kind !== "section") };
}

function DrillRow({
  node,
  depth,
  active,
  isTrail,
  onClick,
}: {
  node: NavNode;
  depth: number;
  active: boolean;
  isTrail: boolean;
  onClick: () => void;
}) {
  /** Sahibinden: iz ve seçimler mavi link */
  const linkColor = isTrail || active || depth > 0 ? "#184e9e" : "#5f6368";

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: 8,
        paddingLeft: 8 + depth * 14,
        paddingRight: 8,
        paddingTop: 7,
        paddingBottom: 7,
        border: "none",
        borderRadius: 6,
        cursor: "pointer",
        textAlign: "left",
        background: "transparent",
        fontWeight: isTrail || active ? 700 : depth === 0 ? 750 : 600,
        fontSize: depth === 0 ? 13.5 : 13,
        color: linkColor,
        fontFamily: "inherit",
      }}
    >
      {depth === 0 ? (
        <span
          className="v2-side-ico"
          style={{ color: "inherit", width: 18, display: "grid", placeItems: "center", flexShrink: 0 }}
        >
          {rootIcon(node, isTrail || active)}
        </span>
      ) : null}
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
        {node.name}
      </span>
      <span style={{ color: "#94a3b8", fontWeight: 700, fontSize: 12, flexShrink: 0 }}>
        ({node.count})
      </span>
    </button>
  );
}

export function CategoryBrowseNav({
  filters,
  facets,
  onSelect,
  embedded = false,
  rootsOnly,
  hideHeader = false,
  variant = "default",
}: Props) {
  /** classic/alisveris: Sahibinden drill (ayara göre); tree/default: klasik accordion */
  const sahibindenMode =
    (variant === "classic" || variant === "alisveris") &&
    browseConfig(facets || null).sahibindenTreeExpand !== false;

  const tree = useMemo(() => {
    const source =
      variant === "classic"
        ? CLASSIC_BROWSE_TREE
        : variant === "alisveris"
          ? ALISVERIS_BROWSE_TREE
          : CATEGORY_BROWSE_TREE;
    const full = toNavTree(source, facets || null);
    if (!rootsOnly?.length) return full;
    const allow = new Set(rootsOnly);
    return full.filter((n) => allow.has(n.id));
  }, [facets, rootsOnly?.join("|"), variant]);

  const matchedPath = useMemo(() => matchNavPath(filters, tree), [filters, tree]);
  const [openIds, setOpenIds] = useState<Set<string>>(() => new Set(matchedPath));
  const [drillPath, setDrillPath] = useState<string[]>(() =>
    drillPathFromMatch(matchedPath, tree)
  );
  const skipSyncRef = useRef(false);

  useEffect(() => {
    if (sahibindenMode) {
      if (skipSyncRef.current) {
        skipSyncRef.current = false;
        return;
      }
      setDrillPath(drillPathFromMatch(matchedPath, tree));
      return;
    }
    setOpenIds((prev) => {
      const next = new Set(prev);
      matchedPath.forEach((id) => next.add(id));
      return next;
    });
  }, [matchedPath.join("|"), sahibindenMode, tree]);

  const activeId = matchedPath[matchedPath.length - 1] || null;
  const hasFilter = Boolean(
    filters.category ||
      filters.subtype ||
      filters.dealType ||
      filters.rental ||
      filters.brand ||
      filters.model ||
      filters.trim
  );

  function toggle(id: string) {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function applyFilter(patch: ReturnType<typeof browseFilterToSearchPatch>) {
    skipSyncRef.current = true;
    onSelect(patch);
  }

  function clearFilters() {
    skipSyncRef.current = true;
    setDrillPath([]);
    onSelect({
      category: "",
      dealType: "",
      subtype: "",
      rental: "",
      brand: "",
      model: "",
      trim: "",
    });
  }

  /** Trail satırına tık: o seviyeye çık (çocukları göster); aynı en alt satıra tekrar → bir üst */
  function onTrailClick(trailIndex: number) {
    const isDeepest = trailIndex === drillPath.length - 1;
    const nextPath = isDeepest
      ? drillPath.slice(0, Math.max(0, trailIndex))
      : drillPath.slice(0, trailIndex + 1);
    skipSyncRef.current = true;
    setDrillPath(nextPath);
    if (nextPath.length === 0) {
      onSelect({
        category: "",
        dealType: "",
        subtype: "",
        rental: "",
        brand: "",
        model: "",
        trim: "",
      });
      return;
    }
    const parent = findNodeByPath(tree, nextPath);
    if (parent) applyFilter(browseFilterToSearchPatch(parent.filter));
  }

  function onDrillPick(node: NavNode) {
    if (node.kind === "section") return;
    applyFilter(browseFilterToSearchPatch(node.filter));
    if (node.children?.length) {
      setDrillPath([...drillPath, node.id]);
    }
  }

  const drill = useMemo(
    () => (sahibindenMode ? getDrillView(tree, drillPath) : null),
    [sahibindenMode, tree, drillPath.join("|")]
  );

  const treeBox = (
    <div
      className={embedded ? "v2-browse-tree" : undefined}
      style={
        embedded
          ? undefined
          : {
              border: "1px solid var(--line)",
              borderRadius: 12,
              padding: "6px 4px",
              background: "#fff",
            }
      }
    >
      {sahibindenMode && drill ? (
        <div style={{ display: "grid", gap: 0 }}>
          {/* Üst iz: Vasıta → Otomobil → Mercedes — kardeş yok */}
          {drill.trail.map((node, i) => (
            <DrillRow
              key={`trail-${node.id}`}
              node={node}
              depth={i}
              active={false}
              isTrail
              onClick={() => onTrailClick(i)}
            />
          ))}
          {/* Yalnızca açık dalın çocukları (Audi/BMW gizlenir) */}
          {drill.list.map((node) => (
            <DrillRow
              key={node.id}
              node={node}
              depth={drill.trail.length}
              active={activeId === node.id}
              isTrail={false}
              onClick={() => onDrillPick(node)}
            />
          ))}
        </div>
      ) : (
        tree.map((node) => (
          <NodeRow
            key={node.id}
            node={node}
            depth={0}
            openIds={openIds}
            activeId={activeId}
            onToggle={toggle}
            onPick={(n) => onSelect(browseFilterToSearchPatch(n.filter))}
          />
        ))
      )}
    </div>
  );

  if (hideHeader) {
    return (
      <nav aria-label="Kategori ağacı" className={embedded ? "v2-browse-nav" : undefined}>
        {treeBox}
      </nav>
    );
  }

  if (embedded) {
    return (
      <nav aria-label="Kategoriler" className="v2-browse-nav">
        <div className="v2-browse-head">
          <h2 className="v2-side-title" style={{ margin: 0 }}>
            Kategoriler
          </h2>
          {(hasFilter || drillPath.length > 0) && (
            <button type="button" className="v2-browse-all" onClick={clearFilters}>
              Tümü
            </button>
          )}
        </div>
        {treeBox}
      </nav>
    );
  }

  return (
    <nav aria-label="Kategoriler" style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Kategoriler</h2>
        {(hasFilter || drillPath.length > 0) && (
          <button
            type="button"
            onClick={clearFilters}
            style={{
              border: "none",
              background: "transparent",
              color: "var(--orange)",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              padding: 0,
            }}
          >
            Tümü
          </button>
        )}
      </div>
      {treeBox}
    </nav>
  );
}
