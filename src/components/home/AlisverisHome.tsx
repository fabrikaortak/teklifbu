"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, ArrowUpRight, ShieldCheck, Store, RefreshCw, History, Eye } from "lucide-react";
import { formatCompact, formatTl } from "@/lib/format";
import { V2CategoryStrip } from "@/components/home/V2CategoryStrip";
import { CITY_NAMES, getDistricts } from "@/data/turkey-locations";
import { ListingViewToggle, useListingView } from "@/components/ListingViewToggle";
import { CategoryBrowseNav } from "@/components/CategoryBrowseNav";
import {
  allAlisverisCategoryParam,
  isAlisverisCategorySlug,
} from "@/data/classicBrowseTree";
import {
  EMPTY_SEARCH_FILTERS,
  type SearchFilters,
  buildSearchHref,
} from "@/components/SearchPanel";
import type { FacetCounts } from "@/lib/facetHelpers";
import { isPremiumCategorySlug } from "@/data/premiumCategories";
import { useTheme } from "@/components/ThemeProvider";
import type { MarketplaceHomeStats } from "@/core/services/marketplaceStatsService";
import { useRegisterShoppingSurface } from "@/components/cart/CartProvider";
import { useAlisverisBrowseTree } from "@/hooks/useAlisverisBrowseTree";
import type { BrowseNode } from "@/data/categoryBrowseTree";
import type { ListingCardData } from "@/components/ListingCard";
import {
  AlisverisCategoryMosaic,
  AlisverisFeaturedOfferCard,
  AlisverisLiveOffersPanel,
  AlisverisOfferProductCard,
} from "@/components/home/alisveris/AlisverisOfferCards";

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
  if (filters.city) params.set("city", filters.city);
  if (filters.district) params.set("district", filters.district);
  if (filters.minPrice) params.set("minPrice", filters.minPrice);
  if (filters.maxPrice) params.set("maxPrice", filters.maxPrice);
  return params.toString();
}

/** Durumu seçimine göre alışveriş kategori parametresini daralt */
function scopeAlisverisCategory(category: string, condition: string, allParam: string): string {
  const base =
    !category || category === "alisveris"
      ? allParam
      : isAlisverisCategorySlug(category)
        ? category
        : allParam;

  if (condition === "all") return base;

  const prefix = condition === "sifir" ? "sifir-urun" : "ikinci-el";
  const parts = base
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .filter(
      (p) =>
        p === prefix ||
        p.startsWith(`${prefix}-`) ||
        p.startsWith(`${prefix}__`) ||
        (prefix === "ikinci-el" && p === "diger")
    );

  if (parts.length) return parts.join(",");
  return prefix;
}

function allParamFromTree(tree: BrowseNode[]): string {
  const parts = tree.map((n) => n.filter.category || "").filter(Boolean);
  return parts.length ? parts.join(",") : allAlisverisCategoryParam();
}

function findCatLabel(tree: BrowseNode[], category: string): string | null {
  if (!category) return null;

  function walk(nodes: BrowseNode[], trail: string[]): string | null {
    for (const n of nodes) {
      const next = [...trail, n.name];
      if (category === n.filter.category || category === n.id) return next.join(" › ");
      if (n.children?.length) {
        const hit = walk(n.children, next);
        if (hit) return hit;
      }
    }
    return null;
  }

  const exact = walk(tree, []);
  if (exact) return exact;

  // Eski/şişkin URL: virgüllü slug listesi → en uzun (en derin) slug ile isim bul
  const parts = category
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length <= 1) return null;

  function findSlug(nodes: BrowseNode[], trail: string[], slug: string): string | null {
    for (const n of nodes) {
      const next = [...trail, n.name];
      if (n.id === slug || n.filter.category === slug) return next.join(" › ");
      if (n.children?.length) {
        const hit = findSlug(n.children, next, slug);
        if (hit) return hit;
      }
    }
    return null;
  }

  const sorted = [...parts].sort((a, b) => b.length - a.length);
  for (const slug of sorted) {
    const hit = findSlug(tree, [], slug);
    if (hit) return hit;
  }
  return null;
}

/** Ham slug yığınını asla başlıkta gösterme */
function safeCatDisplayName(tree: BrowseNode[], category: string, treeLoading: boolean): string | null {
  if (!category) return null;
  const label = findCatLabel(tree, category);
  if (label) return label;
  if (treeLoading) return null;
  if (category.includes(",") || category.length > 72 || category.includes("__")) {
    return null;
  }
  return category;
}

export function AlisverisHome() {
  useRegisterShoppingSurface(true);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { offersEnabled } = useTheme();
  const { tree: alisverisTree, loading: alisverisTreeLoading } = useAlisverisBrowseTree();
  const [verticalOpen, setVerticalOpen] = useState(true);
  const [verticalReady, setVerticalReady] = useState(false);

  useEffect(() => {
    fetch("/api/theme")
      .then((r) => r.json())
      .then((d) => {
        setVerticalOpen(d?.alisverisEnabled !== false);
        setVerticalReady(true);
      })
      .catch(() => {
        setVerticalOpen(true);
        setVerticalReady(true);
      });
  }, []);

  const allShopParam = useMemo(
    () => (alisverisTreeLoading ? "ikinci-el,sifir-urun" : allParamFromTree(alisverisTree)),
    [alisverisTree, alisverisTreeLoading]
  );

  const initialCat = searchParams.get("category") || "";
  const [browse, setBrowse] = useState<SearchFilters>({
    ...EMPTY_SEARCH_FILTERS,
    category:
      initialCat === "alisveris" || !initialCat
        ? ""
        : isAlisverisCategorySlug(initialCat)
          ? initialCat
          : "",
  });
  const [condition, setCondition] = useState("all");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [city, setCity] = useState("");
  const [district, setDistrict] = useState("");
  const [data, setData] = useState<{
    listings: ListingCardData[];
    stats: MarketplaceHomeStats;
    facets?: FacetCounts | null;
  } | null>(null);
  const [listingsLoading, setListingsLoading] = useState(true);
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
  const { view, changeView } = useListingView("teklifbu:alisveris-home-view", "grid");
  const [sort, setSort] = useState("market-desc");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<{
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  } | null>(null);

  const districts = city ? getDistricts(city) : [];

  const activeCatName = useMemo(
    () => safeCatDisplayName(alisverisTree, browse.category, alisverisTreeLoading),
    [browse.category, alisverisTree, alisverisTreeLoading]
  );

  const loadListings = useCallback(
    (filters: SearchFilters, pageNum = 1, cond = condition) => {
      const categoryParam = scopeAlisverisCategory(filters.category || "", cond, allShopParam);
      const qs = listingQuery({ ...filters, category: categoryParam });
      const pageQ = `page=${Math.max(1, pageNum)}`;
      const url = qs ? `/api/listings?home=1&${pageQ}&${qs}` : `/api/listings?home=1&${pageQ}`;
      setListingsLoading(true);
      fetch(url)
        .then((r) => r.json())
        .then((d) => {
          setPage(d.pagination?.page ?? pageNum);
          setData(d);
          setPagination(d.pagination || null);
          if (d.facets) setFacets(d.facets);
        })
        .catch(() => {
          setData((prev) => prev ?? { listings: [], stats: {} as MarketplaceHomeStats });
        })
        .finally(() => setListingsLoading(false));
    },
    [condition, allShopParam]
  );

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
  }, [offersEnabled]);

  useEffect(() => {
    const cat = searchParams.get("category") || "";
    const next = {
      ...EMPTY_SEARCH_FILTERS,
      category: !cat || cat === "alisveris" ? "" : isAlisverisCategorySlug(cat) ? cat : "",
    };
    setBrowse(next);
    loadListings(next, 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, loadListings]);

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

  const showingFeatured =
    !browse.category &&
    !city &&
    !district &&
    !minPrice &&
    !maxPrice &&
    condition === "all";

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

  function setShopCategory(category: string) {
    const qs = category ? `?category=${encodeURIComponent(category)}` : "";
    router.push(`/alisveris${qs}`);
  }

  function onShopSelect(patch: {
    category: string;
    dealType: string;
    subtype: string;
    rental: string;
    brand: string;
    model: string;
    trim: string;
  }) {
    if (!patch.category || patch.category === "alisveris") {
      setShopCategory("");
      return;
    }
    if (isPremiumCategorySlug(patch.category)) {
      router.push(`/premium?category=${encodeURIComponent(patch.category)}`);
      return;
    }
    if (!isAlisverisCategorySlug(patch.category)) {
      router.push(
        buildSearchHref({
          ...EMPTY_SEARCH_FILTERS,
          category: patch.category,
          dealType: patch.dealType as SearchFilters["dealType"],
          subtype: patch.subtype,
          rental: patch.rental,
          brand: patch.brand,
          model: patch.model,
          trim: patch.trim,
        })
      );
      return;
    }
    setShopCategory(patch.category);
  }

  function onClassicSelect(patch: {
    category: string;
    dealType: string;
    subtype: string;
    rental: string;
    brand: string;
    model: string;
    trim: string;
  }) {
    if (!patch.category) {
      router.push("/");
      return;
    }
    if (isPremiumCategorySlug(patch.category)) {
      router.push(`/premium?category=${encodeURIComponent(patch.category)}`);
      return;
    }
    if (isAlisverisCategorySlug(patch.category) || patch.category === "alisveris") {
      setShopCategory(patch.category === "alisveris" ? "" : patch.category);
      return;
    }
    router.push(
      buildSearchHref({
        ...EMPTY_SEARCH_FILTERS,
        category: patch.category,
        dealType: patch.dealType as SearchFilters["dealType"],
        subtype: patch.subtype,
        rental: patch.rental,
        brand: patch.brand,
        model: patch.model,
        trim: patch.trim,
      })
    );
  }

  function applySearch(e?: FormEvent) {
    e?.preventDefault();
    loadListings(
      {
        ...browse,
        city,
        district,
        minPrice,
        maxPrice,
      },
      1,
      condition
    );
  }

  const surfaceReady = !alisverisTreeLoading && !listingsLoading && data !== null;

  if (!surfaceReady) {
    return (
      <div
        className="alisveris-redirect-gate"
        role="status"
        aria-busy="true"
        aria-live="polite"
        style={{
          minHeight: "calc(100vh - 140px)",
          display: "grid",
          placeItems: "center",
          padding: "48px 24px",
          background: "var(--bg, #f8fafc)",
        }}
      >
        <div style={{ display: "grid", gap: 18, justifyItems: "center", textAlign: "center" }}>
          <span
            aria-hidden
            style={{
              width: 44,
              height: 44,
              borderRadius: "50%",
              border: "3px solid #e2e8f0",
              borderTopColor: "var(--orange, #ea580c)",
              animation: "alisveris-gate-spin 0.75s linear infinite",
            }}
          />
          <p
            style={{
              margin: 0,
              fontSize: 15,
              fontWeight: 800,
              letterSpacing: "0.04em",
              color: "var(--ink, #0f172a)",
              textTransform: "uppercase",
            }}
          >
            Alışverişe yönlendiriliyorsunuz
          </p>
          <style>{`@keyframes alisveris-gate-spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  const categoryMosaic = alisverisTree.map((n) => ({
    id: n.id,
    name: n.name,
    category: n.filter.category || n.id,
  }));

  const s = data?.stats;
  const featured = listings[0] || null;
  const endingSoon = [...listings]
    .filter((l) => l.endsAt)
    .sort((a, b) => new Date(a.endsAt!).getTime() - new Date(b.endsAt!).getTime())[0];

  const countdownTarget = endingSoon?.endsAt
    ? new Date(endingSoon.endsAt).getTime()
    : Date.now() + 3 * 86400000 + 20 * 3600000;
  const remainMs = Math.max(0, countdownTarget - Date.now());
  const cd = {
    d: Math.floor(remainMs / 86400000),
    h: Math.floor((remainMs % 86400000) / 3600000),
    m: Math.floor((remainMs % 3600000) / 60000),
    s: Math.floor((remainMs % 60000) / 1000),
  };

  if (verticalReady && !verticalOpen) {
    return (
      <div className="page-shell" style={{ maxWidth: 640, margin: "48px auto", padding: 24, textAlign: "center" }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900 }}>Alışveriş geçici olarak kapalı</h1>
        <p style={{ margin: "12px 0 20px", color: "#64748b", lineHeight: 1.5 }}>
          Bu dikey yönetici tarafından kapatıldı. Ana sayfaya dönebilirsiniz.
        </p>
        <Link href="/" className="btn-orange" style={{ padding: "12px 18px", textDecoration: "none" }}>
          Ana sayfa
        </Link>
      </div>
    );
  }

  if (showingFeatured) {
    return (
      <div className="tb-shop">
        <div className="tb-shop-strip">
          <V2CategoryStrip filters={browse} onSelect={onShopSelect} mode="alisveris" />
        </div>

        <section className="tb-hero-board">
          <div className="tb-hero-grid">
            <div className="tb-hero-copy">
              <div className="tb-hero-eyebrow">Teklif odaklı alışveriş</div>
              <h1>
                Fiyatı sen belirle, <span>en iyi teklifi sen kap.</span>
              </h1>
              <p>
                Pazarlık yok, mesaj trafiği yok. Satıcı fiyatını koyar; sen istersen hemen alır,
                istersen teklif verirsin. Satıcı istediği teklifi — birini veya birkaçını —
                kabul eder. Açık artırma değil; şeffaf, hızlı ve güvenli teklif sistemi.
              </p>
              <div className="tb-hero-actions">
                <Link href="/ilan-ver" className="tb-btn tb-btn-orange">
                  Hemen teklif ver
                </Link>
                <a href="#nasil" className="tb-btn tb-btn-glass">
                  Nasıl çalışır?
                </a>
              </div>
            </div>

            <AlisverisFeaturedOfferCard listing={featured} />
            <AlisverisLiveOffersPanel items={live} timeAgo={timeAgo} />
          </div>
        </section>

        <div className="tb-stats-row">
          {[
            {
              l: "Bugün verilen teklif",
              v: formatCompact(s?.bidsToday ?? 0),
              d: formatChangePct(s?.bidsTodayChangePct ?? 0),
            },
            {
              l: "Kabul edilen teklif",
              v: formatCompact(s?.acceptedToday ?? 0),
              d: formatChangePct(s?.acceptedTodayChangePct ?? 0),
            },
            {
              l: "Son 24 saatte satılan",
              v: formatCompact(s?.soldLast24h ?? 0),
              d: formatChangePct(s?.soldLast24hChangePct ?? 0),
            },
            {
              l: "Aktif ürün",
              v: formatCompact(s?.activeListings ?? totalCount),
              d: formatChangePct(0),
            },
          ].map((c) => (
            <div key={c.l} className="tb-stat-card">
              <div className="l">{c.l}</div>
              <div className="v">{c.v}</div>
              <div className="d">
                <ArrowUpRight size={12} />
                {c.d.text}
              </div>
            </div>
          ))}
        </div>

        <AlisverisCategoryMosaic categories={categoryMosaic} onSelect={setShopCategory} />

        <section className="tb-sec" id="kesfet">
          <div className="tb-sec-head">
            <h2>Sizin için öne çıkanlar</h2>
            <button
              type="button"
              onClick={() => setShopCategory(alisverisTree[0]?.filter.category || "")}
              style={{
                border: "none",
                background: "transparent",
                color: "var(--tb-orange-deep)",
                fontWeight: 750,
                cursor: "pointer",
              }}
            >
              Tümünü gör
            </button>
          </div>
          <div className="tb-deals-row">
            <div className="tb-timer-card">
              <div>
                <h3>Süreli fırsatlar</h3>
                <p>Teklif süresi dolmadan kararını ver.</p>
                <div className="tb-countdown">
                  <div>
                    <strong>{String(cd.d).padStart(2, "0")}</strong>
                    <span>Gün</span>
                  </div>
                  <div>
                    <strong>{String(cd.h).padStart(2, "0")}</strong>
                    <span>Saat</span>
                  </div>
                  <div>
                    <strong>{String(cd.m).padStart(2, "0")}</strong>
                    <span>Dk</span>
                  </div>
                  <div>
                    <strong>{String(cd.s).padStart(2, "0")}</strong>
                    <span>Sn</span>
                  </div>
                </div>
              </div>
              {endingSoon ? (
                <Link href={`/ilan/${endingSoon.id}`}>İlanı gör</Link>
              ) : (
                <Link href="/alisveris">Keşfet</Link>
              )}
            </div>
            <div className="tb-product-row">
              {listings.slice(0, 4).map((l, i) => (
                <AlisverisOfferProductCard key={l.id} listing={l} index={i} />
              ))}
              {!listings.length && (
                <div className="tb-empty" style={{ gridColumn: "1 / -1" }}>
                  Henüz öne çıkan ürün yok.
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="tb-sec" id="nasil">
          <div className="tb-sec-head">
            <h2>TeklifBu nasıl çalışır?</h2>
          </div>
          <div className="tb-how">
            {[
              ["1", "Ürünü seç", "Satıcı fiyatını ve detayları incele."],
              ["2", "Teklif ver veya hemen al", "Kendi teklifini ilet ya da satıcı fiyatından al."],
              ["3", "Satıcı değerlendirir", "Bir veya birden fazla teklifi kabul edebilir."],
              ["4", "Güvenli alışveriş", "Kabul sonrası ödeme TeklifBu güvencesinde."],
            ].map(([n, t, d]) => (
              <div key={n} className="tb-how-item">
                <div className="tb-how-ico">{n}</div>
                <h3>{t}</h3>
                <p>{d}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="tb-sec">
          <div className="tb-trust">
            {[
              { Icon: ShieldCheck, t: "Güvenli ödeme" },
              { Icon: Store, t: "Doğrulanmış mağaza" },
              { Icon: RefreshCw, t: "İade koruması" },
              { Icon: History, t: "Teklif geçmişi" },
              { Icon: Eye, t: "Şeffaf işlem" },
            ].map(({ Icon, t }) => (
              <span key={t}>
                <Icon size={16} color="var(--tb-orange-deep)" />
                {t}
              </span>
            ))}
          </div>
        </section>

        <section className="tb-sec">
          <div className="tb-promo">
            <Link href="/premium" className="tb-promo-card tb-promo-a">
              <div>
                <h3>Premium üyelik</h3>
                <p>Daha fazla görünürlük, öncelikli vitrin ve güçlü mağaza araçları.</p>
              </div>
              <span className="go">Keşfet →</span>
            </Link>
            <Link href="/jeton" className="tb-promo-card tb-promo-b">
              <div>
                <h3>Jeton paketleri</h3>
                <p>Teklif vermek ve öne çıkmak için jetonunu hazırla.</p>
              </div>
              <span className="go">
                {tokenPackages[0]
                  ? `${tokenPackages[0].tokenAmount} jeton · ${formatPackagePrice(tokenPackages[0].priceTl)}`
                  : "Jeton al →"}
              </span>
            </Link>
            <Link href="/hesabim" className="tb-promo-card tb-promo-c">
              <div>
                <h3>Arkadaşını davet et</h3>
                <p>Birlikte büyüyen teklif ağı — davetini gönder.</p>
              </div>
              <span className="go">Davet et →</span>
            </Link>
          </div>
        </section>

        <Link href="/ilan-ver" className="v2-fab" aria-label="İlan Ver">
          <Plus size={22} strokeWidth={2.75} />
          <span>İlan Ver</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="tb-shop">
      <div className="tb-shop-strip">
        <V2CategoryStrip filters={browse} onSelect={onShopSelect} mode="alisveris" />
      </div>

      <div className="tb-browse">
        <aside className="tb-browse-aside">
          <div className="v2-filter-label" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            Alışveriş
            <button type="button" className="tb-back" onClick={() => setShopCategory("")}>
              Ana sayfa
            </button>
          </div>
          <CategoryBrowseNav
            embedded
            variant="alisveris"
            hideHeader
            browseTree={alisverisTree}
            treeLoading={alisverisTreeLoading}
            filters={browse}
            facets={facets}
            onSelect={onShopSelect}
          />
          <div style={{ height: 1, background: "var(--tb-line)", margin: "12px 0" }} />
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
                  name="alisveris-cond"
                  checked={condition === v}
                  onChange={() => setCondition(v)}
                />
                {label}
              </label>
            ))}
          </div>
          <div className="v2-filter-block">
            <div className="v2-filter-label">Fiyat</div>
            <div className="v2-price-row">
              <input
                inputMode="numeric"
                placeholder="Min"
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value.replace(/\D/g, ""))}
              />
              <input
                inputMode="numeric"
                placeholder="Max"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value.replace(/\D/g, ""))}
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
              <option value="">İl</option>
              {CITY_NAMES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <select value={district} onChange={(e) => setDistrict(e.target.value)} disabled={!city}>
              <option value="">İlçe</option>
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

        <section className="tb-browse-main">
          <div className="tb-toolbar">
            <h1>
              {activeCatName || "Alışveriş"} <em>{formatCompact(totalCount)} ürün</em>
            </h1>
            <div className="v2-toolbar-meta">
              <label className="v2-sort-wrap">
                <span>Sıralama</span>
                <select className="v2-sort" value={sort} onChange={(e) => setSort(e.target.value)}>
                  <option value="new">En yeni</option>
                  <option value="ask-desc">Fiyat yüksek</option>
                  <option value="ask-asc">Fiyat düşük</option>
                  <option value="ending">Süresi yakın</option>
                  <option value="market-desc">En çok teklif</option>
                </select>
              </label>
              <ListingViewToggle view={view} onChange={changeView} compact />
            </div>
          </div>

          <div
            className={`tb-product-row${view === "list" ? " tb-product-row--list" : ""}`}
            style={
              view === "list"
                ? { gridTemplateColumns: "1fr" }
                : { gridTemplateColumns: "repeat(3, minmax(0,1fr))" }
            }
          >
            {listings.map((l, i) => (
              <AlisverisOfferProductCard
                key={l.id}
                listing={l}
                index={i}
                variant={view === "list" ? "list" : "grid"}
              />
            ))}
          </div>
          {!listings.length && <div className="tb-empty">Bu kategoride henüz ürün yok.</div>}

          {totalPages > 1 && (
            <nav className="v2-pager" aria-label="Sayfalama">
              <button type="button" disabled={page <= 1} onClick={() => goToPage(page - 1)}>
                Önceki
              </button>
              {pagerPages.map((n) => (
                <button
                  key={n}
                  type="button"
                  className={n === page ? "active" : undefined}
                  onClick={() => goToPage(n)}
                >
                  {n}
                </button>
              ))}
              <button type="button" disabled={page >= totalPages} onClick={() => goToPage(page + 1)}>
                Sonraki
              </button>
            </nav>
          )}
        </section>
      </div>

      <Link href="/ilan-ver" className="v2-fab" aria-label="İlan Ver">
        <Plus size={22} strokeWidth={2.75} />
        <span>İlan Ver</span>
      </Link>
    </div>
  );
}
