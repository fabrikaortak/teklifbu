"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  V2_ALISVERIS_STRIP,
  V2_CLASSIC_STRIP,
  V2_NAV_CATS,
  classicCatIcon,
  resolveCatSlug,
  v2CatIcon,
  type V2NavCat,
} from "@/components/home/v2StripCats";
import { CategoryMegaMenu } from "@/components/home/CategoryMegaMenu";
import type { SearchFilters } from "@/components/SearchPanel";
import { useTheme } from "@/components/ThemeProvider";
import { ShoppingCartControl } from "@/components/cart/ShoppingCartControl";
import { useAlisverisBrowseTree } from "@/hooks/useAlisverisBrowseTree";
import {
  ChevronLeft,
  ChevronRight,
  Smartphone,
  Sofa,
  Shirt,
  Bike,
  Package,
  Utensils,
  Wrench,
  type LucideIcon,
} from "lucide-react";

type BrowsePatch = {
  category: string;
  dealType: "" | "SATILIK" | "KIRALIK" | "DEVREN_SATILIK" | "DEVREN_KIRALIK";
  subtype: string;
  rental: string;
  brand: string;
  model: string;
  version: string;
  trim: string;
};

const EMPTY_PATCH: BrowsePatch = {
  category: "",
  dealType: "",
  subtype: "",
  rental: "",
  brand: "",
  model: "",
  version: "",
  trim: "",
};

const STRIP_ICONS: Record<string, LucideIcon> = {
  elektronik: Smartphone,
  "ev-ve-yasam": Sofa,
  "ev-yasam": Sofa,
  "ev-aletleri": Wrench,
  moda: Shirt,
  "spor-outdoor": Bike,
  hobi: Bike,
  "mutfak-ve-sofra": Utensils,
  diger: Package,
};

export function V2CategoryStrip({
  filters,
  onSelect,
  mode = "home",
}: {
  filters: Pick<SearchFilters, "category">;
  onSelect: (patch: BrowsePatch) => void;
  mode?: "home" | "alisveris";
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { categoriesTheme, shoppingCartPlacement, menuTheme } = useTheme();
  const classicCats = categoriesTheme === "v2";
  const { tree: dbTree } = useAlisverisBrowseTree();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);
  const [megaOpen, setMegaOpen] = useState(false);
  const isAlisveris = mode === "alisveris";
  const homeLabel = isAlisveris ? "Keşfet" : "Anasayfa";
  const [megaFocusId, setMegaFocusId] = useState<string | null>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const megaEnabled = menuTheme === "mega" && mode === "alisveris";

  const dbStrip: V2NavCat[] = useMemo(
    () =>
      dbTree.map((n) => {
        const key = n.id.replace(/^alisveris\//, "");
        return {
          slug: key,
          name: n.name,
          mapTo: n.filter.category || n.id,
          Icon: STRIP_ICONS[key] || Package,
        };
      }),
    [dbTree]
  );

  const stripCats =
    mode === "alisveris"
      ? dbStrip.length
        ? dbStrip
        : V2_ALISVERIS_STRIP
      : classicCats
        ? V2_CLASSIC_STRIP
        : V2_NAV_CATS;
  const showStripCart = mode === "alisveris" && shoppingCartPlacement === "alt";

  const updateArrows = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(max > 4 && el.scrollLeft < max - 4);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateArrows();
    el.addEventListener("scroll", updateArrows, { passive: true });
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(updateArrows) : null;
    ro?.observe(el);
    window.addEventListener("resize", updateArrows);
    return () => {
      el.removeEventListener("scroll", updateArrows);
      ro?.disconnect();
      window.removeEventListener("resize", updateArrows);
    };
  }, [updateArrows, stripCats.length]);

  useEffect(() => {
    return () => {
      if (hoverTimer.current) clearTimeout(hoverTimer.current);
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, []);

  const scrollByDir = (dir: -1 | 1) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.max(220, el.clientWidth * 0.55), behavior: "smooth" });
  };

  const cancelCloseMega = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };

  const scheduleCloseMega = () => {
    if (!megaEnabled) return;
    cancelCloseMega();
    closeTimer.current = setTimeout(() => setMegaOpen(false), 180);
  };

  const openMega = (mainId?: string | null) => {
    cancelCloseMega();
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    setMegaFocusId(mainId || null);
    setMegaOpen(true);
  };

  const onStripCatEnter = (mainId: string) => {
    if (!megaEnabled) return;
    cancelCloseMega();
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => openMega(mainId), 120);
  };

  const onStripLeave = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
  };

  return (
    <nav
      className={`v2-cat-strip${megaEnabled ? " v2-cat-strip--mega" : ""}`}
      aria-label="Kategoriler"
      onMouseEnter={cancelCloseMega}
      onMouseLeave={() => {
        onStripLeave();
        scheduleCloseMega();
      }}
    >
      <div className={`v2-cat-strip-inner${showStripCart ? " v2-cat-strip-inner--with-cart" : ""}`}>
        <div className="v2-cat-strip-scroll" ref={scrollRef}>
          <button
            type="button"
            className={`v2-cat-item v2-cat-item--kesfet${!filters.category && !megaOpen ? " active" : ""}${megaOpen ? " is-mega-open" : ""}`}
            aria-label={homeLabel}
            title={homeLabel}
            aria-expanded={megaEnabled ? megaOpen : undefined}
            aria-haspopup={megaEnabled ? "dialog" : undefined}
            onClick={() => {
              if (isAlisveris) {
                if (megaEnabled) {
                  onSelect({ ...EMPTY_PATCH });
                  if (megaOpen) setMegaOpen(false);
                  else openMega(dbTree[0]?.id || null);
                  return;
                }
                onSelect({ ...EMPTY_PATCH });
                return;
              }
              // Ana sistem: Anasayfa → / ve filtreleri temizle
              onSelect({ ...EMPTY_PATCH });
              if (pathname !== "/") router.push("/");
            }}
          >
            <span className="v2-cat-ico v2-cat-ico--kesfet" aria-hidden>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="12" r="9.25" stroke="url(#kesfetRing)" strokeWidth="1.75" />
                <circle cx="12" cy="12" r="2.1" fill="#f97316" />
                <path
                  d="M12 4.6l1.15 5.05L18.4 12l-5.25 1.35L12 19.4l-1.15-6.05L5.6 12l5.25-2.35L12 4.6z"
                  fill="url(#kesfetNeedle)"
                  opacity="0.95"
                />
                <path d="M12 3.2v1.4M12 19.4v1.4M3.2 12h1.4M19.4 12h1.4" stroke="#ea580c" strokeWidth="1.5" strokeLinecap="round" />
                <defs>
                  <linearGradient id="kesfetRing" x1="4" y1="4" x2="20" y2="20">
                    <stop stopColor="#fb923c" />
                    <stop offset="1" stopColor="#ea580c" />
                  </linearGradient>
                  <linearGradient id="kesfetNeedle" x1="12" y1="4.6" x2="12" y2="19.4">
                    <stop stopColor="#f97316" />
                    <stop offset="0.48" stopColor="#fdba74" />
                    <stop offset="0.52" stopColor="#0ea5e9" />
                    <stop offset="1" stopColor="#0284c7" />
                  </linearGradient>
                </defs>
              </svg>
            </span>
            <span className="v2-cat-label">{homeLabel}</span>
          </button>
          {stripCats.map((c) => {
            const filterSlug = resolveCatSlug(c);
            const parts = filterSlug.split(",").map((s) => s.trim());
            const mainId = mode === "alisveris" ? `alisveris/${c.slug}` : null;
            const active =
              Boolean(filters.category) &&
              (filters.category === filterSlug ||
                filters.category === c.slug ||
                parts.some(
                  (p) =>
                    Boolean(p) &&
                    (filters.category === p ||
                      filters.category.startsWith(`${p}__`) ||
                      filters.category.startsWith(`${p}-`))
                ));
            const megaFocus =
              megaEnabled && megaOpen && megaFocusId === mainId;
            return (
              <button
                key={c.slug}
                type="button"
                className={`v2-cat-item${active ? " active" : ""}${megaFocus ? " is-mega-focus" : ""}`}
                onMouseEnter={() => mainId && onStripCatEnter(mainId)}
                onMouseLeave={onStripLeave}
                onClick={() => {
                  if (megaEnabled && mainId) {
                    openMega(mainId);
                    return;
                  }
                  onSelect({ ...EMPTY_PATCH, category: filterSlug });
                }}
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

        {(canLeft || canRight) && (
          <div className="v2-cat-strip-arrows" aria-hidden={false}>
            <button
              type="button"
              className="v2-cat-strip-arrow"
              aria-label="Önceki kategoriler"
              disabled={!canLeft}
              onClick={() => scrollByDir(-1)}
            >
              <ChevronLeft size={18} strokeWidth={2.2} />
            </button>
            <button
              type="button"
              className="v2-cat-strip-arrow"
              aria-label="Sonraki kategoriler"
              disabled={!canRight}
              onClick={() => scrollByDir(1)}
            >
              <ChevronRight size={18} strokeWidth={2.2} />
            </button>
          </div>
        )}

        {showStripCart ? (
          <div className="v2-cat-strip-cart">
            <ShoppingCartControl variant="strip" />
          </div>
        ) : null}
      </div>

      {megaEnabled ? (
        <CategoryMegaMenu
          open={megaOpen}
          tree={dbTree}
          focusMainId={megaFocusId}
          onClose={() => setMegaOpen(false)}
          onSelect={onSelect}
        />
      ) : null}
    </nav>
  );
}
