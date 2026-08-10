"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { TrendingUp, ChevronRight } from "lucide-react";
import { ListingCard, ListingCardData } from "@/components/ListingCard";
import {
  SearchFilters,
  SearchPanel,
  buildSearchHref,
  filtersFromParams,
} from "@/components/SearchPanel";
import { CategoryBrowseNav } from "@/components/CategoryBrowseNav";
import { PremiumBrowseSection } from "@/components/PremiumBrowseSection";
import { AlisverisBrowseSection } from "@/components/AlisverisBrowseSection";
import { ListingViewToggle, useListingView } from "@/components/ListingViewToggle";
import { dealTypeLabel } from "@/lib/dealType";
import { findBrowseNode, matchBrowsePath } from "@/data/categoryBrowseTree";
import { isAlisverisCategorySlug } from "@/data/classicBrowseTree";
import { isPremiumCategorySlug } from "@/data/premiumCategories";
import type { FacetCounts } from "@/lib/facetHelpers";
import { brandLabel, modelLabel, trimLabel } from "@/lib/vasitaLabels";
import { RecentSalesStrip } from "@/components/RecentSalesStrip";
import { ListingThumbImg } from "@/components/ListingThumbImg";
import { formatTl } from "@/lib/format";
import { useTheme } from "@/components/ThemeProvider";
import { V2CategoryStrip } from "@/components/home/V2CategoryStrip";
import {
  appendModeToHref,
  modeEmptyMessage,
  modeFromParams,
  modeTitle,
  type ListingBrowseMode,
} from "@/lib/listingBrowseMode";

type LiveBidItem = {
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
    askPrice: number;
    highestBid: number;
  };
};

function timeAgo(iso: string) {
  const m = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (m < 60) return `${m} dk önce`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} saat önce`;
  return `${Math.floor(h / 24)} gün önce`;
}

function ListingsInner() {
  const search = useSearchParams();
  const router = useRouter();
  const { categoriesTheme } = useTheme();
  const classicCats = categoriesTheme === "v2";
  const mode: ListingBrowseMode = modeFromParams(search);
  const [listings, setListings] = useState<ListingCardData[]>([]);
  const [liveItems, setLiveItems] = useState<LiveBidItem[]>([]);
  const [categories, setCategories] = useState<
    Array<{ slug: string; name: string; children?: Array<{ slug: string; name: string }> }>
  >([]);
  const [facets, setFacets] = useState<FacetCounts | null>(null);
  const [filters, setFilters] = useState<SearchFilters>(() => filtersFromParams(search));
  const [loading, setLoading] = useState(true);
  const { view, changeView } = useListingView("teklifbu:listings-view", "list");

  const queryKey = search.toString();
  const isLive = mode === "live";
  const isInsightMode = mode !== "default";

  useEffect(() => {
    const sid = search.get("sellerId");
    if (sid) router.replace(`/satici/${encodeURIComponent(sid)}`);
  }, [search, router]);

  useEffect(() => {
    setFilters(filtersFromParams(search));
  }, [queryKey, search]);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams(queryKey);
    if (isLive && !params.get("limit")) params.set("limit", "40");

    const metaParams = new URLSearchParams(queryKey);
    metaParams.delete("live");
    metaParams.set("limit", "1");

    const liveFetch = fetch(`/api/listings?${params}`).then((r) => r.json());
    const metaFetch = isLive
      ? fetch(`/api/listings?${metaParams}`).then((r) => r.json()).catch(() => ({}))
      : Promise.resolve(null);

    Promise.all([liveFetch, metaFetch])
      .then(([d, meta]) => {
        if (isLive) {
          setLiveItems(Array.isArray(d.items) ? d.items : []);
          setListings([]);
          const src = meta || d;
          setFacets(src.facets || null);
          setCategories(
            (src.categories || []).map(
              (c: {
                slug: string;
                name: string;
                children?: Array<{ slug: string; name: string }>;
              }) => ({
                slug: c.slug,
                name: c.name,
                children: c.children || [],
              })
            )
          );
        } else {
          setListings(d.listings || []);
          setLiveItems([]);
          setFacets(d.facets || null);
          setCategories(
            (d.categories || []).map(
              (c: {
                slug: string;
                name: string;
                children?: Array<{ slug: string; name: string }>;
              }) => ({
                slug: c.slug,
                name: c.name,
                children: c.children || [],
              })
            )
          );
        }
      })
      .finally(() => setLoading(false));
  }, [queryKey, isLive]);

  // Canlı akış: periyodik yenile
  useEffect(() => {
    if (!isLive) return;
    const id = window.setInterval(() => {
      const params = new URLSearchParams(queryKey);
      if (!params.get("limit")) params.set("limit", "40");
      fetch(`/api/listings?${params}`)
        .then((r) => r.json())
        .then((d) => {
          if (Array.isArray(d.items)) setLiveItems(d.items);
        })
        .catch(() => {});
    }, 20000);
    return () => window.clearInterval(id);
  }, [isLive, queryKey]);

  const activeLabels = useMemo(() => {
    const parts: string[] = [];
    if (filters.city) parts.push(filters.city);
    if (filters.district) parts.push(filters.district);
    if (filters.neighborhood) parts.push(filters.neighborhood);
    const path = matchBrowsePath({
      category: filters.category,
      dealType: filters.dealType,
      subtype: filters.subtype,
      rental: filters.rental,
    });
    if (path.length) {
      const labels = path.map((id) => findBrowseNode(id)?.name).filter(Boolean) as string[];
      if (filters.brand && filters.subtype) {
        labels.push(brandLabel(filters.brand));
      }
      if (filters.model && filters.brand && filters.subtype) {
        labels.push(modelLabel(filters.model));
      }
      if (filters.version && filters.model && filters.brand && filters.subtype) {
        labels.push(trimLabel(filters.version));
      }
      if (filters.trim && filters.model && filters.brand && filters.subtype) {
        labels.push(trimLabel(filters.trim));
      }
      if (labels.length) parts.push(labels.join(" › "));
    } else if (filters.category) {
      const cat = categories.find((c) => c.slug === filters.category);
      const ch = categories.flatMap((c) => c.children || []).find((x) => x.slug === filters.category);
      parts.push(ch?.name || cat?.name || filters.category);
    }
    if (
      filters.dealType &&
      !path.some((id) => id.includes("satilik") || id.includes("kiralik") || id.includes("gunluk"))
    ) {
      parts.push(dealTypeLabel(filters.dealType));
    }
    return parts;
  }, [filters, categories]);

  function listingsHref(next: SearchFilters) {
    return appendModeToHref(buildSearchHref(next), mode);
  }

  function onFiltersChange(next: SearchFilters) {
    const qOnly =
      next.q !== filters.q &&
      next.category === filters.category &&
      next.dealType === filters.dealType &&
      next.subtype === filters.subtype &&
      next.rental === filters.rental &&
      next.brand === filters.brand &&
      next.model === filters.model &&
      next.version === filters.version &&
      next.trim === filters.trim &&
      next.city === filters.city &&
      next.district === filters.district &&
      next.neighborhood === filters.neighborhood &&
      next.minPrice === filters.minPrice &&
      next.maxPrice === filters.maxPrice;
    setFilters(next);
    if (!qOnly) router.push(listingsHref(next));
  }

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
      const qs =
        patch.category && patch.category !== "premium"
          ? `?category=${encodeURIComponent(patch.category)}`
          : "";
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
    onFiltersChange({
      ...filters,
      category: patch.category,
      dealType: patch.dealType,
      subtype: patch.subtype,
      rental: patch.rental,
      brand: patch.brand,
      model: patch.model,
      version: patch.version,
      trim: patch.trim,
    });
  }

  const countLabel = isLive
    ? `${liveItems.length} teklif`
    : `${listings.length} ilan`;

  const title = (() => {
    if (modeTitle(mode, search.get("sellerId")) !== "İlanlar") {
      return modeTitle(mode, search.get("sellerId"));
    }
    if (filters.brand && filters.subtype) {
      const brand = brandLabel(filters.brand);
      const series = filters.model ? ` ${modelLabel(filters.model)}` : "";
      return `${brand}${series} Fiyatları & Modelleri`;
    }
    if (filters.subtype) {
      const sub =
        findBrowseNode(`arac/${filters.subtype}`)?.name ||
        findBrowseNode(filters.subtype)?.name ||
        filters.subtype;
      return `${sub} İlanları`;
    }
    return modeTitle(mode, search.get("sellerId"));
  })();

  return (
    <>
      <V2CategoryStrip
        filters={filters}
        onSelect={onBrowseSelect}
        browseNavConfig={facets?.browseNavConfig}
      />

      {/* Ana sayfa ile aynı max-width/gutter — sol menü yatayda kaymasın */}
      <div className="v2-home v2-home--listings listings-page">
        <aside className="v2-left v2-side-card listings-side-nav">
          {classicCats ? (
            <CategoryBrowseNav
              embedded
              variant="classic"
              filters={filters}
              facets={facets}
              onSelect={onBrowseSelect}
            />
          ) : (
            <CategoryBrowseNav
              embedded
              filters={filters}
              facets={facets}
              onSelect={onBrowseSelect}
            />
          )}
          <AlisverisBrowseSection filters={filters} onSelect={onBrowseSelect} />
          <PremiumBrowseSection filters={filters} onSelect={onBrowseSelect} facets={facets} />
          <div style={{ height: 1, background: "var(--line)", margin: "10px 0 14px" }} />
          <h2 className="v2-side-title" style={{ margin: "0 0 12px" }}>
            Filtrele
          </h2>
          <SearchPanel value={filters} onChange={onFiltersChange} categories={categories} variant="page" />
        </aside>

        <div className="v2-main listings-main">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "end",
              gap: 12,
              marginBottom: 14,
              flexWrap: "wrap",
            }}
          >
            <div>
              <h1 style={{ margin: 0, fontWeight: 800, fontSize: 20, letterSpacing: "-0.02em" }}>{title}</h1>
              {activeLabels.length > 0 && (
                <p style={{ margin: "6px 0 0", color: "var(--muted)", fontSize: 14 }}>
                  {activeLabels.join(" · ")}
                </p>
              )}
              {isInsightMode && mode !== "live" && (
                <p style={{ margin: "6px 0 0", color: "var(--muted)", fontSize: 13 }}>
                  {mode === "ending" && "Süresi 48 saat içinde dolacak aktif ilanlar"}
                  {mode === "mostBids" && "Bugün en çok teklif alan aktif ilanlar"}
                  {mode === "profit" && "İlan fiyatının üzerinde sonuçlanan satışlar"}
                  {mode === "sold" && "Onaylanarak sonuçlanan satışlar"}
                  {mode === "forYou" && "Öne çıkan ve güncel ilan önerileri"}
                </p>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div style={{ color: "var(--muted)", fontSize: 14, fontWeight: 600 }}>
                {loading ? "Yükleniyor…" : countLabel}
              </div>
              {!isLive ? <ListingViewToggle view={view} onChange={changeView} /> : null}
            </div>
          </div>

          {isLive ? (
            <div className="live-feed-list">
              {liveItems.map((item) => {
                const prev = item.previousAmount != null ? Number(item.previousAmount) : null;
                return (
                  <Link key={item.id} href={`/ilan/${item.listing.id}`} className="live-feed-row">
                    <div className="live-feed-row__img">
                      {item.listing.coverImage ? (
                        <ListingThumbImg src={item.listing.coverImage} />
                      ) : (
                        <div className="live-feed-row__ph" />
                      )}
                    </div>
                    <div className="live-feed-row__body">
                      <div className="live-feed-row__title">{item.listing.title}</div>
                      <div className="live-feed-row__loc">
                        {[item.listing.district, item.listing.city].filter(Boolean).join(", ")}
                      </div>
                      <div className="live-feed-row__ask">
                        İlan fiyatı: <strong>{formatTl(item.listing.askPrice)}</strong>
                      </div>
                    </div>
                    <div className="live-feed-row__right">
                      <div className="live-feed-row__bid-label">Yeni teklif</div>
                      <span className="live-feed-row__amt is-up">
                        {formatTl(item.amount)}
                        <TrendingUp size={15} strokeWidth={2.5} aria-hidden />
                      </span>
                      {prev != null && prev > 0 ? (
                        <span className="live-feed-row__prev">{formatTl(prev)}</span>
                      ) : null}
                      <span className="live-feed-row__ago">{timeAgo(item.createdAt)}</span>
                    </div>
                    <ChevronRight size={16} className="live-feed-row__chev" />
                  </Link>
                );
              })}
            </div>
          ) : (
            <div
              className={view === "grid" ? "listings-grid-4" : "listings-stack"}
              style={view === "grid" ? undefined : { display: "grid", gap: 6 }}
            >
              {listings.map((l, i) => (
                <ListingCard
                  key={l.id}
                  listing={l}
                  variant={view === "list" ? "row" : "grid"}
                  rank={mode === "mostBids" || mode === "profit" ? i + 1 : undefined}
                />
              ))}
            </div>
          )}

          {!loading && (isLive ? !liveItems.length : !listings.length) && (
            <div className="card" style={{ padding: 24, marginTop: 8 }}>
              {modeEmptyMessage(mode)}
            </div>
          )}
        </div>
      </div>
      {mode === "default" ? (
        <RecentSalesStrip placement="ilanlar" shellClassName="page-shell-wide" className="recent-sales--compact" />
      ) : null}
    </>
  );
}

export default function ListingsPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40 }}>Yükleniyor...</div>}>
      <ListingsInner />
    </Suspense>
  );
}
