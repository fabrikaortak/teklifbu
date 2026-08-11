"use client";

import Link from "next/link";
import { Heart, Play } from "lucide-react";
import { formatTl, remainingLabelCompact } from "@/lib/format";
import type { ListingCardData } from "@/components/ListingCard";
import { ListingThumbImg } from "@/components/ListingThumbImg";

const CAT_IMAGES: Record<string, string> = {
  elektronik:
    "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=600&q=80",
  "ev-aletleri":
    "https://images.unsplash.com/photo-1584568694244-14fbdf83bd30?auto=format&fit=crop&w=600&q=80",
  "ev-ve-yasam":
    "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=600&q=80",
  moda: "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=600&q=80",
  "spor-outdoor":
    "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=600&q=80",
  "mutfak-ve-sofra":
    "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?auto=format&fit=crop&w=600&q=80",
  "kozmetik-ve-kisisel-bakim":
    "https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=600&q=80",
  "anne-bebek-ve-cocuk":
    "https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?auto=format&fit=crop&w=600&q=80",
  default:
    "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=600&q=80",
};

export function catImageFor(id: string) {
  const key = id.replace(/^alisveris\//, "");
  return CAT_IMAGES[key] || CAT_IMAGES.default;
}

/** Mockup’taki büyük cam ürün kartı */
export function AlisverisFeaturedOfferCard({ listing }: { listing: ListingCardData | null }) {
  if (!listing) {
    return (
      <div className="tb-featured" aria-hidden>
        <div style={{ aspectRatio: "4/3", borderRadius: 20, background: "#e5e7eb" }} />
        <div className="tb-featured-title">Öne çıkan ürün yakında</div>
        <div className="tb-featured-prices">
          <div className="tb-featured-ask">Satıcı fiyatı</div>
          <div className="tb-featured-bid">
            <small>Teklif verebilirsin</small>
            —
          </div>
        </div>
      </div>
    );
  }

  const bids = Number(listing.bidCount || 0);
  const top = Number(listing.highestBid || 0);
  const showTop = top > 0;

  return (
    <Link href={`/ilan/${listing.id}`} className="tb-featured">
      <ListingThumbImg src={listing.coverImage} />
      <div className="tb-featured-title">{listing.title}</div>
      <div className="tb-featured-prices">
        <div className="tb-featured-ask">Satıcı fiyatı {formatTl(listing.askPrice)}</div>
        <div className="tb-featured-bid">
          <small>{showTop ? "Güncel en iyi teklif" : "Henüz teklif yok"}</small>
          {showTop ? formatTl(top) : "Teklif verebilirsin"}
        </div>
      </div>
      <div className="tb-featured-people">
        <div className="tb-avatars">
          <span />
          <span />
          <span />
        </div>
        {bids > 0 ? `${bids} kişi teklif verdi` : "İlk teklifi sen ver"}
      </div>
      <span className="tb-featured-cta">Teklifleri gör</span>
    </Link>
  );
}

export function AlisverisLiveOffersPanel({
  items,
  timeAgo,
}: {
  items: Array<{
    id: string;
    amount: number;
    createdAt: string;
    listing: { id: string; title: string; coverImage?: string | null; askPrice?: number };
  }>;
  timeAgo: (iso: string) => string;
}) {
  return (
    <div className="tb-live-panel">
      <h2>Canlı teklifler</h2>
      <div className="tb-live-list">
        {items.length === 0 && (
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", padding: 8 }}>
            Henüz canlı hareket yok.
          </div>
        )}
        {items.slice(0, 6).map((item) => (
          <Link key={item.id} href={`/ilan/${item.listing.id}`} className="tb-live-row">
            <ListingThumbImg src={item.listing.coverImage} />
            <div style={{ minWidth: 0 }}>
              <div className="t">{item.listing.title}</div>
              <div className="m">{timeAgo(item.createdAt)}</div>
            </div>
            <div className="bid">{formatTl(item.amount || item.listing.askPrice || 0)}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function AlisverisCategoryMosaic({
  categories,
  onSelect,
}: {
  categories: Array<{ id: string; name: string; category: string }>;
  onSelect: (category: string) => void;
}) {
  return (
    <section className="tb-sec">
      <div className="tb-sec-head">
        <h2>Kategoriler</h2>
        <a href="#kesfet">Tümünü gör</a>
      </div>
      <div className="tb-cat-grid">
        {categories.slice(0, 6).map((c) => (
          <button
            key={c.id}
            type="button"
            className="tb-cat-card"
            onClick={() => onSelect(c.category)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={catImageFor(c.id)} alt="" />
            <div className="veil" />
            <div className="body">
              <strong>{c.name}</strong>
              <span>Keşfet →</span>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

/** Mockup ürün kartı — teklif sayısı + güncel teklif (açık artırma dili değil) */
export function AlisverisOfferProductCard({
  listing,
  index = 0,
  variant = "grid",
}: {
  listing: ListingCardData;
  index?: number;
  variant?: "grid" | "list";
}) {
  const bids = Number(listing.bidCount || 0);
  const top = Number(listing.highestBid || 0);
  const offerLine =
    top > 0
      ? formatTl(top)
      : bids > 0
        ? `${bids} teklif geldi`
        : "Teklif verebilirsin";
  const isList = variant === "list";
  const isExpired = String(listing.status || "").toUpperCase() === "EXPIRED";
  const isSold = String(listing.status || "").toUpperCase() === "APPROVED";

  return (
    <Link
      href={`/ilan/${listing.id}`}
      className={`tb-pcard${isList ? " tb-pcard--list" : ""}${isExpired || isSold ? " tb-pcard--inactive" : ""}`}
      style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
    >
      <div className="tb-pcard-media">
        <ListingThumbImg src={listing.coverImage} />
        <span className="tb-pcard-heart" aria-hidden>
          <Heart size={15} />
        </span>
        {listing.endsAt || isExpired || isSold ? (
          <span className={`tb-pcard-time${isExpired || isSold ? " is-done" : ""}`}>
            {isSold ? "Sonuçlandı" : isExpired ? "Süre doldu" : remainingLabelCompact(listing.endsAt)}
          </span>
        ) : null}
      </div>
      <div className="tb-pcard-body">
        <div className="tb-pcard-title">{listing.title}</div>
        {isList ? (
          <div className="tb-pcard-list-meta">
            <span className="tb-pcard-bid-label">Satıcı {formatTl(listing.askPrice)}</span>
            <span className="tb-pcard-bid">{offerLine}</span>
            <span className="tb-pcard-count">
              {bids <= 0 ? "Teklif verebilirsin" : `${bids} teklif`}
            </span>
          </div>
        ) : (
          <>
            <div className="tb-pcard-bid-label">Satıcı {formatTl(listing.askPrice)}</div>
            <div className="tb-pcard-bid">{offerLine}</div>
            <div className="tb-pcard-count">
              {bids <= 0 ? "Teklif verebilirsin" : `${bids} teklif`}
            </div>
          </>
        )}
      </div>
    </Link>
  );
}

export function AlisverisHeroCtas({
  onBrowse,
}: {
  onBrowse: () => void;
}) {
  return (
    <div className="tb-hero-actions">
      <Link href="/ilan-ver" className="tb-btn tb-btn-orange">
        Hemen teklif ver
      </Link>
      <button type="button" className="tb-btn tb-btn-glass" onClick={onBrowse}>
        <Play size={14} fill="currentColor" />
        Nasıl çalışır?
      </button>
    </div>
  );
}
