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
import { useAlisverisBrowseTree } from "@/hooks/useAlisverisBrowseTree";
import { useVasitaBrowseTree } from "@/hooks/useVasitaBrowseTree";

/** Kök satır ikonları — klasik v2 ile aynı */
const ROOT_LUCIDE: Record<string, LucideIcon> = {
  emlak: Home,
  konut: Home,
  arac: Car,
  "ikinci-el-sifir": ShoppingBag,
  "ikinci-el": ShoppingBag,
  "sifir-urun": Package,
  elektronik: Smartphone,
  "alisveris/elektronik": Smartphone,
  "ev-yasam": Sofa,
  "alisveris/ev-ve-yasam": Sofa,
  "ev-aletleri": Smartphone,
  "alisveris/ev-aletleri": Smartphone,
  moda: Shirt,
  "alisveris/moda": Shirt,
  hobi: Bike,
  "spor-outdoor": Bike,
  "alisveris/spor-outdoor": Bike,
  "mutfak-ve-sofra": Package,
  "alisveris/mutfak-ve-sofra": Package,
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
  /** Alışveriş DB ağacı (yoksa API’den yüklenir / TS fallback) */
  browseTree?: BrowseNode[] | null;
  /** true iken sol menüde yükleniyor iskeleti */
  treeLoading?: boolean;
};

type NavNode = {
  id: string;
  name: string;
  filter: BrowseFilter;
  count: number;
  children?: NavNode[];
  kind?: "section";
  /** Shallow catalog: children henüz yok ama açılabilir (lazy version yükle) */
  expandable?: boolean;
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
  // kök (ikinci-el) — çocuklar aktifse kök de aktif sayılır (__ ve - path)
  if (
    facets.activeCategorySlugs.some(
      (s) => s === c || s.startsWith(`${c}-`) || s.startsWith(`${c}__`)
    )
  ) {
    return true;
  }
  return false;
}

function browseConfig(facets: FacetCounts | null): BrowseNavConfig {
  return facets?.browseNavConfig || DEFAULT_BROWSE_NAV_CONFIG;
}

/** Aynı id iki kez gelmesin (React key + yanlış çocuk bağlama) */
function dedupeNavById(nodes: NavNode[]): NavNode[] {
  const seen = new Set<string>();
  const out: NavNode[] = [];
  for (const n of nodes) {
    if (seen.has(n.id)) continue;
    seen.add(n.id);
    out.push(n);
  }
  return out;
}

function isBrowseNodeVisible(facets: FacetCounts | null, id: string, filter: BrowseFilter): boolean {
  if (filter.category === "arac" && !filter.subtype) return true; // kök Vasıta
  if ((filter.category === "konut" || filter.category === "kiralik") && !filter.subtype) return true;
  const key = resolveBrowseNodeKey(id, filter);
  return isNodeActive(browseConfig(facets), key);
}

function pruneNavTree(nodes: NavNode[], facets: FacetCounts | null): NavNode[] {
  // facets henüz yokken: menü iskeletini hemen göster (Emlak/Vasıta gecikmesin).
  // hideEmptyUntilListing facet geldikten sonra uygulanır.
  const showEmpty = facets == null ? true : facets.showEmptyCategories !== false;
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

function toNavTree(
  source: BrowseNode[],
  facets: FacetCounts | null,
  vasitaCatalogBrands?: Record<
    string,
    Array<{
      slug: string;
      name: string;
      modelsLoaded?: boolean;
      models?: Array<{
        slug: string;
        name: string;
        hasVersions?: boolean;
        versions?: Array<{
          slug: string;
          name: string;
          trims?: Array<{ slug: string; name: string }>;
        }>;
        trims?: Array<{ slug: string; name: string }>;
      }>;
    }>
  > | null
): NavNode[] {
  const cfg = browseConfig(facets);
  function mapNode(node: BrowseNode): NavNode {
    if (node.kind === "section") {
      return { id: node.id, name: node.name, filter: node.filter || {}, count: 0, kind: "section" };
    }
    const count = facets ? countForBrowseFilter(facets, node.filter) : 0;
    let children = node.children?.map(mapNode);
    const key = resolveBrowseNodeKey(node.id, node.filter);
    const name = displayNameFor(cfg, key, node.name);

    // Vasıta: alt tip → marka → model → version (her seviye lazy)
    if (node.filter.category === "arac" && node.filter.subtype) {
      const subtype = String(node.filter.subtype);
      const catalog = vasitaCatalogBrands?.[subtype];
      // Alt tip henüz açılmadı — markaları çekme (ağır nav yok)
      if (catalog === undefined) {
        return { id: node.id, name, filter: node.filter, count, children, expandable: true };
      }
      // Facets gecikse bile açılan dalı göster (count=0); empty-show bayrakları açık
      const facetForNav: FacetCounts =
        facets ||
        ({
          categories: {},
          dealTypes: {},
          subtypes: {},
          brands: {},
          models: {},
          versions: {},
          trims: {},
          rentals: {},
          showEmptyBrands: true,
          showEmptyModels: true,
          showEmptyTrims: true,
          showEmptyCategories: true,
          showRootCounts: false,
          activeCategorySlugs: [],
          browseNavConfig: { hideEmptyUntilListing: false, sahibindenTreeExpand: true, nodes: {} },
        } satisfies FacetCounts);
      const brands = buildVehicleBrandNodes(subtype, facetForNav, catalog);
      const brandNodes: NavNode[] = brands.map((b) => {
        const catalogBrand = catalog.find((x) => x.slug === b.slug);
        const modelsLoaded = Boolean(catalogBrand?.modelsLoaded);
        const modelNodes = b.models.map((m) => {
          const versionChildren = m.versions.length
            ? m.versions.map((v) => ({
                id: `arac/${subtype}/${b.slug}/${m.slug}/${v.slug}`,
                name: v.name,
                filter: {
                  category: "arac",
                  subtype,
                  brand: b.slug,
                  model: m.slug,
                  version: v.slug,
                },
                count: v.count,
                children: v.trims.length
                  ? v.trims.map((t) => ({
                      id: `arac/${subtype}/${b.slug}/${m.slug}/${v.slug}/${t.slug}`,
                      name: t.name,
                      filter: {
                        category: "arac",
                        subtype,
                        brand: b.slug,
                        model: m.slug,
                        version: v.slug,
                        trim: t.slug,
                      },
                      count: t.count,
                    }))
                  : undefined,
              }))
            : undefined;
          return {
            id: `arac/${subtype}/${b.slug}/${m.slug}`,
            name: m.name,
            filter: { category: "arac", subtype, brand: b.slug, model: m.slug },
            count: m.count,
            children: versionChildren,
            expandable: Boolean(m.hasVersions) && !versionChildren?.length,
          };
        });
        return {
          id: `arac/${subtype}/${b.slug}`,
          name: b.name,
          filter: { category: "arac", subtype, brand: b.slug },
          count: b.count,
          children: modelsLoaded ? modelNodes : undefined,
          expandable: !modelsLoaded,
        };
      });
      /**
       * Hub (Elektrikli Araçlar vb.): DB alt tipleri kalsın — marka ekleme.
       *   Aksi halde aynı id iki kez gelir (örn. elektrikli-otomobil) → React key çakışması,
       *   yanlış marka modelleri başka markanın altında görünür.
       * Yaprak (Otomobil / Arazi): yalnızca marka listesi.
       */
      const structural = children || [];
      if (structural.length > 0) {
        children = dedupeNavById(structural);
      } else {
        children = brandNodes;
      }
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
  showRootCounts,
}: {
  node: NavNode;
  depth: number;
  openIds: Set<string>;
  activeId: string | null;
  onToggle: (id: string) => void;
  onPick: (node: NavNode) => void;
  showRootCounts: boolean;
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

  const hasChildren = Boolean(node.children?.length) || Boolean(node.expandable);
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
          {showRootCounts || depth > 0 ? (
            <span style={{ color: "#94a3b8", fontWeight: 700, fontSize: 12, flexShrink: 0 }}>({node.count})</span>
          ) : null}
        </button>
      </div>
      {hasChildren && open && (
        <div>
          {node.children?.length ? (
            node.children.map((ch) => (
              <NodeRow
                key={ch.id}
                node={ch}
                depth={depth + 1}
                openIds={openIds}
                activeId={activeId}
                onToggle={onToggle}
                onPick={onPick}
                showRootCounts={showRootCounts}
              />
            ))
          ) : (
            <div
              style={{
                paddingLeft: 8 + (depth + 1) * 12,
                paddingBlock: 6,
                fontSize: 12,
                color: "#94a3b8",
              }}
            >
              Yükleniyor…
            </div>
          )}
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
    if (f.version && f.version === filters.version) s += 7;
    if (f.trim && f.trim === filters.trim) s += 8;
    if (f.dealType && !filters.dealType) return -1;
    if (f.subtype && !filters.subtype) return -1;
    if (f.brand && !filters.brand) return -1;
    if (f.model && !filters.model) return -1;
    if (f.version && !filters.version) return -1;
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
    return { trail: [], list: dedupeNavById(tree.filter((n) => n.kind !== "section")) };
  }
  let nodes = tree;
  const trail: NavNode[] = [];
  for (const id of path) {
    const found = nodes.find((n) => n.id === id && n.kind !== "section");
    if (!found) break;
    trail.push(found);
    nodes = found.children || [];
  }
  // Yalnızca mevcut seviyenin çocukları — kardeş dallar yok; id tek olsun
  return { trail, list: dedupeNavById(nodes.filter((n) => n.kind !== "section")) };
}

function DrillRow({
  node,
  depth,
  active,
  isTrail,
  onClick,
  showRootCounts,
}: {
  node: NavNode;
  depth: number;
  active: boolean;
  isTrail: boolean;
  onClick: () => void;
  showRootCounts: boolean;
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
      {showRootCounts || depth > 0 ? (
        <span style={{ color: "#94a3b8", fontWeight: 700, fontSize: 12, flexShrink: 0 }}>
          ({node.count})
        </span>
      ) : null}
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
  browseTree = null,
  treeLoading = false,
}: Props) {
  /**
   * Sahibinden drill: kardeş dallar gizlenir.
   * Kategoriler teması «v2» → variant classic → her zaman drill.
   * «Ağaç» → variant default → accordion (sahibindenTreeExpand bayrağına bakılmaz).
   * Alışveriş menüsü de drill kullanır.
   */
  const sahibindenMode = variant === "classic" || variant === "alisveris";

  const dbAlisveris = useAlisverisBrowseTree();
  const dbVasita = useVasitaBrowseTree();
  const alisverisLoading = treeLoading || (variant === "alisveris" && !browseTree?.length && dbAlisveris.loading);
  const alisverisSource =
    variant === "alisveris"
      ? browseTree && browseTree.length
        ? browseTree
        : dbAlisveris.tree
      : null;

  /** Lazy: alt tip açılınca markalar; marka açılınca seriler; seri açılınca motorlar. */
  const [vasitaCatalogBrands, setVasitaCatalogBrands] = useState<
    Record<
      string,
      Array<{
        slug: string;
        name: string;
        modelsLoaded?: boolean;
        models?: Array<{
          slug: string;
          name: string;
          hasVersions?: boolean;
          versionsLoaded?: boolean;
          versions?: Array<{
            slug: string;
            name: string;
            trims?: Array<{ slug: string; name: string }>;
          }>;
        }>;
      }>
    >
  >({});
  const deepLoadingRef = useRef(new Set<string>());
  const loadedKeysRef = useRef(new Set<string>());

  async function loadSubtypeBrands(subtype: string) {
    const key = `subtype|${subtype}`;
    if (loadedKeysRef.current.has(key) || deepLoadingRef.current.has(key)) return;
    deepLoadingRef.current.add(key);
    try {
      const res = await fetch(`/api/vasita/catalog?action=brands&subtype=${encodeURIComponent(subtype)}`);
      const data = await res.json();
      if (!res.ok || data?.ok === false) return;
      const brands = (Array.isArray(data?.brands) ? data.brands : []).map(
        (b: { slug: string; name: string }) => ({
          slug: b.slug,
          name: b.name,
          modelsLoaded: false,
          models: [] as Array<{ slug: string; name: string }>,
        })
      );
      loadedKeysRef.current.add(key);
      setVasitaCatalogBrands((prev) => ({ ...prev, [subtype]: brands }));
    } catch {
      /* yeniden denenebilsin — loadedKeys ekleme */
    } finally {
      deepLoadingRef.current.delete(key);
    }
  }

  async function loadBrandModels(subtype: string, brand: string) {
    const key = `models|${subtype}|${brand}`;
    if (loadedKeysRef.current.has(key) || deepLoadingRef.current.has(key)) return;
    deepLoadingRef.current.add(key);
    try {
      const qs = new URLSearchParams({ action: "models", subtype, brand });
      const res = await fetch(`/api/vasita/catalog?${qs}`);
      const data = await res.json();
      if (!res.ok || data?.ok === false) return;
      // Yanlış markaya yazmayı engelle (eski istek geç gelirse)
      const models = (Array.isArray(data?.models) ? data.models : []).map(
        (m: { slug: string; name: string }) => ({
          slug: m.slug,
          name: m.name,
          hasVersions: true,
          versionsLoaded: false,
          versions: [] as Array<{ slug: string; name: string; trims?: Array<{ slug: string; name: string }> }>,
        })
      );
      loadedKeysRef.current.add(key);
      setVasitaCatalogBrands((prev) => {
        const list = prev[subtype] || [];
        const hasBrand = list.some((b) => b.slug === brand);
        const nextList = hasBrand
          ? list.map((b) => (b.slug !== brand ? b : { ...b, modelsLoaded: true, models }))
          : [...list, { slug: brand, name: brand, modelsLoaded: true, models }];
        return { ...prev, [subtype]: nextList };
      });
    } catch {
      /* retry ok */
    } finally {
      deepLoadingRef.current.delete(key);
    }
  }

  async function loadModelVersions(subtype: string, brand: string, model: string) {
    const key = `ver|${subtype}|${brand}|${model}`;
    if (loadedKeysRef.current.has(key) || deepLoadingRef.current.has(key)) return;
    deepLoadingRef.current.add(key);
    try {
      const qs = new URLSearchParams({ action: "generations", subtype, brand, model });
      const res = await fetch(`/api/vasita/catalog?${qs}`);
      const data = await res.json();
      if (!res.ok || data?.ok === false) return;
      const versions = Array.isArray(data?.versions)
        ? data.versions.map((v: { slug: string; name: string; trims?: Array<{ slug: string; name: string }> }) => ({
            slug: v.slug,
            name: v.name,
            trims: Array.isArray(v.trims) ? v.trims : [],
          }))
        : [];
      loadedKeysRef.current.add(key);
      setVasitaCatalogBrands((prev) => {
        if (!prev[subtype]) return prev;
        return {
          ...prev,
          [subtype]: prev[subtype].map((b) =>
            b.slug !== brand
              ? b
              : {
                  ...b,
                  modelsLoaded: true,
                  models: (b.models || []).map((m) =>
                    m.slug !== model
                      ? m
                      : { ...m, versions, versionsLoaded: true, hasVersions: versions.length > 0 }
                  ),
                }
          ),
        };
      });
    } catch {
      /* leave expandable */
    } finally {
      deepLoadingRef.current.delete(key);
    }
  }

  const tree = useMemo(() => {
    // Classic (ana sayfa / ilanlar): Emlak statik + Vasıta DB SoT (İlan Ver ile aynı ağaç).
    const classicSource: BrowseNode[] =
      variant === "classic"
        ? [
            CLASSIC_BROWSE_TREE.find((n) => n.id === "emlak") || CATEGORY_BROWSE_TREE[0],
            { ...dbVasita.root, name: "Vasıta" },
          ]
        : CLASSIC_BROWSE_TREE;
    const source =
      variant === "classic"
        ? classicSource
        : variant === "alisveris"
          ? alisverisSource || ALISVERIS_BROWSE_TREE
          : [
              CATEGORY_BROWSE_TREE.find((n) => n.id === "emlak") || CATEGORY_BROWSE_TREE[0],
              { ...dbVasita.root, name: "Vasıta" },
              ...CATEGORY_BROWSE_TREE.filter((n) => n.id !== "emlak" && n.id !== "arac"),
            ];
    const full = toNavTree(source, facets || null, vasitaCatalogBrands);
    if (!rootsOnly?.length) return full;
    const allow = new Set(rootsOnly);
    return full.filter((n) => allow.has(n.id));
  }, [facets, rootsOnly?.join("|"), variant, alisverisSource, dbVasita.root, vasitaCatalogBrands]);

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
    // tree değişince (lazy marka/seri) yolu sıfırlama — yalnızca filtre eşleşmesi değişince senkronize et
  }, [matchedPath.join("|"), sahibindenMode]);

  const activeId = matchedPath[matchedPath.length - 1] || null;
  const hasFilter = Boolean(
    filters.category ||
      filters.subtype ||
      filters.dealType ||
      filters.rental ||
      filters.brand ||
      filters.model ||
      filters.version ||
      filters.trim
  );

  function toggle(id: string) {
    setOpenIds((prev) => {
      const next = new Set(prev);
      const opening = !next.has(id);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      if (opening && id.startsWith("arac/")) {
        const parts = id.split("/");
        // 3-kademe lazy: tip → markalar, marka → seriler, seri → motorlar
        if (parts.length === 2) void loadSubtypeBrands(parts[1]);
        else if (parts.length === 3) void loadBrandModels(parts[1], parts[2]);
        else if (parts.length === 4) void loadModelVersions(parts[1], parts[2], parts[3]);
      }
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
      version: "",
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
        version: "",
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
    if (node.children?.length || node.expandable) {
      setDrillPath([...drillPath, node.id]);
      if (node.id.startsWith("arac/")) {
        const parts = node.id.split("/");
        if (parts.length === 2) void loadSubtypeBrands(parts[1]);
        else if (parts.length === 3) void loadBrandModels(parts[1], parts[2]);
        else if (parts.length === 4) void loadModelVersions(parts[1], parts[2], parts[3]);
      }
    }
  }

  const drill = useMemo(
    () => (sahibindenMode ? getDrillView(tree, drillPath) : null),
    [sahibindenMode, tree, drillPath.join("|")]
  );

  const drillListRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!sahibindenMode) return;
    const el = drillListRef.current;
    if (el) el.scrollTop = 0;
  }, [sahibindenMode, drillPath.join("|")]);

  const showRootCounts = facets?.showRootCounts === true;

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
      {alisverisLoading ? (
        <div
          style={{
            padding: "10px 8px",
            color: "var(--muted)",
            fontSize: 13,
            fontWeight: 600,
          }}
          aria-busy="true"
        >
          Kategoriler yükleniyor…
        </div>
      ) : sahibindenMode && drill ? (
        <div className="v2-browse-drill">
          {/* Üst iz sabit — kardeş yok */}
          <div className="v2-browse-drill-trail">
            {drill.trail.map((node, i) => (
              <DrillRow
                key={`trail-${node.id}`}
                node={node}
                depth={i}
                active={false}
                isTrail
                onClick={() => onTrailClick(i)}
                showRootCounts={showRootCounts}
              />
            ))}
          </div>
          {/* Açık seviyenin çocukları scroll (markalar / seriler / motorlar) */}
          <div className="v2-browse-drill-list" ref={drillListRef}>
            {drill.list.map((node) => (
              <DrillRow
                key={node.id}
                node={node}
                depth={drill.trail.length}
                active={activeId === node.id}
                isTrail={false}
                onClick={() => onDrillPick(node)}
                showRootCounts={showRootCounts}
              />
            ))}
          </div>
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
            showRootCounts={showRootCounts}
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
