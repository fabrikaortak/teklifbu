"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { MarketplaceMode } from "@/lib/marketplaceMode";

export type UiTheme = "v1" | "v2";
export type CategoriesTheme = "tree" | "v2";
export type V2GridCols = "4" | "5" | "6";
export type HeaderBelt = "navy" | "white";
export type ShoppingCartPlacement = "ust" | "alt";

const V2_COLS_MAX: Record<V2GridCols, string> = {
  "4": "1480px",
  "5": "1640px",
  "6": "1840px",
};

export type EscrowThemeConfig = {
  enabled: boolean;
  buttonLabel: string;
  shipDaysOptions: number[];
  defaultShipDays: number;
  requireSellerIban: boolean;
  allowInBiddingMode: boolean;
};

const DEFAULT_ESCROW_THEME: EscrowThemeConfig = {
  enabled: false,
  buttonLabel: "Güvenli Öde",
  shipDaysOptions: [3, 7, 10],
  defaultShipDays: 7,
  requireSellerIban: true,
  allowInBiddingMode: true,
};

type ThemeCtx = {
  theme: UiTheme;
  categoriesTheme: CategoriesTheme;
  marketplaceMode: MarketplaceMode;
  /** false = Sahibinden Teklifsiz */
  offersEnabled: boolean;
  homeGridCols: V2GridCols;
  headerBelt: HeaderBelt;
  brandName: string;
  /** Öne çıkan kartlarda yalnızca başlık + fiyat */
  featuredCardTitlePriceOnly: boolean;
  /** Öne çıkan vitrinde hover ile kartı yükselt */
  featuredCardHoverLift: boolean;
  escrow: EscrowThemeConfig;
  /** Alışveriş sepet ikonu: üst kuşak veya kategori satırı */
  shoppingCartPlacement: ShoppingCartPlacement;
  ready: boolean;
};

const STORAGE_KEY = "teklifbu:ui-theme";
const CAT_STORAGE_KEY = "teklifbu:ui-categories-theme";
const COLS_STORAGE_KEY = "teklifbu:v2-grid-cols";
const BELT_STORAGE_KEY = "teklifbu:v2-header-belt";
const MODE_STORAGE_KEY = "teklifbu:marketplace-mode";

function readCachedTheme(): UiTheme {
  if (typeof window === "undefined") return "v1";
  try {
    const t = localStorage.getItem(STORAGE_KEY);
    if (t === "v2" || t === "v1") return t;
  } catch {
    /* ignore */
  }
  return "v1";
}

function readCachedCategoriesTheme(): CategoriesTheme {
  if (typeof window === "undefined") return "v2";
  try {
    const t = localStorage.getItem(CAT_STORAGE_KEY);
    if (t === "v2" || t === "tree") return t;
  } catch {
    /* ignore */
  }
  return "v2";
}

function readCachedCols(): V2GridCols {
  if (typeof window === "undefined") return "4";
  try {
    const t = localStorage.getItem(COLS_STORAGE_KEY);
    if (t === "5" || t === "6" || t === "4") return t;
  } catch {
    /* ignore */
  }
  return "4";
}

function readCachedBelt(): HeaderBelt {
  if (typeof window === "undefined") return "navy";
  try {
    const t = localStorage.getItem(BELT_STORAGE_KEY);
    if (t === "white" || t === "navy") return t;
  } catch {
    /* ignore */
  }
  return "navy";
}

function readCachedMarketplaceMode(): MarketplaceMode {
  if (typeof window === "undefined") return "bidding";
  try {
    const t = localStorage.getItem(MODE_STORAGE_KEY);
    if (t === "classified") return "classified";
  } catch {
    /* ignore */
  }
  return "bidding";
}

function applyV2Layout(cols: V2GridCols) {
  const root = document.documentElement;
  root.setAttribute("data-v2-cols", cols);
  root.style.setProperty("--v2-grid-cols", cols);
  root.style.setProperty("--v2-max", V2_COLS_MAX[cols]);
  root.style.setProperty("--page-max", V2_COLS_MAX[cols]);
  /* İç sayfalar ana sayfa kolon ayarından etkilenmez */
  root.style.setProperty("--content-max", "1224px");
}

function applyHeaderBelt(belt: HeaderBelt) {
  const root = document.documentElement;
  root.setAttribute("data-v2-belt", belt);
  if (belt === "white") {
    root.style.setProperty("--v2-header-bg", "#ffffff");
    root.style.setProperty("--v2-header-fg", "#0f172a");
    root.style.setProperty("--v2-logo-color", "#0f172a");
  } else {
    root.style.setProperty("--v2-header-bg", "var(--navy)");
    root.style.setProperty("--v2-header-fg", "#ffffff");
    root.style.setProperty("--v2-logo-color", "#ffffff");
  }
}

const Ctx = createContext<ThemeCtx>({
  theme: "v1",
  categoriesTheme: "v2",
  marketplaceMode: "bidding",
  offersEnabled: true,
  homeGridCols: "4",
  headerBelt: "navy",
  brandName: "TeklifBu",
  featuredCardTitlePriceOnly: false,
  featuredCardHoverLift: true,
  escrow: DEFAULT_ESCROW_THEME,
  shoppingCartPlacement: "alt",
  ready: false,
});

export function useTheme() {
  return useContext(Ctx);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<UiTheme>("v1");
  const [categoriesTheme, setCategoriesTheme] = useState<CategoriesTheme>("v2");
  const [marketplaceMode, setMarketplaceMode] = useState<MarketplaceMode>("bidding");
  const [offersEnabled, setOffersEnabled] = useState(true);
  const [homeGridCols, setHomeGridCols] = useState<V2GridCols>("4");
  const [headerBelt, setHeaderBelt] = useState<HeaderBelt>("navy");
  const [brandName, setBrandName] = useState("TeklifBu");
  const [featuredCardTitlePriceOnly, setFeaturedCardTitlePriceOnly] = useState(false);
  const [featuredCardHoverLift, setFeaturedCardHoverLift] = useState(true);
  const [escrow, setEscrow] = useState<EscrowThemeConfig>(DEFAULT_ESCROW_THEME);
  const [shoppingCartPlacement, setShoppingCartPlacement] = useState<ShoppingCartPlacement>("alt");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    function applyFromPayload(d: {
      theme?: string;
      categoriesTheme?: string;
      marketplaceMode?: string;
      offersEnabled?: boolean;
      homeGridCols?: string;
      brandName?: string;
      brandPrimary?: string;
      brandNavy?: string;
      headerBelt?: string;
      featuredCardTitlePriceOnly?: boolean;
      featuredCardHoverLift?: boolean;
      escrow?: Partial<EscrowThemeConfig>;
      shoppingCartPlacement?: string;
    }) {
      const t: UiTheme = d.theme === "v2" ? "v2" : "v1";
      const ct: CategoriesTheme = d.categoriesTheme === "v2" ? "v2" : "tree";
      const mode: MarketplaceMode = d.marketplaceMode === "classified" ? "classified" : "bidding";
      const offers = d.offersEnabled !== false && mode === "bidding";
      const cols: V2GridCols =
        d.homeGridCols === "5" || d.homeGridCols === "6" || d.homeGridCols === "4"
          ? d.homeGridCols
          : "4";
      const belt: HeaderBelt = d.headerBelt === "white" ? "white" : "navy";
      const featuredMinimal = Boolean(d.featuredCardTitlePriceOnly);
      const featuredHover = d.featuredCardHoverLift !== false;
      const cartPlacement: ShoppingCartPlacement = d.shoppingCartPlacement === "ust" ? "ust" : "alt";
      setTheme(t);
      setCategoriesTheme(ct);
      setMarketplaceMode(mode);
      setOffersEnabled(offers);
      setHomeGridCols(cols);
      setHeaderBelt(belt);
      setBrandName(String(d.brandName || "TeklifBu"));
      setFeaturedCardTitlePriceOnly(featuredMinimal);
      setFeaturedCardHoverLift(featuredHover);
      setShoppingCartPlacement(cartPlacement);
      setEscrow({
        enabled: Boolean(d.escrow?.enabled),
        buttonLabel: String(d.escrow?.buttonLabel || DEFAULT_ESCROW_THEME.buttonLabel),
        shipDaysOptions:
          Array.isArray(d.escrow?.shipDaysOptions) && d.escrow!.shipDaysOptions!.length
            ? d.escrow!.shipDaysOptions!
            : DEFAULT_ESCROW_THEME.shipDaysOptions,
        defaultShipDays: Number(d.escrow?.defaultShipDays) || DEFAULT_ESCROW_THEME.defaultShipDays,
        requireSellerIban: d.escrow?.requireSellerIban !== false,
        allowInBiddingMode: d.escrow?.allowInBiddingMode !== false,
      });
      document.documentElement.setAttribute("data-theme", t);
      document.documentElement.setAttribute("data-marketplace", mode);
      document.documentElement.setAttribute("data-offers", offers ? "1" : "0");
      document.documentElement.setAttribute(
        "data-featured-title-price",
        featuredMinimal ? "1" : "0"
      );
      document.documentElement.setAttribute(
        "data-featured-hover-lift",
        featuredHover ? "1" : "0"
      );
      document.documentElement.setAttribute("data-cart-placement", cartPlacement);
      try {
        localStorage.setItem(STORAGE_KEY, t);
        localStorage.setItem(CAT_STORAGE_KEY, ct);
        localStorage.setItem(COLS_STORAGE_KEY, cols);
        localStorage.setItem(BELT_STORAGE_KEY, belt);
        localStorage.setItem(MODE_STORAGE_KEY, mode);
      } catch {
        /* ignore */
      }
      if (t === "v1") {
        document.documentElement.removeAttribute("data-v2-cols");
        document.documentElement.removeAttribute("data-v2-belt");
        document.documentElement.style.removeProperty("--v2-grid-cols");
        document.documentElement.style.removeProperty("--v2-max");
        document.documentElement.style.removeProperty("--page-max");
        document.documentElement.style.removeProperty("--v2-header-bg");
        document.documentElement.style.removeProperty("--v2-header-fg");
        document.documentElement.style.removeProperty("--v2-logo-color");
        if (d.brandPrimary) {
          document.documentElement.style.setProperty("--orange", d.brandPrimary);
          document.documentElement.style.setProperty("--color-orange", d.brandPrimary);
        }
        if (d.brandNavy) {
          document.documentElement.style.setProperty("--navy", d.brandNavy);
          document.documentElement.style.setProperty("--color-navy", d.brandNavy);
        }
      } else {
        document.documentElement.style.removeProperty("--orange");
        document.documentElement.style.removeProperty("--color-orange");
        document.documentElement.style.removeProperty("--navy");
        document.documentElement.style.removeProperty("--color-navy");
        applyV2Layout(cols);
        applyHeaderBelt(belt);
      }
    }

    const cached = readCachedTheme();
    const cachedCols = readCachedCols();
    const cachedBelt = readCachedBelt();
    if (cached === "v2") {
      setTheme("v2");
      document.documentElement.setAttribute("data-theme", "v2");
      applyV2Layout(cachedCols);
      applyHeaderBelt(cachedBelt);
    }
    setCategoriesTheme(readCachedCategoriesTheme());
    setHomeGridCols(cachedCols);
    setHeaderBelt(cachedBelt);
    const cachedMode = readCachedMarketplaceMode();
    setMarketplaceMode(cachedMode);
    setOffersEnabled(cachedMode === "bidding");
    document.documentElement.setAttribute("data-marketplace", cachedMode);
    document.documentElement.setAttribute("data-offers", cachedMode === "bidding" ? "1" : "0");

    function loadTheme() {
      return fetch("/api/theme")
        .then((r) => r.json())
        .then(applyFromPayload)
        .catch(() => {
          document.documentElement.setAttribute("data-theme", "v1");
        });
    }

    loadTheme().finally(() => setReady(true));

    function onVisible() {
      if (document.visibilityState === "visible") loadTheme();
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  return (
    <Ctx.Provider
      value={{
        theme,
        categoriesTheme,
        marketplaceMode,
        offersEnabled,
        homeGridCols,
        headerBelt,
        brandName,
        featuredCardTitlePriceOnly,
        featuredCardHoverLift,
        escrow,
        shoppingCartPlacement,
        ready,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}
