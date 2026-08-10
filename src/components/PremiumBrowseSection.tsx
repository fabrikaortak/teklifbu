"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Hotel, Truck, Users } from "lucide-react";
import { buildPremiumBrowseTree } from "@/data/premiumBrowseTree";
import { isPremiumCategorySlug } from "@/data/premiumCategories";
import { browseFilterToSearchPatch, type BrowseFilter } from "@/data/categoryBrowseTree";
import type { SearchFilters } from "@/components/SearchPanel";
import { displayNameFor, isNodeActive, type BrowseNavConfig } from "@/lib/browseNavConfig";
import type { FacetCounts } from "@/lib/facetHelpers";

type Props = {
  filters: SearchFilters;
  onSelect: (patch: ReturnType<typeof browseFilterToSearchPatch>) => void;
  facets?: FacetCounts | null;
};

const VERTICAL_ICON: Record<string, typeof Hotel> = {
  hotel: Hotel,
  logistics: Truck,
  rideshare: Users,
};

/** Sidebar: klasik kategorilerin altında, Durumu’nun üstünde Premium grubu */
export function PremiumBrowseSection({ filters, onSelect, facets }: Props) {
  const [enabled, setEnabled] = useState<Record<string, boolean>>({
    hotel: true,
    logistics: true,
    rideshare: true,
  });
  const [openIds, setOpenIds] = useState<Set<string>>(() => new Set());
  const [userCollapsed, setUserCollapsed] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    fetch("/api/theme")
      .then((r) => r.json())
      .then((d) => {
        if (d?.premiumVerticals && typeof d.premiumVerticals === "object") {
          setEnabled(d.premiumVerticals);
        }
      })
      .catch(() => {});
  }, []);

  const browseCfg: BrowseNavConfig | undefined = facets?.browseNavConfig;

  const tree = useMemo(() => {
    const raw = buildPremiumBrowseTree(enabled);
    if (!browseCfg) return raw;
    return raw
      .filter((n) => isNodeActive(browseCfg, n.id))
      .map((n) => ({
        ...n,
        name: displayNameFor(browseCfg, n.id, n.name),
        children: (n.children || [])
          .filter((c) => isNodeActive(browseCfg, c.id))
          .map((c) => ({
            ...c,
            name: displayNameFor(browseCfg, c.id, c.name),
          })),
      }))
      .filter((n) => {
        if (!facets?.activeCategorySlugs?.length) return true;
        const cat = n.filter.category || "";
        if (!cat) return true;
        const active = new Set(facets.activeCategorySlugs);
        if (active.has(cat)) return true;
        return facets.activeCategorySlugs.some((s) => s === cat || s.startsWith(`${cat}-`));
      });
  }, [enabled, browseCfg, facets?.activeCategorySlugs]);

  useEffect(() => {
    if (!filters.category || !isPremiumCategorySlug(filters.category)) return;
    const match = tree.find((n) => {
      const cat = n.filter.category || "";
      return (
        filters.category === cat ||
        filters.category.startsWith(`${cat}-`) ||
        (n.children || []).some((c) => c.filter.category === filters.category)
      );
    });
    if (!match || userCollapsed.has(match.id)) return;
    setOpenIds((prev) => {
      if (prev.has(match.id)) return prev;
      const next = new Set(prev);
      next.add(match.id);
      return next;
    });
  }, [filters.category, tree, userCollapsed]);

  if (!tree.length) return null;

  function pick(filter: BrowseFilter) {
    onSelect(browseFilterToSearchPatch(filter));
  }

  function toggleOpen(id: string) {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        setUserCollapsed((c) => new Set(c).add(id));
      } else {
        next.add(id);
        setUserCollapsed((c) => {
          const n = new Set(c);
          n.delete(id);
          return n;
        });
      }
      return next;
    });
  }

  const premiumActive = isPremiumCategorySlug(filters.category);

  return (
    <div className="v2-filter-block v2-premium-block" style={{ marginTop: 4 }}>
      <div className="v2-filter-label" style={{ display: "flex", alignItems: "center", gap: 8 }}>
        Premium
        {premiumActive && (
          <button
            type="button"
            className="v2-browse-all"
            style={{ marginLeft: "auto", fontSize: 11 }}
            onClick={() =>
              onSelect({
                category: "",
                dealType: "",
                subtype: "",
                rental: "",
                brand: "",
                model: "",
                version: "",
                trim: "",
              })
            }
          >
            Klasik vitrine dön
          </button>
        )}
      </div>
      <div className="v2-premium-list">
        {tree.map((node) => {
          const vertical = node.id.replace("premium/", "").split("/")[0];
          const Icon = VERTICAL_ICON[vertical] || Hotel;
          const rootCat = node.filter.category || "";
          const rootActive =
            filters.category === rootCat ||
            Boolean(filters.category?.startsWith(`${rootCat}-`));
          const hasChildren = Boolean(node.children?.length);
          const open = openIds.has(node.id);

          return (
            <div key={node.id}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 2,
                  borderRadius: 8,
                  background: rootActive ? "rgba(255, 106, 0, 0.1)" : "transparent",
                }}
              >
                {hasChildren ? (
                  <button
                    type="button"
                    aria-label={open ? "Kapat" : "Aç"}
                    onClick={() => toggleOpen(node.id)}
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
                  className={`v2-premium-root${rootActive ? " active" : ""}`}
                  onClick={() => {
                    pick(node.filter);
                    if (hasChildren && !open) {
                      setOpenIds((prev) => new Set(prev).add(node.id));
                      setUserCollapsed((c) => {
                        const n = new Set(c);
                        n.delete(node.id);
                        return n;
                      });
                    }
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    flex: 1,
                    border: "none",
                    background: "transparent",
                    color: rootActive ? "var(--orange)" : "#5f6368",
                    fontWeight: rootActive ? 800 : 750,
                    fontSize: 13.5,
                    padding: "8px 6px 8px 2px",
                    borderRadius: 8,
                    cursor: "pointer",
                    textAlign: "left",
                    minWidth: 0,
                  }}
                >
                  <Icon size={16} strokeWidth={rootActive ? 2.25 : 1.75} />
                  <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {node.name}
                  </span>
                </button>
              </div>
              {open && hasChildren ? (
                <div style={{ paddingLeft: 22 }}>
                  {node.children!.map((ch) => {
                    const active = filters.category === ch.filter.category;
                    return (
                      <button
                        key={ch.id}
                        type="button"
                        onClick={() => pick(ch.filter)}
                        style={{
                          display: "block",
                          width: "100%",
                          border: "none",
                          background: active ? "rgba(255, 106, 0, 0.08)" : "transparent",
                          color: active ? "var(--orange)" : "#6b7280",
                          fontWeight: active ? 750 : 600,
                          fontSize: 12.5,
                          padding: "6px 8px",
                          borderRadius: 6,
                          cursor: "pointer",
                          textAlign: "left",
                        }}
                      >
                        {ch.name}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
