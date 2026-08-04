"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatTl } from "@/lib/format";

export type RecentSalesPlacement = "home" | "listing_detail" | "profile" | "ilanlar";

type SaleItem = {
  id: string;
  title: string;
  city: string;
  district?: string | null;
  neighborhood?: string | null;
  coverImage?: string | null;
  askPrice: number;
  finalPrice: number;
  soldAt: string;
  category?: { name: string; slug: string } | null;
  attributes?: Record<string, unknown> | null;
};

function soldLabel(iso: string) {
  const m = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (m < 60) return `${m} dk önce`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} saat önce`;
  const d = Math.floor(h / 24);
  if (d === 1) return "1 gün önce";
  return `${d} gün önce`;
}

function saleTitle(s: SaleItem) {
  const attrs = s.attributes || {};
  const rooms = String(attrs.rooms || "").trim();
  if (rooms) return `${rooms} Daire`;
  const brand = String(attrs.brand || "").trim();
  const model = String(attrs.model || "").trim();
  if (brand && model) return `${brand} ${model}`;
  if (s.category?.name) return s.category.name;
  return s.title.length > 32 ? `${s.title.slice(0, 30)}…` : s.title;
}

function saleLoc(s: SaleItem) {
  return [s.district || s.neighborhood, s.city].filter(Boolean).join(", ") || s.city;
}

export function RecentSalesStrip({
  placement,
  className,
  shellClassName = "page-shell-wide",
}: {
  placement: RecentSalesPlacement;
  className?: string;
  shellClassName?: string;
}) {
  const [enabled, setEnabled] = useState(placement === "home");
  const [items, setItems] = useState<SaleItem[]>([]);
  const [ready, setReady] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/theme")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        const map = (d?.recentSalesPlacements || {}) as Record<string, boolean>;
        const on = Boolean(map[placement]);
        setEnabled(on);
        if (!on) {
          setReady(true);
          return;
        }
        return fetch("/api/listings?sold=1&format=sales&limit=16")
          .then((r) => r.json())
          .then((res) => {
            if (cancelled) return;
            const list = Array.isArray(res.sales) ? res.sales : [];
            setItems(
              [...list].sort(
                (a: SaleItem, b: SaleItem) =>
                  new Date(b.soldAt).getTime() - new Date(a.soldAt).getTime()
              )
            );
          });
      })
      .catch(() => {
        if (!cancelled && placement === "home") {
          fetch("/api/listings?sold=1&format=sales&limit=16")
            .then((r) => r.json())
            .then((res) => {
              if (cancelled) return;
              const list = Array.isArray(res.sales) ? res.sales : [];
              setItems(
                [...list].sort(
                  (a: SaleItem, b: SaleItem) =>
                    new Date(b.soldAt).getTime() - new Date(a.soldAt).getTime()
                  )
              );
            })
            .catch(() => {});
        }
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [placement]);

  if (!ready || !enabled || !items.length) return null;

  function scrollBy(dir: -1 | 1) {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * (el.clientWidth * 0.7), behavior: "smooth" });
  }

  return (
    <section className={`recent-sales ${className || ""}`} aria-label="Son onaylanan satışlar">
      <div className={shellClassName}>
        <div className="recent-sales__head">
          <h2 className="recent-sales__title">Son Gerçekleşen Satışlar</h2>
          <Link href="/ilanlar?sold=1" className="recent-sales__all">
            Tümünü Gör ›
          </Link>
        </div>

        <div className="recent-sales__wrap">
          <button
            type="button"
            className="recent-sales__nav recent-sales__nav--prev"
            onClick={() => scrollBy(-1)}
            aria-label="Önceki"
          >
            <ChevronLeft size={18} />
          </button>
          <div className="recent-sales__track" ref={scrollerRef}>
            {items.map((s) => (
              <Link key={s.id} href={`/ilan/${s.id}`} className="recent-sale-card">
                <div className="recent-sale-card__img">
                  {s.coverImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.coverImage} alt="" />
                  ) : (
                    <div className="recent-sale-card__ph" />
                  )}
                </div>
                <div className="recent-sale-card__body">
                  <div className="recent-sale-card__name">{saleTitle(s)}</div>
                  <div className="recent-sale-card__loc">{saleLoc(s)}</div>
                  <div className="recent-sale-card__ask">{formatTl(s.askPrice)}</div>
                  <div className="recent-sale-card__final">{formatTl(s.finalPrice)}</div>
                  <div className="recent-sale-card__ago">
                    {soldLabel(s.soldAt)} <span className="recent-sale-card__ok">ONAYLANDI</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
          <button
            type="button"
            className="recent-sales__nav recent-sales__nav--next"
            onClick={() => scrollBy(1)}
            aria-label="Sonraki"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
    </section>
  );
}
