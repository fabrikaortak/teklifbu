"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { MarketplaceMode } from "@/lib/marketplaceMode";

export type UiTheme = "v1" | "v2";
export type CategoriesTheme = "tree" | "v2";
export type MenuTheme = "strip" | "mega";
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
  /** Alışveriş kategori menü stili */
  menuTheme: MenuTheme;
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
  /** Emlak/Vasıta liste-vitrin kartlarında favori kalbi */
  listingCardFavoritesEnabled: boolean;
  /** Teklifsiz modda ilan detayı kalan süre sayacı */
  classifiedDetailCountdownEnabled: boolean;
  escrow: EscrowThemeConfig;
  /** Alışveriş sepet ikonu: üst kuşak veya kategori satırı */
  shoppingCartPlacement: ShoppingCartPlacement;
  /** Alışveriş dikeyi master (menü / şerit / /alisveris) */
  alisverisEnabled: boolean;
  /** Premium dikeyi master (menü / şerit / /premium) */
  premiumEnabled: boolean;
  ready: boolean;
};

const STORAGE_KEY = "teklifbu:ui-theme";
const CAT_STORAGE_KEY = "teklifbu:ui-categories-theme";
const MENU_STORAGE_KEY = "teklifbu:ui-menu-theme";
const COLS_STORAGE_KEY = "teklifbu:v2-grid-cols";
const BELT_STORAGE_KEY = "teklifbu:v2-header-belt";
const MODE_STORAGE_KEY = "teklifbu:marketplace-mode";

/** Admin tema kaydı sonrası açık sekmelerde /api/theme yeniden çekilsin */
export const THEME_CHANGED_EVENT = "teklifbu:theme-changed";

function readCachedTheme(): UiTheme | null {
  if (typeof window === "undefined") return null;
  try {
    const t = localStorage.getItem(STORAGE_KEY);
    if (t === "v2" || t === "v1") return t;
  } catch {
    /* ignore */
  }
  return null;
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

function readCachedMenuTheme(): MenuTheme {
  if (typeof window === "undefined") return "mega";
  try {
    const t = localStorage.getItem(MENU_STORAGE_KEY);
    if (t === "strip" || t === "mega") return t;
  } catch {
    /* ignore */
  }
  return "mega";
}

function readCachedCols(): V2GridCols | null {
  if (typeof window === "undefined") return null;
  try {
    const t = localStorage.getItem(COLS_STORAGE_KEY);
    if (t === "5" || t === "6" || t === "4") return t;
  } catch {
    /* ignore */
  }
  return null;
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
  menuTheme: "mega",
  marketplaceMode: "bidding",
  offersEnabled: true,
  homeGridCols: "4",
  headerBelt: "navy",
  brandName: "TeklifBu",
  featuredCardTitlePriceOnly: false,
  featuredCardHoverLift: true,
  listingCardFavoritesEnabled: true,
  classifiedDetailCountdownEnabled: true,
  escrow: DEFAULT_ESCROW_THEME,
  shoppingCartPlacement: "alt",
  alisverisEnabled: true,
  premiumEnabled: true,
  ready: false,
});

export function useTheme() {
  return useContext(Ctx);
}

export function ThemeProvider({
  children,
  initialTheme = "v1",
  initialHeaderBelt = "navy",
}: {
  children: ReactNode;
  initialTheme?: UiTheme;
  initialHeaderBelt?: HeaderBelt;
}) {
  const [theme, setTheme] = useState<UiTheme>(initialTheme);
  const [categoriesTheme, setCategoriesTheme] = useState<CategoriesTheme>("v2");
  const [menuTheme, setMenuTheme] = useState<MenuTheme>("mega");
  const [marketplaceMode, setMarketplaceMode] = useState<MarketplaceMode>("bidding");
  const [offersEnabled, setOffersEnabled] = useState(true);
  const [homeGridCols, setHomeGridCols] = useState<V2GridCols>("4");
  const [headerBelt, setHeaderBelt] = useState<HeaderBelt>(initialHeaderBelt);
  const [brandName, setBrandName] = useState("TeklifBu");
  const [featuredCardTitlePriceOnly, setFeaturedCardTitlePriceOnly] = useState(false);
  const [featuredCardHoverLift, setFeaturedCardHoverLift] = useState(true);
  const [listingCardFavoritesEnabled, setListingCardFavoritesEnabled] = useState(true);
  const [classifiedDetailCountdownEnabled, setClassifiedDetailCountdownEnabled] = useState(true);
  const [escrow, setEscrow] = useState<EscrowThemeConfig>(DEFAULT_ESCROW_THEME);
  const [shoppingCartPlacement, setShoppingCartPlacement] = useState<ShoppingCartPlacement>("alt");
  const [alisverisEnabled, setAlisverisEnabled] = useState(true);
  const [premiumEnabled, setPremiumEnabled] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    function applyFromPayload(d: {
      theme?: string;
      categoriesTheme?: string;
      menuTheme?: string;
      marketplaceMode?: string;
      offersEnabled?: boolean;
      homeGridCols?: string;
      brandName?: string;
      brandPrimary?: string;
      brandNavy?: string;
      headerBelt?: string;
      featuredCardTitlePriceOnly?: boolean;
      featuredCardHoverLift?: boolean;
      listingCardFavoritesEnabled?: boolean;
      classifiedDetailCountdownEnabled?: boolean;
      escrow?: Partial<EscrowThemeConfig>;
      shoppingCartPlacement?: string;
      alisverisEnabled?: boolean;
      premiumEnabled?: boolean;
    }) {
      const t: UiTheme = d.theme === "v2" ? "v2" : "v1";
      const ct: CategoriesTheme = d.categoriesTheme === "v2" ? "v2" : "tree";
      const mt: MenuTheme = d.menuTheme === "strip" ? "strip" : "mega";
      const mode: MarketplaceMode = d.marketplaceMode === "classified" ? "classified" : "bidding";
      const offers = d.offersEnabled !== false && mode === "bidding";
      const cols: V2GridCols =
        d.homeGridCols === "5" || d.homeGridCols === "6" || d.homeGridCols === "4"
          ? d.homeGridCols
          : "4";
      const belt: HeaderBelt = d.headerBelt === "white" ? "white" : "navy";
      const featuredMinimal = Boolean(d.featuredCardTitlePriceOnly);
      const featuredHover = d.featuredCardHoverLift !== false;
      const cardFavorites = d.listingCardFavoritesEnabled !== false;
      const detailCountdown =
        mode === "classified" ? d.classifiedDetailCountdownEnabled !== false : true;
      const cartPlacement: ShoppingCartPlacement = d.shoppingCartPlacement === "ust" ? "ust" : "alt";
      setAlisverisEnabled(d.alisverisEnabled !== false);
      setPremiumEnabled(d.premiumEnabled !== false);
      setTheme(t);
      setCategoriesTheme(ct);
      setMenuTheme(mt);
      setMarketplaceMode(mode);
      setOffersEnabled(offers);
      setHomeGridCols(cols);
      setHeaderBelt(belt);
      setBrandName(String(d.brandName || "TeklifBu"));
      setFeaturedCardTitlePriceOnly(featuredMinimal);
      setFeaturedCardHoverLift(featuredHover);
      setListingCardFavoritesEnabled(cardFavorites);
      setClassifiedDetailCountdownEnabled(detailCountdown);
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
      document.documentElement.setAttribute("data-categories-theme", ct);
      document.documentElement.setAttribute("data-menu-theme", mt);
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
        localStorage.setItem(MENU_STORAGE_KEY, mt);
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
    /* Kuşak: SSR initial’ı koru. localStorage navy→API white flaşını önler. */
    if (cachedCols && (cached === "v2" || initialTheme === "v2")) {
      applyV2Layout(cachedCols);
      setHomeGridCols(cachedCols);
    }
    const cachedCats = readCachedCategoriesTheme();
    setCategoriesTheme(cachedCats);
    setMenuTheme(readCachedMenuTheme());
    document.documentElement.setAttribute("data-categories-theme", cachedCats);
    document.documentElement.setAttribute("data-menu-theme", readCachedMenuTheme());
    const cachedMode = readCachedMarketplaceMode();
    setMarketplaceMode(cachedMode);
    setOffersEnabled(cachedMode === "bidding");
    document.documentElement.setAttribute("data-marketplace", cachedMode);
    document.documentElement.setAttribute("data-offers", cachedMode === "bidding" ? "1" : "0");
    /* SSR’dan gelen tema/kuşak attribute’larını hydrate anında bozma */
    if (initialTheme === "v2") {
      document.documentElement.setAttribute("data-theme", "v2");
      applyHeaderBelt(initialHeaderBelt);
    }

    function loadTheme() {
      return fetch("/api/theme", { cache: "no-store" })
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
    function onThemeChanged() {
      void loadTheme();
    }
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener(THEME_CHANGED_EVENT, onThemeChanged);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener(THEME_CHANGED_EVENT, onThemeChanged);
    };
  }, []);

  return (
    <Ctx.Provider
      value={{
        theme,
        categoriesTheme,
        menuTheme,
        marketplaceMode,
        offersEnabled,
        homeGridCols,
        headerBelt,
        brandName,
        featuredCardTitlePriceOnly,
        featuredCardHoverLift,
        listingCardFavoritesEnabled,
        classifiedDetailCountdownEnabled,
        escrow,
        shoppingCartPlacement,
        alisverisEnabled,
        premiumEnabled,
        ready,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}
