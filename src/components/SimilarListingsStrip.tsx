"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatTl } from "@/lib/format";

type MiniListing = {
  id: string;
  title: string;
  city: string;
  district?: string | null;
  neighborhood?: string | null;
  askPrice: number;
  highestBid: number;
  coverImage?: string | null;
  category?: { name: string; slug: string };
  attributes?: Record<string, unknown> | null;
};

function miniTitle(l: MiniListing) {
  const attrs = l.attributes || {};
  const rooms = String(attrs.rooms || "").trim();
  if (rooms) return `${rooms} Daire`;
  const brand = String(attrs.brand || "").trim();
  const model = String(attrs.model || "").trim();
  if (brand && model) return `${brand} ${model}`;
  if (l.category?.name) return l.category.name;
  return l.title.length > 28 ? `${l.title.slice(0, 26)}…` : l.title;
}

function miniLoc(l: MiniListing) {
  return [l.neighborhood || l.district, l.city].filter(Boolean).join(" · ") || l.city;
}

export function SimilarListingsStrip({
  listingId,
  categorySlug,
  city,
}: {
  listingId: string;
  categorySlug?: string | null;
  city?: string | null;
}) {
  const [items, setItems] = useState<MiniListing[]>([]);
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!listingId) return;
    const q = new URLSearchParams({ limit: "12" });
    if (categorySlug) q.set("category", categorySlug);
    else if (city) q.set("city", city);
    fetch(`/api/listings?${q}`)
      .then((r) => r.json())
      .then((d) => {
        const list = (d.listings || []) as MiniListing[];
        setItems(list.filter((x) => x.id !== listingId).slice(0, 10));
      })
      .catch(() => setItems([]));
  }, [listingId, categorySlug, city]);

  if (!items.length) return null;

  const seeAllHref = categorySlug
    ? `/ilanlar?category=${encodeURIComponent(categorySlug)}`
    : city
      ? `/ilanlar?city=${encodeURIComponent(city)}`
      : "/ilanlar";

  function scrollBy(dir: -1 | 1) {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * (el.clientWidth * 0.72), behavior: "smooth" });
  }

  return (
    <div className="similar-strip">
      <div className="similar-strip__head">
        <span className="similar-strip__title">Benzer İlanlar</span>
        <Link href={seeAllHref} className="similar-strip__all">
          Tümünü Gör ›
        </Link>
      </div>

      <div className="similar-strip__wrap">
        <button type="button" className="similar-strip__nav similar-strip__nav--prev" onClick={() => scrollBy(-1)} aria-label="Önceki">
          <ChevronLeft size={16} />
        </button>
        <div className="similar-strip__track" ref={scrollerRef}>
          {items.map((l) => (
            <Link key={l.id} href={`/ilan/${l.id}`} className="similar-mini">
              <div className="similar-mini__img">
                {l.coverImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={l.coverImage} alt="" />
                ) : (
                  <div className="similar-mini__ph" />
                )}
              </div>
              <div className="similar-mini__body">
                <div className="similar-mini__name">{miniTitle(l)}</div>
                <div className="similar-mini__loc">{miniLoc(l)}</div>
                <div className="similar-mini__ask">{formatTl(l.askPrice)}</div>
                <div className="similar-mini__bid">
                  En Yüksek: <strong>{l.highestBid ? formatTl(l.highestBid) : "—"}</strong>
                </div>
              </div>
            </Link>
          ))}
        </div>
        <button type="button" className="similar-strip__nav similar-strip__nav--next" onClick={() => scrollBy(1)} aria-label="Sonraki">
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
