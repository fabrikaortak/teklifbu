"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ListingCard, type ListingCardData } from "@/components/ListingCard";
import { formatCompact } from "@/lib/format";
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
import {
  PREMIUM_CATEGORY_SEEDS,
  childPremiumSlug,
  isPremiumCategorySlug,
  type PremiumVertical,
} from "@/data/premiumCategories";
import { isAlisverisCategorySlug } from "@/data/classicBrowseTree";
import { useTheme } from "@/components/ThemeProvider";
import {
  PremiumVerticalCards,
  emptyPremiumBuckets,
  type PremiumHomeLimits,
} from "@/components/home/PremiumVerticalCards";

function listingQuery(filters: SearchFilters) {
  const params = new URLSearchParams();
  if (filters.category) params.set("category", filters.category);
  if (filters.city) params.set("city", filters.city);
  if (filters.district) params.set("district", filters.district);
  if (filters.minPrice) params.set("minPrice", filters.minPrice);
  if (filters.maxPrice) params.set("maxPrice", filters.maxPrice);
  return params.toString();
}

const DEFAULT_LIMITS: PremiumHomeLimits = { hotel: 4, logistics: 4, rideshare: 4 };

export function PremiumHome() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { categoriesTheme } = useTheme();
  const classicCats = categoriesTheme === "v2";

  const initialCat = searchParams.get("category") || "";
  const [browse, setBrowse] = useState<SearchFilters>({
    ...EMPTY_SEARCH_FILTERS,
    category: isPremiumCategorySlug(initialCat) ? initialCat : "",
  });
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [city, setCity] = useState("");
  const [district, setDistrict] = useState("");
  const [listings, setListings] = useState<ListingCardData[]>([]);
  const [facets, setFacets] = useState<FacetCounts | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [limits, setLimits] = useState<PremiumHomeLimits>(DEFAULT_LIMITS);
  const [enabled, setEnabled] = useState<Record<string, boolean>>({
    hotel: true,
    logistics: true,
    rideshare: true,
  });
  const [buckets, setBuckets] = useState(emptyPremiumBuckets);
  const { view, changeView } = useListingView("teklifbu:premium-home-view", "grid");
  const [sort, setSort] = useState("new");

  const districts = city ? getDistricts(city) : [];

  const activeCatName = useMemo(() => {
    if (!browse.category) return null;
    for (const root of PREMIUM_CATEGORY_SEEDS) {
      if (browse.category === root.slug) return root.name;
      for (const sub of root.children) {
        if (browse.category === childPremiumSlug(root.slug, sub.slug)) {
          return `${root.name} › ${sub.name}`;
        }
      }
    }
    return browse.category;
  }, [browse.category]);

  const loadListings = useCallback((filters: SearchFilters) => {
    const cat = filters.category || "";
    const categoryParam = isPremiumCategorySlug(cat)
      ? cat
      : PREMIUM_CATEGORY_SEEDS.map((r) => r.slug).join(",");
    const qs = listingQuery({ ...filters, category: categoryParam });
    fetch(`/api/listings?${qs}&limit=40`)
      .then((r) => r.json())
      .then((d) => {
        setListings(d.listings || []);
        setTotalCount(d.pagination?.total ?? (d.listings || []).length);
        if (d.facets) setFacets(d.facets);
      });
  }, []);

  const loadVitrin = useCallback((lim: PremiumHomeLimits, en: Record<string, boolean>) => {
    Promise.all(
      PREMIUM_CATEGORY_SEEDS.filter((r) => en[r.vertical] !== false).map(async (r) => {
        const take = Math.min(12, Math.max(1, lim[r.vertical] || 4));
        const d = await fetch(
          `/api/listings?category=${encodeURIComponent(r.slug)}&limit=${take}`
        ).then((res) => res.json());
        return {
          vertical: r.vertical as PremiumVertical,
          slug: r.slug,
          name: r.name,
          listings: (d.listings || []) as ListingCardData[],
        };
      })
    ).then((rows) => setBuckets(rows));
  }, []);

  useEffect(() => {
    fetch("/api/theme")
      .then((r) => r.json())
      .then((d) => {
        const nextLimits: PremiumHomeLimits = {
          hotel: Math.min(12, Math.max(1, Number(d?.premiumHomeLimits?.hotel) || 4)),
          logistics: Math.min(12, Math.max(1, Number(d?.premiumHomeLimits?.logistics) || 4)),
          rideshare: Math.min(12, Math.max(1, Number(d?.premiumHomeLimits?.rideshare) || 4)),
        };
        const nextEn = d?.premiumVerticals || enabled;
        setLimits(nextLimits);
        setEnabled(nextEn);
        loadVitrin(nextLimits, nextEn);
      })
      .catch(() => loadVitrin(DEFAULT_LIMITS, enabled));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadVitrin]);

  useEffect(() => {
    const cat = searchParams.get("category") || "";
    const next = {
      ...browse,
      category: isPremiumCategorySlug(cat) ? cat : "",
    };
    setBrowse(next);
    loadListings(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, loadListings]);

  function setPremiumCategory(category: string) {
    const qs = category ? `?category=${encodeURIComponent(category)}` : "";
    router.push(`/premium${qs}`);
  }

  function onPremiumSelect(patch: {
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
    setPremiumCategory(patch.category);
  }

  /** Klasik kategori → ana sayfa / ilanlar */
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
    if (isAlisverisCategorySlug(patch.category) || patch.category === "alisveris") {
      const qs =
        patch.category && patch.category !== "alisveris"
          ? `?category=${encodeURIComponent(patch.category)}`
          : "";
      router.push(`/alisveris${qs}`);
      return;
    }
    router.push(
      buildSearchHref({
        ...EMPTY_SEARCH_FILTERS,
        category: patch.category,
        dealType: patch.dealType,
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
    loadListings({ ...browse, city, district, minPrice, maxPrice });
  }

  const sorted = useMemo(() => {
    const arr = [...listings];
    if (sort === "ask-desc") return arr.sort((a, b) => Number(b.askPrice) - Number(a.askPrice));
    if (sort === "ask-asc") return arr.sort((a, b) => Number(a.askPrice) - Number(b.askPrice));
    if (sort === "ending") {
      return arr.sort((a, b) => {
        const ae = a.endsAt ? new Date(a.endsAt).getTime() : Infinity;
        const be = b.endsAt ? new Date(b.endsAt).getTime() : Infinity;
        return ae - be;
      });
    }
    return arr;
  }, [listings, sort]);

  const rangePct = (() => {
    const min = Number(minPrice) || 0;
    const max = Number(maxPrice) || 0;
    if (!max && !min) return 50;
    if (max <= min) return 100;
    return Math.min(100, Math.round((min / max) * 100));
  })();

  return (
    <div className="v2-home v2-home--premium">
      <aside className="v2-left v2-side-card">
        <PremiumBrowseSection filters={browse} onSelect={onPremiumSelect} facets={facets} />

        <div style={{ height: 1, background: "var(--line)", margin: "10px 0 12px" }} />

        {classicCats ? (
          <CategoryBrowseNav
            embedded
            variant="classic"
            filters={EMPTY_SEARCH_FILTERS}
            facets={facets}
            onSelect={onClassicSelect}
          />
        ) : (
          <CategoryBrowseNav
            embedded
            filters={EMPTY_SEARCH_FILTERS}
            facets={facets}
            onSelect={onClassicSelect}
          />
        )}

        <AlisverisBrowseSection filters={EMPTY_SEARCH_FILTERS} onSelect={onClassicSelect} />

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
        <PremiumVerticalCards
          buckets={buckets}
          limits={limits}
          activeCategory={browse.category}
          onSelectVertical={setPremiumCategory}
        />

        <div className="v2-toolbar" style={{ marginTop: 18 }}>
          <h1>
            {activeCatName ? (
              <>
                Premium · &quot;{activeCatName}&quot; — <em>{formatCompact(totalCount)}</em> ilan
              </>
            ) : (
              <>
                Premium kapasite — <em>{formatCompact(totalCount)}</em> ilan
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
                <option value="new">En Yeni</option>
                <option value="ask-desc">İlan Fiyatı (Yüksekten Düşüğe)</option>
                <option value="ask-asc">İlan Fiyatı (Düşükten Yükseğe)</option>
                <option value="ending">Süresi Yakınlaşan</option>
              </select>
            </label>
            <ListingViewToggle view={view} onChange={changeView} compact />
          </div>
        </div>

        <div
          className={view === "grid" ? "listings-grid-4" : "listings-stack"}
          style={view === "list" ? { display: "grid", gap: 10 } : undefined}
        >
          {sorted.map((l) => (
            <ListingCard key={l.id} listing={l} variant={view === "list" ? "row" : "grid"} homeMode />
          ))}
        </div>
        {!sorted.length && (
          <div className="v2-side-card" style={{ marginTop: 8, textAlign: "center", color: "var(--muted)" }}>
            Bu dikeyde henüz ilan yok.
          </div>
        )}
      </section>
    </div>
  );
}
