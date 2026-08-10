"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, Smartphone, Sofa, Shirt, Bike, Package, Utensils, Wrench } from "lucide-react";
import { isAlisverisCategorySlug } from "@/data/classicBrowseTree";
import { browseFilterToSearchPatch, type BrowseFilter } from "@/data/categoryBrowseTree";
import type { SearchFilters } from "@/components/SearchPanel";
import { useAlisverisBrowseTree } from "@/hooks/useAlisverisBrowseTree";

type Props = {
  filters: SearchFilters;
  onSelect: (patch: ReturnType<typeof browseFilterToSearchPatch>) => void;
  alwaysShowClassicBack?: boolean;
};

const GROUP_ICON: Record<string, typeof Smartphone> = {
  elektronik: Smartphone,
  "alisveris/elektronik": Smartphone,
  "ev-yasam": Sofa,
  "alisveris/ev-ve-yasam": Sofa,
  "ev-aletleri": Wrench,
  "alisveris/ev-aletleri": Wrench,
  moda: Shirt,
  "alisveris/moda": Shirt,
  hobi: Bike,
  "spor-outdoor": Bike,
  "alisveris/spor-outdoor": Bike,
  "mutfak-ve-sofra": Utensils,
  "alisveris/mutfak-ve-sofra": Utensils,
  diger: Package,
};

/** Ana sayfa: klasik menünün altında Alışveriş grubu → /alisveris (DB tree) */
export function AlisverisBrowseSection({ filters, onSelect, alwaysShowClassicBack }: Props) {
  const { tree } = useAlisverisBrowseTree();
  const [openIds, setOpenIds] = useState<Set<string>>(() => new Set());
  const [userCollapsed, setUserCollapsed] = useState<Set<string>>(() => new Set());
  const [verticalEnabled, setVerticalEnabled] = useState(true);

  useEffect(() => {
    fetch("/api/theme")
      .then((r) => r.json())
      .then((d) => {
        if (typeof d?.alisverisEnabled === "boolean") setVerticalEnabled(d.alisverisEnabled);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!filters.category || !isAlisverisCategorySlug(filters.category)) return;
    const match = tree.find((n) => {
      const cat = n.filter.category || "";
      return (
        filters.category === cat ||
        filters.category === n.id ||
        (n.children || []).some((c) => {
          const ch = c.filter.category || "";
          return (
            filters.category === ch ||
            Boolean(filters.category && ch && filters.category.split(",").some((p) => ch.includes(p)))
          );
        })
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

  const shopActive = isAlisverisCategorySlug(filters.category);
  const showClassicBack = alwaysShowClassicBack || shopActive;

  if (!verticalEnabled) return null;

  return (
    <div className="v2-filter-block v2-alisveris-block" style={{ marginTop: 4 }}>
      <div className="v2-filter-label" style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button
          type="button"
          onClick={() =>
            onSelect({
              category: "alisveris",
              dealType: "",
              subtype: "",
              rental: "",
              brand: "",
              model: "",
              version: "",
              trim: "",
            })
          }
          style={{
            border: "none",
            background: "transparent",
            padding: 0,
            cursor: "pointer",
            font: "inherit",
            color: shopActive ? "var(--orange)" : "inherit",
            fontWeight: shopActive ? 800 : undefined,
          }}
        >
          Alışveriş
        </button>
        {showClassicBack && (
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
      <div className="v2-alisveris-list">
        {tree.map((node) => {
          const Icon =
            GROUP_ICON[node.id] || GROUP_ICON[node.id.replace(/^alisveris\//, "")] || Package;
          const rootCat = node.filter.category || "";
          const rootActive =
            filters.category === rootCat ||
            filters.category === node.id ||
            Boolean(
              filters.category &&
                rootCat &&
                rootCat
                  .split(",")
                  .some(
                    (p) =>
                      p &&
                      (filters.category === p ||
                        filters.category!.startsWith(`${p}-`) ||
                        filters.category!.startsWith(`${p}/`))
                  )
            );
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
                  className={`v2-alisveris-root${rootActive ? " active" : ""}`}
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
                    const active =
                      filters.category === ch.filter.category || filters.category === ch.id;
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
