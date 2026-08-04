"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Clock, Heart, MapPin } from "lucide-react";
import { formatTl, remainingLabel, remainingLabelCompact } from "@/lib/format";
import { formatListingNo } from "@/lib/listingNo";
import { dealTypeLabel } from "@/lib/dealType";
import { EidsBadge } from "@/components/EidsBadge";
import { formatPremiumTitle, isFeaturedHomepageActive, shouldShowPremiumBadge } from "@/lib/listingPremiumDisplay";
import { useTheme } from "@/components/ThemeProvider";

export type ListingCardData = {
  id: string;
  listingNo?: string | null;
  title: string;
  city: string;
  district?: string | null;
  neighborhood?: string | null;
  askPrice: number;
  highestBid: number;
  /** Onaylanan satış / teklif tutarı (status APPROVED) */
  finalPrice?: number | null;
  /** Satış − ilan fiyatı (kazanç) */
  profit?: number | null;
  bidCount: number;
  /** Bugünkü teklif sayısı (mostBids modu) */
  bidCountToday?: number;
  coverImage?: string | null;
  endsAt?: string | Date | null;
  createdAt?: string | Date | null;
  soldAt?: string | Date | null;
  dealType?: "SATILIK" | "KIRALIK" | string;
  status?: string;
  rejectionReason?: string | null;
  approvedBidId?: string | null;
  isFavorited?: boolean;
  isFeatured?: boolean;
  featuredUntil?: string | Date | null;
  featuredDays?: number | null;
  titleBold?: boolean;
  titleLarge?: boolean;
  isColored?: boolean;
  showPremiumBadge?: boolean;
  category?: { name: string; slug: string };
  eidsBadge?: string | null;
};

function FavHeart({ filled }: { filled: boolean }) {
  return (
    <Heart
      size={16}
      color="#ef4444"
      fill={filled ? "#ef4444" : "none"}
      strokeWidth={filled ? 1.5 : 2}
    />
  );
}

function listingTimeAgo(iso?: string | Date | null) {
  if (!iso) return "";
  const m = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (m < 3) return "az önce";
  if (m < 60) return `${m} dk önce`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} saat önce`;
  const d = Math.floor(h / 24);
  if (d === 1) return "1 gün önce";
  return `${d} gün önce`;
}

export function ListingCard({
  listing,
  variant = "grid",
  /** Ana sayfa: buton yok, kartın tamamı tıklanır */
  homeMode = false,
  /** Öne çıkan / vitrin bölümü — tema ayarı açıksa sadece başlık + fiyat */
  featuredSection = false,
  /** Sıralama rozeti (en çok teklif / kazanç) */
  rank,
  onFavoriteChange,
}: {
  listing: ListingCardData;
  variant?: "grid" | "row";
  homeMode?: boolean;
  featuredSection?: boolean;
  rank?: number;
  onFavoriteChange?: (listingId: string, favorited: boolean) => void;
}) {
  const { featuredCardTitlePriceOnly, offersEnabled } = useTheme();
  const titlePriceOnly = featuredSection && featuredCardTitlePriceOnly;
  const classified = !offersEnabled;
  const [favorited, setFavorited] = useState(Boolean(listing.isFavorited));

  useEffect(() => {
    setFavorited(Boolean(listing.isFavorited));
  }, [listing.id, listing.isFavorited]);

  async function toggleFavorite(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const res = await fetch("/api/favorites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listingId: listing.id }),
    });
    if (res.status === 401) {
      window.dispatchEvent(new CustomEvent("teklifbu:auth-required", { detail: { intent: "favorite" } }));
      return;
    }
    if (!res.ok) return;
    const data = await res.json().catch(() => ({}));
    const next = Boolean(data.favorited);
    setFavorited(next);
    onFavoriteChange?.(listing.id, next);
    window.dispatchEvent(new Event("teklifbu:favorites"));
  }

  const featuredActive = isFeaturedHomepageActive(listing);
  const isSold = listing.status === "APPROVED";
  const salePrice =
    listing.finalPrice != null && listing.finalPrice > 0
      ? listing.finalPrice
      : listing.highestBid || null;
  const showPremiumBadge =
    typeof listing.showPremiumBadge === "boolean"
      ? listing.showPremiumBadge
      : shouldShowPremiumBadge(listing, "premium_3");
  const displayTitle = formatPremiumTitle(listing.title, listing);
  const v2Title = (listing.title || "").toLocaleUpperCase("tr-TR");
  const titleClass = [
    "listing-card-title",
    listing.titleBold ? "is-title-bold" : "",
    listing.titleLarge ? "is-title-large" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const rowTitleClass = [
    "listing-row-title",
    listing.titleBold ? "is-title-bold" : "",
    listing.titleLarge ? "is-title-large" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const cardClass = [
    "card",
    "listing-card",
    listing.isColored ? "is-colored" : "",
    featuredActive ? "is-featured" : "",
    titlePriceOnly ? "listing-card--title-price" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const locationText =
    [listing.district, listing.city].filter(Boolean).join(", ") || listing.city || "";
  const ago = listingTimeAgo(listing.createdAt);
  const metaLine = classified
    ? ago || ""
    : `${formatTlBids(listing.bidCount)}${ago ? ` • ${ago}` : ""}`;
  const hideTimers = classified || titlePriceOnly;

  if (variant === "row") {
    return (
      <article
        className={[
          "card",
          "listing-row",
          homeMode ? "listing-card-clickable listing-card-home" : "",
          titlePriceOnly ? "listing-card--title-price" : "",
          rank ? "has-rank" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        style={{ position: homeMode || rank ? "relative" : undefined }}
      >
        {homeMode ? (
          <Link
            href={`/ilan/${listing.id}`}
            className="listing-card-hit"
            aria-label={listing.title || "İlanı görüntüle"}
          />
        ) : null}
        {homeMode ? (
          <div className="listing-row-media">
            {listing.coverImage && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={listing.coverImage} alt="" loading="lazy" />
            )}
            {!hideTimers ? (
              <span className="badge-time listing-row-time">
                {isSold ? "Sonuçlandı" : remainingLabel(listing.endsAt)}
              </span>
            ) : null}
          </div>
        ) : (
          <Link href={`/ilan/${listing.id}`} className="listing-row-media">
            {listing.coverImage && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={listing.coverImage} alt={listing.title} loading="lazy" />
            )}
            {!hideTimers ? (
              <span className="badge-time listing-row-time">
                {isSold ? "Sonuçlandı" : remainingLabel(listing.endsAt)}
              </span>
            ) : null}
          </Link>
        )}

        <div className="listing-row-body">
          <div className="listing-row-top">
            <div style={{ minWidth: 0, flex: 1 }}>
              {!titlePriceOnly ? (
                <div className="listing-row-cat">
                  {listing.category?.name || "İlan"} / {dealTypeLabel(listing.dealType)}
                  {isSold ? " · Sonuçlandı" : ""}
                  {listing.listingNo ? ` · No: ${formatListingNo(listing.listingNo)}` : ""}
                </div>
              ) : null}
              {homeMode ? (
                <div className={rowTitleClass}>{displayTitle}</div>
              ) : (
                <Link href={`/ilan/${listing.id}`} className={rowTitleClass}>
                  {displayTitle}
                </Link>
              )}
              {!titlePriceOnly ? (
                <>
                  <div className="listing-row-loc">
                    <MapPin size={14} />
                    {[listing.neighborhood, listing.district, listing.city].filter(Boolean).join(", ")}
                  </div>
                  <EidsBadge text={listing.eidsBadge} />
                </>
              ) : null}
            </div>
            <button
              type="button"
              className={`listing-fav-btn listing-row-fav${favorited ? " is-fav" : ""}`}
              aria-label={favorited ? "Favorilerden çıkar" : "Favorilere ekle"}
              aria-pressed={favorited}
              onClick={toggleFavorite}
            >
              <FavHeart filled={favorited} />
            </button>
          </div>

          <div className="listing-row-bottom">
            {titlePriceOnly ? (
              <div className="listing-row-prices">
                <div>
                  <strong className="price-ask">{formatTl(isSold && salePrice ? salePrice : listing.askPrice)}</strong>
                </div>
              </div>
            ) : (
              <div className="listing-row-prices">
                <div>
                  <span className="listing-row-label">İlan Fiyatı</span>
                  <strong className="price-ask">{formatTl(listing.askPrice)}</strong>
                </div>
                {!classified ? (
                <div>
                  <span className="listing-row-label">{isSold ? "Satış Fiyatı" : "Piyasa Fiyatı"}</span>
                  <strong className={isSold ? "price-final" : "price-bid"}>
                    {isSold
                      ? salePrice
                        ? formatTl(salePrice)
                        : "—"
                      : listing.highestBid
                        ? formatTl(listing.highestBid)
                        : "—"}
                  </strong>
                </div>
                ) : null}
                {!classified && listing.profit != null && listing.profit > 0 ? (
                  <div>
                    <span className="listing-row-label">Kazanç</span>
                    <strong className="price-final">+{formatTl(listing.profit)}</strong>
                  </div>
                ) : !classified ? (
                  <div>
                    <span className="listing-row-label">Teklif</span>
                    <strong style={{ color: "#0f172a" }}>{listing.bidCount}</strong>
                  </div>
                ) : null}
              </div>
            )}
            {!homeMode && !titlePriceOnly && !classified ? (
              isSold ? (
                <span className="btn-sonuclandi listing-row-cta" aria-label="Sonuçlandı">
                  Sonuçlandı
                </span>
              ) : (
                <Link href={`/ilan/${listing.id}`} className="btn-teklifbu listing-row-cta">
                  TeklifBu
                </Link>
              )
            ) : null}
          </div>
          {rank ? <span className="listing-rank-badge">{rank}</span> : null}
        </div>
      </article>
    );
  }

  const timeText = isSold ? "Sonuçlandı" : remainingLabelCompact(listing.endsAt);

  return (
    <article
      className={[
        cardClass,
        homeMode ? "listing-card-clickable listing-card-home" : "",
        rank ? "has-rank" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        height: "100%",
        position: homeMode || rank ? "relative" : undefined,
      }}
    >
      {rank ? <span className="listing-rank-badge">{rank}</span> : null}
      {homeMode ? (
        <Link
          href={`/ilan/${listing.id}`}
          className="listing-card-hit"
          aria-label={listing.title || "İlanı görüntüle"}
        />
      ) : null}
      <div className="listing-card-media">
        {listing.coverImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={listing.coverImage} alt={homeMode ? "" : listing.title} loading="lazy" />
        )}
        {!titlePriceOnly && showPremiumBadge ? <span className="v2-only badge-premium">Premium</span> : null}
        {!hideTimers ? (
          <>
            <div className="badge-time v1-only" style={{ position: "absolute", left: 10, top: 10 }}>
              {isSold ? "Sonuçlandı" : remainingLabel(listing.endsAt)}
            </div>
            <div className="badge-time v2-only">
              <Clock size={12} strokeWidth={2.25} aria-hidden />
              <span>{timeText}</span>
            </div>
          </>
        ) : null}
        <button
          type="button"
          onClick={toggleFavorite}
          className={`listing-fav-btn${favorited ? " is-fav" : ""}`}
          aria-label={favorited ? "Favorilerden çıkar" : "Favorilere ekle"}
          aria-pressed={favorited}
        >
          <FavHeart filled={favorited} />
        </button>
      </div>
      <div className="listing-card-body">
        {titlePriceOnly ? (
          <>
            {homeMode ? (
              <>
                <div className={`${titleClass} v1-only`}>{displayTitle}</div>
                <div className={`${titleClass} v2-only is-title-bold`}>{v2Title}</div>
              </>
            ) : (
              <>
                <Link href={`/ilan/${listing.id}`} className={`${titleClass} v1-only`}>
                  {displayTitle}
                </Link>
                <Link href={`/ilan/${listing.id}`} className={`${titleClass} v2-only is-title-bold`}>
                  {v2Title}
                </Link>
              </>
            )}
            <div className="listing-card-title-price">
              <strong className={`price-ask listing-price-ask${isSold ? " price-final" : ""}`}>
                {formatTl(isSold && salePrice ? salePrice : listing.askPrice)}
              </strong>
            </div>
          </>
        ) : (
          <>
            <div className="v1-only" style={{ fontSize: 12, color: "var(--muted)", fontWeight: 500 }}>
              {listing.category?.name || "İlan"} / {dealTypeLabel(listing.dealType)}
              {isSold ? " · Sonuçlandı" : ""}
              {listing.listingNo ? ` · No: ${formatListingNo(listing.listingNo)}` : ""}
            </div>
            {homeMode ? (
              <>
                <div className={`${titleClass} v1-only`}>{displayTitle}</div>
                <div className={`${titleClass} v2-only is-title-bold`}>{v2Title}</div>
              </>
            ) : (
              <>
                <Link href={`/ilan/${listing.id}`} className={`${titleClass} v1-only`}>
                  {displayTitle}
                </Link>
                <Link href={`/ilan/${listing.id}`} className={`${titleClass} v2-only is-title-bold`}>
                  {v2Title}
                </Link>
              </>
            )}
            <div className="v2-only listing-card-loc listing-card-loc-plain">
              <span>{locationText || "—"}</span>
            </div>
            <div className="v2-only listing-price-grid">
              <div className="listing-price-col">
                <span className="listing-price-label">İlan Fiyatı</span>
                <strong className="listing-price-ask">{formatTl(listing.askPrice)}</strong>
              </div>
              {!classified ? (
              <div className="listing-price-col">
                <span className="listing-price-label">{isSold ? "Satış Fiyatı" : "Piyasa Fiyatı"}</span>
                <strong className={isSold ? "listing-price-final" : "listing-price-market"}>
                  {isSold
                    ? salePrice
                      ? formatTl(salePrice)
                      : "—"
                    : listing.highestBid
                      ? formatTl(listing.highestBid)
                      : "—"}
                </strong>
              </div>
              ) : null}
              {!classified && listing.profit != null && listing.profit > 0 ? (
                <div className="listing-price-col">
                  <span className="listing-price-label">Kazanç</span>
                  <strong className="listing-price-final">+{formatTl(listing.profit)}</strong>
                </div>
              ) : null}
            </div>
            {!classified && metaLine ? <div className="v2-only listing-card-stats">{metaLine}</div> : null}
            {classified && ago ? <div className="v2-only listing-card-stats">{ago}</div> : null}
            {!homeMode && !classified ? (
              isSold ? (
                <span className="btn-sonuclandi v2-only" aria-label="Sonuçlandı">
                  Sonuçlandı
                </span>
              ) : (
                <Link href={`/ilan/${listing.id}`} className="btn-teklifbu v2-only">
                  TeklifBu
                </Link>
              )
            ) : null}
            <div className="v1-only" style={{ fontSize: 13, color: "var(--muted)", fontWeight: 500 }}>
              {[listing.neighborhood, listing.district, listing.city].filter(Boolean).join(", ")}
            </div>
            <div className="v1-only">
              <EidsBadge text={listing.eidsBadge} />
            </div>
            <div className="v1-only" style={{ display: "grid", gap: 5, marginTop: 2, fontSize: 13 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 6, alignItems: "baseline" }}>
                <span style={{ color: "var(--muted)" }}>İlan Fiyatı</span>
                <span className="price-ask">{formatTl(listing.askPrice)}</span>
              </div>
              {!classified ? (
              <div style={{ display: "flex", justifyContent: "space-between", gap: 6, alignItems: "baseline" }}>
                <span style={{ color: "var(--muted)" }}>{isSold ? "Satış Fiyatı" : "Piyasa Fiyatı"}</span>
                <span className={isSold ? "price-final" : "price-bid"}>
                  {isSold
                    ? salePrice
                      ? formatTl(salePrice)
                      : "—"
                    : listing.highestBid
                      ? formatTl(listing.highestBid)
                      : "—"}
                </span>
              </div>
              ) : null}
              {!classified ? (
              <div style={{ display: "flex", justifyContent: "space-between", gap: 6, alignItems: "baseline" }}>
                <span style={{ color: "var(--muted)" }}>Teklif Sayısı</span>
                <span style={{ fontWeight: 700, color: "#0f172a" }}>{listing.bidCount}</span>
              </div>
              ) : null}
            </div>
            {!homeMode && !classified ? (
              isSold ? (
                <span className="btn-sonuclandi v1-only" aria-label="Sonuçlandı">
                  Sonuçlandı
                </span>
              ) : (
                <Link href={`/ilan/${listing.id}?tab=teklifler`} className="btn-teklifleri-gor v1-only">
                  Teklifleri Gör
                </Link>
              )
            ) : null}
          </>
        )}
      </div>
    </article>
  );
}

function formatTlBids(n: number) {
  const count = Number(n) || 0;
  return `${count.toLocaleString("tr-TR")} teklif`;
}
