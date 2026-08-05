"use client";

import {
  V2_ALISVERIS_STRIP,
  V2_CLASSIC_STRIP,
  V2_NAV_CATS,
  classicCatIcon,
  resolveCatSlug,
  v2CatIcon,
} from "@/components/home/v2StripCats";
import type { SearchFilters } from "@/components/SearchPanel";
import { useTheme } from "@/components/ThemeProvider";
import { ShoppingCartControl } from "@/components/cart/ShoppingCartControl";

type BrowsePatch = {
  category: string;
  dealType: "" | "SATILIK" | "KIRALIK" | "DEVREN_SATILIK" | "DEVREN_KIRALIK";
  subtype: string;
  rental: string;
  brand: string;
  model: string;
  trim: string;
};

const EMPTY_PATCH: BrowsePatch = {
  category: "",
  dealType: "",
  subtype: "",
  rental: "",
  brand: "",
  model: "",
  trim: "",
};

export function V2CategoryStrip({
  filters,
  onSelect,
  mode = "home",
}: {
  filters: Pick<SearchFilters, "category">;
  onSelect: (patch: BrowsePatch) => void;
  /** home: Emlak/Vasıta/Alışveriş · alisveris: alışveriş grupları */
  mode?: "home" | "alisveris";
}) {
  const { categoriesTheme, shoppingCartPlacement } = useTheme();
  const classicCats = categoriesTheme === "v2";
  const stripCats =
    mode === "alisveris"
      ? V2_ALISVERIS_STRIP
      : classicCats
        ? V2_CLASSIC_STRIP
        : V2_NAV_CATS;
  const showStripCart = mode === "alisveris" && shoppingCartPlacement === "alt";

  return (
    <nav className="v2-cat-strip" aria-label="Kategoriler">
      <div className={`v2-cat-strip-inner${showStripCart ? " v2-cat-strip-inner--with-cart" : ""}`}>
        <div className="v2-cat-strip-scroll">
          <button
            type="button"
            className={`v2-cat-item${!filters.category ? " active" : ""}`}
            onClick={() => onSelect({ ...EMPTY_PATCH })}
          >
            <span className="v2-cat-ico">{v2CatIcon("all", 16)}</span>
            <span className="v2-cat-label">Tümü</span>
          </button>
          {stripCats.map((c) => {
            const filterSlug = resolveCatSlug(c);
            const parts = filterSlug.split(",").map((s) => s.trim());
            const active =
              Boolean(filters.category) &&
              (filters.category === filterSlug ||
                filters.category === c.slug ||
                parts.includes(filters.category) ||
                parts.some(
                  (p) =>
                    filters.category === p ||
                    filters.category.startsWith(`${p}-`) ||
                    (p.includes("-") &&
                      filters.category.startsWith(p.split("-").slice(0, 2).join("-")))
                ));
            return (
              <button
                key={c.slug}
                type="button"
                className={`v2-cat-item${active ? " active" : ""}`}
                onClick={() => onSelect({ ...EMPTY_PATCH, category: filterSlug })}
              >
                <span className="v2-cat-ico">
                  {classicCats || mode === "alisveris"
                    ? classicCatIcon(c, active, 16)
                    : v2CatIcon(c.slug, 16)}
                </span>
                <span className="v2-cat-label">{c.name}</span>
              </button>
            );
          })}
        </div>
        {showStripCart ? (
          <div className="v2-cat-strip-cart">
            <ShoppingCartControl variant="strip" />
          </div>
        ) : null}
      </div>
    </nav>
  );
}
