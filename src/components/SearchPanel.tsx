"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Search } from "lucide-react";
import {
  CITY_NAMES,
  getDistricts,
  RENT_PRICE_OPTIONS,
  SALE_PRICE_OPTIONS,
} from "@/data/turkey-locations";
import { LocationSelect } from "@/components/LocationSelect";
import { formatNumberTr } from "@/lib/format";
import { DEAL_TYPE_OPTIONS, isRentDeal } from "@/lib/dealType";

export type SearchFilters = {
  category: string;
  dealType: "" | "SATILIK" | "KIRALIK" | "DEVREN_SATILIK" | "DEVREN_KIRALIK";
  subtype: string;
  rental: string;
  brand: string;
  model: string;
  version: string;
  trim: string;
  city: string;
  district: string;
  neighborhood: string;
  minPrice: string;
  maxPrice: string;
  q: string;
};

export const EMPTY_SEARCH_FILTERS: SearchFilters = {
  category: "",
  dealType: "",
  subtype: "",
  rental: "",
  brand: "",
  model: "",
  version: "",
  trim: "",
  city: "",
  district: "",
  neighborhood: "",
  minPrice: "",
  maxPrice: "",
  q: "",
};

export function filtersFromParams(params: URLSearchParams): SearchFilters {
  const type = params.get("type") || "";
  return {
    category: params.get("category") || "",
    dealType:
      type === "SATILIK" || type === "KIRALIK" || type === "DEVREN_SATILIK" || type === "DEVREN_KIRALIK"
        ? type
        : "",
    subtype: params.get("subtype") || "",
    rental: params.get("rental") || "",
    brand: params.get("brand") || "",
    model: params.get("model") || "",
    version: params.get("version") || "",
    trim: params.get("trim") || "",
    city: params.get("city") || "",
    district: params.get("district") || "",
    neighborhood: params.get("neighborhood") || "",
    minPrice: params.get("minPrice") || "",
    maxPrice: params.get("maxPrice") || "",
    q: params.get("q") || "",
  };
}

export function buildSearchHref(filters: SearchFilters) {
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
  if (filters.neighborhood) params.set("neighborhood", filters.neighborhood);
  if (filters.minPrice) params.set("minPrice", filters.minPrice);
  if (filters.maxPrice) params.set("maxPrice", filters.maxPrice);
  if (filters.q.trim()) params.set("q", filters.q.trim());
  const qs = params.toString();
  return qs ? `/ilanlar?${qs}` : "/ilanlar";
}

type CategoryOption = {
  slug: string;
  name: string;
  children?: Array<{ slug: string; name: string }>;
};

type Props = {
  value: SearchFilters;
  onChange: (next: SearchFilters) => void;
  categories: CategoryOption[];
  /** Compact hero layout vs full listings sidebar */
  variant?: "hero" | "page";
  showCategoryTabs?: boolean;
  onTabSelect?: (slug: string) => void;
  getCatIcon?: (slug: string, size?: number) => ReactNode;
};

export function SearchPanel({
  value,
  onChange,
  categories,
  variant = "hero",
  showCategoryTabs,
  onTabSelect,
  getCatIcon,
}: Props) {
  const districts = useMemo(() => (value.city ? getDistricts(value.city) : []), [value.city]);
  const [neighborhoods, setNeighborhoods] = useState<string[]>([]);
  const priceOptions = isRentDeal(value.dealType) ? RENT_PRICE_OPTIONS : SALE_PRICE_OPTIONS;
  const href = buildSearchHref(value);

  useEffect(() => {
    if (!value.city || !value.district) {
      setNeighborhoods([]);
      return;
    }
    let cancelled = false;
    fetch(`/api/locations?city=${encodeURIComponent(value.city)}&district=${encodeURIComponent(value.district)}`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setNeighborhoods(d.neighborhoods || []);
      })
      .catch(() => {
        if (!cancelled) setNeighborhoods([]);
      });
    return () => {
      cancelled = true;
    };
  }, [value.city, value.district]);

  function set<K extends keyof SearchFilters>(key: K, v: SearchFilters[K]) {
    const next = { ...value, [key]: v };
    if (key === "city") {
      next.district = "";
      next.neighborhood = "";
    }
    if (key === "district") next.neighborhood = "";
    if (key === "dealType") {
      next.minPrice = "";
      next.maxPrice = "";
    }
    if (key === "category") {
      next.subtype = "";
      next.rental = "";
      next.brand = "";
      next.model = "";
      next.version = "";
      next.trim = "";
    }
    onChange(next);
  }

  const isHero = variant === "hero";

  return (
    <div style={{ display: "flex", flexDirection: "column", height: isHero ? "100%" : undefined, gap: isHero ? 0 : 12 }}>
      {showCategoryTabs && (
        <div
          className="hero-cat-tabs"
          style={{
            display: "flex",
            gap: 0,
            marginBottom: 12,
            borderBottom: "1px solid var(--line)",
            overflow: "hidden",
            width: "100%",
          }}
        >
          {categories.map((c) => (
            <button
              key={c.slug}
              type="button"
              onClick={() => {
                set("category", c.slug);
                onTabSelect?.(c.slug);
              }}
              style={{
                display: "inline-flex",
                flex: "1 1 0",
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 4,
                padding: "8px 2px 10px",
                minWidth: 0,
                border: "none",
                borderBottom: value.category === c.slug ? "2.5px solid var(--orange)" : "2.5px solid transparent",
                background: "transparent",
                color: value.category === c.slug ? "var(--navy)" : "#6b7280",
                fontWeight: 700,
                fontSize: 11,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</span>
              {getCatIcon && (
                <span style={{ display: "inline-flex", flexShrink: 0, opacity: value.category === c.slug ? 1 : 0.85 }}>
                  {getCatIcon(c.slug, 16)}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      <div style={{ display: "grid", gap: 8, flex: isHero ? 1 : undefined, alignContent: "start" }}>
        <div style={{ display: "grid", gridTemplateColumns: isHero ? "1fr 1fr" : "1fr", gap: 8 }}>
          <LocationSelect
            label="İl"
            value={value.city}
            options={CITY_NAMES}
            placeholder="İl Seçin"
            onChange={(v) => set("city", v)}
          />
          <LocationSelect
            label="İlçe"
            value={value.district}
            options={districts}
            placeholder="İlçe Seçin"
            disabled={!value.city}
            onChange={(v) => set("district", v)}
          />
        </div>

        <LocationSelect
          label="Mahalle"
          value={value.neighborhood}
          options={neighborhoods}
          placeholder="Mahalle Seçin"
          disabled={!value.district}
          onChange={(v) => set("neighborhood", v)}
        />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }} className="search-filters">
          {isHero && (
            <>
              <select className="select" value={value.category} onChange={(e) => set("category", e.target.value)} aria-label="Kategori">
                <option value="">Kategori Seçin</option>
                {categories.map((c) =>
                  c.children?.length ? (
                    <optgroup key={c.slug} label={c.name}>
                      <option value={c.slug}>Tümü — {c.name}</option>
                      {c.children.map((ch) => (
                        <option key={ch.slug} value={ch.slug}>
                          {ch.name}
                        </option>
                      ))}
                    </optgroup>
                  ) : (
                    <option key={c.slug} value={c.slug}>
                      {c.name}
                    </option>
                  )
                )}
              </select>
              <select
                className="select"
                value={value.dealType}
                onChange={(e) => set("dealType", e.target.value as SearchFilters["dealType"])}
                aria-label="Tür"
              >
                <option value="">Tür Seçin</option>
                {DEAL_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </>
          )}
          <select className="select" value={value.minPrice} onChange={(e) => set("minPrice", e.target.value)} aria-label="Min fiyat">
            <option value="">Min Fiyat</option>
            {priceOptions.map((p) => (
              <option key={`min-${p}`} value={String(p)}>
                {formatNumberTr(p)} TL
              </option>
            ))}
          </select>
          <select className="select" value={value.maxPrice} onChange={(e) => set("maxPrice", e.target.value)} aria-label="Max fiyat">
            <option value="">Max Fiyat</option>
            {priceOptions.map((p) => (
              <option key={`max-${p}`} value={String(p)}>
                {formatNumberTr(p)} TL
              </option>
            ))}
          </select>
        </div>

        {!isHero && (
          <input
            className="input"
            placeholder="Başlık veya 12 haneli ilan no"
            value={value.q}
            onChange={(e) => set("q", e.target.value)}
          />
        )}

        <Link
          href={href}
          className="btn-orange"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            padding: isHero ? "12px" : "13px",
            fontSize: 15,
            borderRadius: 12,
            marginTop: isHero ? "auto" : 4,
          }}
        >
          <Search size={18} /> İlan Ara
        </Link>
      </div>
    </div>
  );
}
