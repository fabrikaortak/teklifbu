"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Home, TrendingUp, Briefcase, Tag, ArrowUpRight, ArrowDownRight, ChevronRight } from "lucide-react";
import { ListingCard, type ListingCardData } from "@/components/ListingCard";
import { ListingThumbImg } from "@/components/ListingThumbImg";
import { formatCompact, formatTl } from "@/lib/format";
import {
  V2_NAV_CATS,
  V2_CLASSIC_STRIP,
  V2_CLASSIC_SIDE,
  resolveCatSlug,
} from "@/components/home/v2StripCats";
import { V2CategoryStrip } from "@/components/home/V2CategoryStrip";
import { CITY_NAMES, getDistricts } from "@/data/turkey-locations";
import { ListingViewToggle, useListingView } from "@/components/ListingViewToggle";
import { CategoryBrowseNav } from "@/components/CategoryBrowseNav";
import { PremiumBrowseSection } from "@/components/PremiumBrowseSection";
import { AlisverisBrowseSection } from "@/components/AlisverisBrowseSection";
import {
  EMPTY_SEARCH_FILTERS,
  type SearchFilters,
  buildSearchHref,
} from "@/components/SearchPanel";
import type { FacetCounts } from "@/lib/facetHelpers";
import { displayNameFor, resolveBrowseNodeKey, premiumNodeKey } from "@/lib/browseNavConfig";
import { findBrowseNode, matchBrowsePath } from "@/data/categoryBrowseTree";
import { findClassicBrowseNode, isAlisverisCategorySlug } from "@/data/classicBrowseTree";
import { PREMIUM_CATEGORY_SEEDS, childPremiumSlug, isPremiumCategorySlug } from "@/data/premiumCategories";
import { useTheme } from "@/components/ThemeProvider";
import { MODE_HREF } from "@/lib/listingBrowseMode";
import type { MarketplaceHomeStats } from "@/core/services/marketplaceStatsService";
import { HomeVisibilitySlider } from "@/components/home/HomeVisibilitySlider";
import { RecentSalesStrip } from "@/components/RecentSalesStrip";
import { HomeInsightPanels } from "@/components/HomeInsightPanels";
import { HomePromoSlider } from "@/components/home/HomePromoSlider";
import { SiteMidBeltBanner } from "@/components/SiteBeltBanner";
import type { HomeVisibilitySlide } from "@/lib/homeBanners";
import { brandLabel, modelLabel } from "@/lib/vasitaLabels";

function formatChangePct(n: number) {
  const abs = Math.abs(n);
  const text = `%${abs.toLocaleString("tr-TR", { maximumFractionDigits: 1 })}`;
  return { text, up: n >= 0 };
}

function timeAgo(iso: string) {
  const sec = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (sec < 60) return `${sec} saniye önce`;
  const m = Math.floor(sec / 60);
  if (m < 60) return `${m} dk önce`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} sa önce`;
  return `${Math.floor(h / 24)}g önce`;
}

function formatPackagePrice(tl: number) {
  return `₺${Number(tl || 0).toLocaleString("tr-TR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

type TokenPkg = {
  id: string;
  name: string;
  tokenAmount: number;
  priceTl: number;
  discountPercent?: number;
};

function listingQuery(filters: SearchFilters) {
  const params = new URLSearchParams();
  if (filters.category) params.set("category", filters.category);
  if (filters.dealType) params.set("type", filters.dealType);
  if (filters.subtype) params.set("subtype", filters.subtype);
  if (filters.rental) params.set("rental", filters.rental);
  if (filters.brand) params.set("brand", filters.brand);
  if (filters.model) params.set("model", filters.model);
  if (filters.version) params.set("version", filters.version);
  if (filters.trim) params.set("trim", filters.trim);
  if (filters.city) params.set("city", filters.city);
  if (filters.district) params.set("district", filters.district);
  if (filters.minPrice) params.set("minPrice", filters.minPrice);
  if (filters.maxPrice) params.set("maxPrice", filters.maxPrice);
  return params.toString();
}

export function HomeV2() {
  const router = useRouter();
  const { categoriesTheme, offersEnabled } = useTheme();
  const classicCats = categoriesTheme === "v2";
  const [data, setData] = useState<{
    listings: ListingCardData[];
    stats: MarketplaceHomeStats;
    categories: Array<{
      slug: string;
      name: string;
      icon?: string | null;
      _count: { listings: number };
      children?: Array<{ slug: string; name: string; _count?: { listings: number } }>;
    }>;
    facets?: FacetCounts | null;
  } | null>(null);
  const [facets, setFacets] = useState<FacetCounts | null>(null);
  const [live, setLive] = useState<
    Array<{
      id: string;
      amount: number;
      previousAmount?: number | null;
      createdAt: string;
      listing: {
        id: string;
        title: string;
        city: string;
        district?: string | null;
        coverImage?: string | null;
        askPrice?: number;
        highestBid?: number;
      };
    }>
  >([]);
  const [tokenPackages, setTokenPackages] = useState<TokenPkg[]>([]);
  const [tokenPackagesStatus, setTokenPackagesStatus] = useState<"loading" | "ready" | "error">("loading");
  const [visSlides, setVisSlides] = useState<HomeVisibilitySlide[]>([]);
  const [promoSlides, setPromoSlides] = useState<HomePromoSlide[]>([]);
  const [adSettings, setAdSettings] = useState({
    promo: { heightPx: 168, slideSeconds: 5 },
    sidebar: { heightPx: 148, slideSeconds: 5 },
  });
  const [browse, setBrowse] = useState<SearchFilters>({ ...EMPTY_SEARCH_FILTERS });
  const [condition, setCondition] = useState("all");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [city, setCity] = useState("");
  const [district, setDistrict] = useState("");
  const { view, changeView } = useListingView("teklifbu:v2-home-view", "grid");
  const [sort, setSort] = useState("market-desc");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<{
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  } | null>(null);
  const loadListings = useCallback((filters: SearchFilters, pageNum = 1) => {
    const qs = listingQuery(filters);
    const pageQ = `page=${Math.max(1, pageNum)}`;
    /** Ana vitrin: Emlak + Vasıta (Alışveriş /alisveris’te) */
    const url = qs ? `/api/listings?home=1&${pageQ}&${qs}` : `/api/listings?home=1&${pageQ}`;
    fetch(url)
      .then((r) => r.json())
      .then((d) => {
        setPage(d.pagination?.page ?? pageNum);
        setData(d);
        setPagination(d.pagination || null);
        if (d.facets) setFacets(d.facets);
      });
  }, []);

  function goToPage(nextPage: number) {
    const totalPages = pagination?.totalPages || 1;
    const p = Math.min(totalPages, Math.max(1, nextPage));
    if (p === page && data?.listings?.length) return;
    loadListings(
      {
        ...browse,
        city,
        district,
        minPrice,
        maxPrice,
      },
      p
    );
    const el = document.querySelector(".v2-toolbar") || document.querySelector(".listings-grid-4");
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  useEffect(() => {
    function loadAdAssets() {
      fetch("/api/home-banners")
        .then((r) => r.json())
        .then((d) => setVisSlides(d.slides || []))
        .catch(() => {});
      fetch("/api/home-promos")
        .then((r) => r.json())
        .then((d) => setPromoSlides(d.slides || []))
        .catch(() => {});
      fetch("/api/home-ad-settings")
        .then((r) => r.json())
        .then((d) => {
          if (d?.promo && d?.sidebar) {
            setAdSettings({
              promo: {
                heightPx: Number(d.promo.heightPx) || 168,
                slideSeconds: Number(d.promo.slideSeconds) || 5,
              },
              sidebar: {
                heightPx: Number(d.sidebar.heightPx) || 148,
                slideSeconds: Number(d.sidebar.slideSeconds) || 5,
              },
            });
          }
        })
        .catch(() => {});
    }

    loadListings(EMPTY_SEARCH_FILTERS, 1);
    const sideUrl = offersEnabled ? "/api/listings?live=1" : "/api/listings?limit=8";
    fetch(sideUrl)
      .then((r) => r.json())
      .then((d) => {
        if (offersEnabled) {
          setLive(d.items || []);
        } else {
          const items = (d.listings || []).map((l: ListingCardData) => ({
            id: l.id,
            amount: Number(l.askPrice) || 0,
            previousAmount: null,
            createdAt: l.createdAt || new Date().toISOString(),
            listing: {
              id: l.id,
              title: l.title,
              city: l.city,
              district: l.district,
              coverImage: l.coverImage,
              askPrice: l.askPrice,
            },
          }));
          setLive(items);
        }
      });
    fetch("/api/token-packages")
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error || "Paketler alınamadı");
        const list = Array.isArray(d.packages) ? d.packages : [];
        setTokenPackages(list);
        setTokenPackagesStatus("ready");
      })
      .catch(() => {
        setTokenPackages([]);
        setTokenPackagesStatus("error");
      });
    loadAdAssets();

    function onVisible() {
      if (document.visibilityState === "visible") loadAdAssets();
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [loadListings, offersEnabled]);

  const listings = useMemo(() => {
    const items = [...(data?.listings || [])];
    const byNum = (a: number, b: number) => a - b;
    switch (sort) {
      case "market-desc":
        return items.sort((a, b) => byNum(b.highestBid || 0, a.highestBid || 0));
      case "market-asc":
        return items.sort((a, b) => byNum(a.highestBid || 0, b.highestBid || 0));
      case "ask-desc":
        return items.sort((a, b) => byNum(b.askPrice || 0, a.askPrice || 0));
      case "ask-asc":
        return items.sort((a, b) => byNum(a.askPrice || 0, b.askPrice || 0));
      case "ending":
        return items.sort((a, b) => {
          const ae = a.endsAt ? new Date(a.endsAt).getTime() : Number.POSITIVE_INFINITY;
          const be = b.endsAt ? new Date(b.endsAt).getTime() : Number.POSITIVE_INFINITY;
          return ae - be;
        });
      case "new":
      default:
        return items.sort((a, b) => {
          const ac = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const bc = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return bc - ac;
        });
    }
  }, [data?.listings, sort]);

  const showingFeatured = !browse.category && !browse.dealType && !browse.subtype && !browse.rental && !browse.brand && !browse.model && !browse.version && !browse.trim && !browse.city && !browse.district && !browse.minPrice && !browse.maxPrice && !city && !district && !minPrice && !maxPrice;
  const districts = city ? getDistricts(city) : [];

  const activeCatName = useMemo(() => {
    const cfg = facets?.browseNavConfig;
    if (browse.brand && browse.subtype) {
      const brand = brandLabel(browse.brand);
      if (browse.model) return `${brand} › ${modelLabel(browse.model)}`;
      return brand;
    }
    if (browse.subtype && browse.category === "arac") {
      const n = findBrowseNode(`arac/${browse.subtype}`);
      if (n) return displayNameFor(cfg, resolveBrowseNodeKey(n.id, n.filter || {}), n.name);
      return browse.subtype;
    }
    if (!browse.category) return null;
    for (const root of PREMIUM_CATEGORY_SEEDS) {
      if (browse.category === root.slug) {
        return displayNameFor(cfg, premiumNodeKey(root.vertical), root.name);
      }
      for (const sub of root.children) {
        if (browse.category === childPremiumSlug(root.slug, sub.slug)) {
          const rootLabel = displayNameFor(cfg, premiumNodeKey(root.vertical), root.name);
          const subLabel = displayNameFor(cfg, premiumNodeKey(root.vertical, sub.slug), sub.name);
          return `${rootLabel} › ${subLabel}`;
        }
      }
    }
    const classic =
      V2_CLASSIC_SIDE.find((c) => {
        const mapped = resolveCatSlug(c);
        if (mapped === browse.category || c.slug === browse.category) return true;
        return mapped.split(",").map((s) => s.trim()).includes(browse.category);
      }) ||
      V2_CLASSIC_STRIP.find((c) => {
        const mapped = resolveCatSlug(c);
        if (mapped === browse.category || c.slug === browse.category) return true;
        return mapped.split(",").map((s) => s.trim()).includes(browse.category);
      });
    if (classic) return classic.name;
    const classicNode = findClassicBrowseNode(browse.category);
    if (classicNode) return classicNode.name;
    const path = matchBrowsePath({
      category: browse.category,
      dealType: browse.dealType,
      subtype: browse.subtype,
      rental: browse.rental,
    });
    if (path.length) {
      const labels = path
        .map((id) => {
          const n = findBrowseNode(id);
          if (!n) return null;
          const key = resolveBrowseNodeKey(id, n.filter || {});
          return displayNameFor(cfg, key, n.name);
        })
        .filter(Boolean) as string[];
      if (labels.length) return labels.join(" › ");
    }
    return V2_NAV_CATS.find((c) => c.slug === browse.category)?.name || browse.category;
  }, [browse, facets?.browseNavConfig]);

  const premiumMode = isPremiumCategorySlug(browse.category);

  const totalCount = pagination?.total ?? listings.length;
  const totalPages = pagination?.totalPages || 1;
  const pagerPages = useMemo(() => {
    const maxButtons = 7;
    if (totalPages <= maxButtons) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const pages = new Set<number>([1, totalPages, page]);
    for (let d = 1; pages.size < maxButtons - 1 && d < totalPages; d++) {
      if (page - d >= 1) pages.add(page - d);
      if (page + d <= totalPages) pages.add(page + d);
    }
    return Array.from(pages).sort((a, b) => a - b);
  }, [page, totalPages]);

  function onBrowseSelect(patch: {
    category: string;
    dealType: "" | "SATILIK" | "KIRALIK" | "DEVREN_SATILIK" | "DEVREN_KIRALIK";
    subtype: string;
    rental: string;
    brand: string;
    model: string;
    version: string;
    trim: string;
  }) {
    if (isPremiumCategorySlug(patch.category)) {
      const qs = patch.category ? `?category=${encodeURIComponent(patch.category)}` : "";
      router.push(`/premium${qs}`);
      return;
    }
    if (isAlisverisCategorySlug(patch.category) || patch.category === "alisveris") {
      const qs =
        patch.category && patch.category !== "alisveris"
          ? `?category=${encodeURIComponent(patch.category)}`
          : "";
      router.push(`/alisveris${qs}`);
      return;
    }
    const next: SearchFilters = {
      ...browse,
      category: patch.category,
      dealType: patch.dealType,
      subtype: patch.subtype,
      rental: patch.rental,
      brand: patch.brand,
      model: patch.model,
      version: patch.version,
      trim: patch.trim,
      city,
      district,
      minPrice,
      maxPrice,
    };
    /**
     * Marka / seri / motor → /ilanlar (filtre + liste/kart).
     * Sol menü yeni sayfada da aynı yatay hizada kalır (v2-home grid).
     * Yalnızca alt tip → ana sayfada kal.
     */
    if (patch.category === "arac" && (patch.brand || patch.model || patch.version || patch.trim)) {
      router.push(buildSearchHref(next));
      return;
    }
    setBrowse(next);
    loadListings(next, 1);
  }

  function applySearch(e?: FormEvent) {
    e?.preventDefault();
    const next: SearchFilters = {
      ...browse,
      city,
      district,
      minPrice,
      maxPrice,
    };
    if (condition === "ikinci-el") {
      next.category = "ikinci-el";
      next.dealType = "";
      next.subtype = "";
      next.brand = "";
      next.model = "";
      next.version = "";
      next.trim = "";
    }
    if (condition === "sifir") {
      next.category = "sifir-urun";
      next.dealType = "";
      next.subtype = "";
      next.brand = "";
      next.model = "";
      next.version = "";
      next.trim = "";
    }
    router.push(buildSearchHref(next));
  }

  const rangePct = (() => {
    const min = Number(minPrice) || 0;
    const max = Number(maxPrice) || 0;
    if (!max && !min) return 50;
    if (max <= min) return 100;
    return Math.min(100, Math.round((min / max) * 100));
  })();

  return (
    <>
      <V2CategoryStrip filters={browse} onSelect={onBrowseSelect} />

      <SiteMidBeltBanner />

      <div className="v2-home">
        <aside className="v2-left v2-side-card">
          <CategoryBrowseNav
            embedded
            variant={classicCats ? "classic" : "default"}
            filters={browse}
            facets={facets}
            onSelect={onBrowseSelect}
          />

          <PremiumBrowseSection filters={browse} onSelect={onBrowseSelect} facets={facets} />
          <AlisverisBrowseSection filters={browse} onSelect={onBrowseSelect} />

          <div className="v2-filter-block">
            <div className="v2-filter-label">Durumu</div>
            {[
              ["all", "Tümü"],
              ["ikinci-el", "İkinci El"],
              ["sifir", "Sıfır"],
            ].map(([v, label]) => (
              <label key={v} className="v2-radio">
                <input
                  type="radio"
                  name="cond"
                  checked={condition === v}
                  onChange={() => setCondition(v)}
                />
                {label}
              </label>
            ))}
          </div>

          <div className="v2-filter-block">
            <div className="v2-filter-label">Fiyat Aralığı</div>
            <div className="v2-price-row">
              <input
                inputMode="numeric"
                placeholder="Min TL"
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value.replace(/\D/g, ""))}
              />
              <input
                inputMode="numeric"
                placeholder="Max TL"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value.replace(/\D/g, ""))}
              />
            </div>
            <div className="v2-range-track">
              <input
                className="v2-range"
                type="range"
                min={0}
                max={100}
                value={rangePct}
                onChange={(e) => {
                  const pct = Number(e.target.value);
                  const base = Number(maxPrice) || 100000;
                  setMinPrice(String(Math.round((pct / 100) * base)));
                }}
                aria-label="Fiyat aralığı"
              />
            </div>
          </div>

          <div className="v2-filter-block">
            <div className="v2-filter-label">Konum</div>
            <select
              value={city}
              onChange={(e) => {
                setCity(e.target.value);
                setDistrict("");
              }}
            >
              <option value="">İl Seçin</option>
              {CITY_NAMES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <select value={district} onChange={(e) => setDistrict(e.target.value)} disabled={!city}>
              <option value="">İlçe Seçin</option>
              {districts.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          <button type="button" className="v2-ara-btn" onClick={() => applySearch()}>
            Ara
          </button>
        </aside>

        <section className="v2-center">
          {offersEnabled ? (
          <div className="v2-stats-row">
            <div className="v2-stats-bar">
              {(() => {
                const s = data?.stats;
                const cards = [
                  {
                    key: "bidsToday",
                    icon: <Home size={16} strokeWidth={2.25} />,
                    label: "Bugün Verilen Teklif",
                    value: formatCompact(s?.bidsToday ?? 0),
                    change: formatChangePct(s?.bidsTodayChangePct ?? 0),
                    tone: "orange",
                  },
                  {
                    key: "acceptedToday",
                    icon: <TrendingUp size={16} strokeWidth={2.25} />,
                    label: "Bugün Kabul Edilen Teklif",
                    value: formatCompact(s?.acceptedToday ?? 0),
                    change: formatChangePct(s?.acceptedTodayChangePct ?? 0),
                    tone: "green",
                  },
                  {
                    key: "volume",
                    icon: <Briefcase size={16} strokeWidth={2.25} />,
                    label: "Toplam Teklif Hacmi",
                    value: formatTl(s?.totalBidVolumeTl ?? 0),
                    change: formatChangePct(s?.totalBidVolumeChangePct ?? 0),
                    tone: "blue",
                  },
                  {
                    key: "sold24h",
                    icon: <Tag size={16} strokeWidth={2.25} />,
                    label: "Son 24 Saatte Satılan İlan",
                    value: formatCompact(s?.soldLast24h ?? 0),
                    change: formatChangePct(s?.soldLast24hChangePct ?? 0),
                    tone: "rose",
                  },
                ] as const;
                return cards.map((c) => (
                  <div key={c.key} className={`v2-stat tone-${c.tone}`}>
                    <div className="v2-stat-ico">{c.icon}</div>
                    <div className="v2-stat-body">
                      <span className="v2-stat-label">{c.label}</span>
                      <strong className="v2-stat-value">{c.value}</strong>
                      <span className={`v2-stat-change ${c.change.up ? "is-up" : "is-down"}`}>
                        {c.change.up ? (
                          <ArrowUpRight size={12} strokeWidth={2.5} />
                        ) : (
                          <ArrowDownRight size={12} strokeWidth={2.5} />
                        )}
                        {c.change.text}
                      </span>
                    </div>
                  </div>
                ));
              })()}
            </div>
            <HomePromoSlider
              slides={promoSlides}
              heightPx={adSettings.promo.heightPx}
              slideSeconds={adSettings.promo.slideSeconds}
            />
          </div>
          ) : (
          <div className="v2-stats-row">
            <HomePromoSlider
              slides={promoSlides}
              heightPx={adSettings.promo.heightPx}
              slideSeconds={adSettings.promo.slideSeconds}
            />
          </div>
          )}

          <div className="v2-toolbar">
            <h1 className={showingFeatured ? "v2-featured-title" : undefined}>
              {showingFeatured ? (
                <>Öne Çıkan İlanlar</>
              ) : premiumMode && activeCatName ? (
                <>
                  Premium · &quot;{activeCatName}&quot; — <em>{formatCompact(totalCount)}</em> ilan
                </>
              ) : activeCatName ? (
                <>
                  &quot;{activeCatName}&quot; kategorisinde <em>{formatCompact(totalCount)}</em> ilan
                  bulundu.
                </>
              ) : (
                <>
                  Tüm kategorilerde{" "}
                  <em>{formatCompact(data?.stats.activeListings ?? totalCount)}</em> ilan bulundu.
                </>
              )}
            </h1>
            <div className="v2-toolbar-meta">
              <label className="v2-sort-wrap">
                <span>Sıralama:</span>
                <select
                  className="v2-sort"
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                  aria-label="Sıralama"
                >
                  <option value="market-desc">Piyasa Fiyatı (Yüksekten Düşüğe)</option>
                  <option value="market-asc">Piyasa Fiyatı (Düşükten Yükseğe)</option>
                  <option value="ask-desc">İlan Fiyatı (Yüksekten Düşüğe)</option>
                  <option value="ask-asc">İlan Fiyatı (Düşükten Yükseğe)</option>
                  <option value="new">En Yeni</option>
                  <option value="ending">Süresi Yakınlaşan</option>
                </select>
              </label>
              <ListingViewToggle view={view} onChange={changeView} compact />
            </div>
          </div>

          <div
            className={`${view === "grid" ? "listings-grid-4" : "listings-stack"}${showingFeatured ? " featured-vitrin" : ""}`}
            style={view === "list" ? { display: "grid", gap: 10 } : undefined}
          >
            {listings.map((l) => (
              <ListingCard
                key={l.id}
                listing={l}
                variant={view === "list" ? "row" : "grid"}
                homeMode
                featuredSection={showingFeatured}
              />
            ))}
          </div>
          {!listings.length && (
            <div className="v2-side-card" style={{ marginTop: 8, textAlign: "center", color: "var(--muted)" }}>
              İlan bulunamadı.
            </div>
          )}
          {totalPages > 1 && (
            <nav className="v2-pager" aria-label="Sayfalama">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => goToPage(page - 1)}
              >
                Önceki
              </button>
              {pagerPages.map((n, i) => {
                const prev = pagerPages[i - 1];
                const showGap = prev != null && n - prev > 1;
                return (
                  <span key={n} style={{ display: "contents" }}>
                    {showGap && <span aria-hidden>…</span>}
                    <button
                      type="button"
                      className={n === page ? "active" : undefined}
                      aria-current={n === page ? "page" : undefined}
                      onClick={() => goToPage(n)}
                    >
                      {n}
                    </button>
                  </span>
                );
              })}
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => goToPage(page + 1)}
              >
                Sonraki
              </button>
            </nav>
          )}
        </section>

        <aside className="v2-right">
          <div className="v2-side-card">
            <div className="v2-side-head">
              <h2 className="v2-side-title">
                {offersEnabled ? "Canlı Teklif Akışı" : "Son Eklenen İlanlar"}
              </h2>
              <Link href={offersEnabled ? MODE_HREF.live : "/ilanlar"} className="v2-side-more">
                Tümünü Gör <ChevronRight size={14} strokeWidth={2.5} />
              </Link>
            </div>
            {live.length === 0 && (
              <div style={{ fontSize: 13, color: "var(--muted)" }}>
                {offersEnabled ? "Henüz canlı teklif yok." : "Henüz ilan yok."}
              </div>
            )}
            {live.slice(0, 5).map((item) => {
              const prev = item.previousAmount != null ? Number(item.previousAmount) : null;
              return (
                <Link key={item.id} href={`/ilan/${item.listing.id}`} className="v2-live-item">
                  <ListingThumbImg src={item.listing.coverImage} />
                  <div className="v2-live-body">
                    <div className="v2-live-top">
                      <div className="v2-live-text">
                        <div className="t">{item.listing.title}</div>
                        <div className="loc">
                          {[item.listing.district, item.listing.city].filter(Boolean).join(", ")}
                        </div>
                        <div className="ask">
                          İlan fiyatı: <strong>{formatTl(Number(item.listing.askPrice || 0))}</strong>
                        </div>
                      </div>
                      <ChevronRight size={16} className="v2-live-chevron" strokeWidth={2} />
                    </div>
                    {offersEnabled ? (
                    <div className="v2-live-bottom">
                      <div className="v2-live-bids">
                        <span className="p is-up">
                          {formatTl(item.amount)}
                          <TrendingUp size={13} strokeWidth={2.5} aria-hidden />
                        </span>
                        {prev != null && prev > 0 ? (
                          <span className="prev">{formatTl(prev)}</span>
                        ) : null}
                      </div>
                      <span className="ago">{timeAgo(item.createdAt)}</span>
                    </div>
                    ) : (
                    <div className="v2-live-bottom">
                      <span className="ago">{timeAgo(item.createdAt)}</span>
                    </div>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>

          <div className="v2-side-card v2-packages-card">
            <div className="v2-side-head">
              <h2 className="v2-side-title">Jeton Paketleri</h2>
              <Link href="/jeton" className="v2-side-more">
                Tümünü Gör <ChevronRight size={14} strokeWidth={2.5} />
              </Link>
            </div>
            <div className="v2-pkg-grid">
              {tokenPackages.slice(0, 3).map((pkg) => (
                <Link key={pkg.id} href="/jeton" className="v2-pkg">
                  {Number(pkg.discountPercent) > 0 && (
                    <span className="v2-pkg-badge">%{pkg.discountPercent} avantaj</span>
                  )}
                  <strong>{pkg.tokenAmount}</strong>
                  <span className="v2-pkg-label">Jeton</span>
                  <span className="v2-pkg-price">{formatPackagePrice(pkg.priceTl)}</span>
                </Link>
              ))}
              {tokenPackagesStatus === "loading" && !tokenPackages.length && (
                <div style={{ gridColumn: "1 / -1", fontSize: 12, color: "var(--muted)" }}>
                  Paketler yükleniyor…
                </div>
              )}
              {tokenPackagesStatus === "error" && !tokenPackages.length && (
                <div style={{ gridColumn: "1 / -1", fontSize: 12, color: "var(--muted)" }}>
                  Paketler yüklenemedi.{" "}
                  <Link href="/jeton" style={{ color: "var(--orange)", fontWeight: 700 }}>
                    Jeton sayfasına git
                  </Link>
                </div>
              )}
              {tokenPackagesStatus === "ready" && !tokenPackages.length && (
                <div style={{ gridColumn: "1 / -1", fontSize: 12, color: "var(--muted)" }}>
                  Henüz aktif jeton paketi yok.
                </div>
              )}
            </div>
          </div>

          <HomeVisibilitySlider
            slides={visSlides}
            heightPx={adSettings.sidebar.heightPx}
            slideSeconds={adSettings.sidebar.slideSeconds}
          />
        </aside>
      </div>

      {offersEnabled ? <RecentSalesStrip placement="home" /> : null}
      <HomeInsightPanels />

      <Link href="/ilan-ver" className="v2-fab" aria-label="İlan Ver">
        <Plus size={22} strokeWidth={2.75} />
        <span>İlan Ver</span>
      </Link>
    </>
  );
}
