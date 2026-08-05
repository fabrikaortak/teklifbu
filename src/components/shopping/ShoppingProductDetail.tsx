"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BadgeCheck,
  Bot,
  ChevronLeft,
  ChevronRight,
  Crown,
  GitCompare,
  Heart,
  Maximize2,
  Package,
  RotateCcw,
  Share2,
  ShieldCheck,
  Truck,
  Headphones,
  Lock,
  MessageCircle,
  Video,
  Box,
  ShoppingCart,
} from "lucide-react";
import { formatTl } from "@/lib/format";
import {
  parseHighlights,
  parseNumAttr,
  parseInstallments,
  calcInstallmentAmounts,
  shoppingDiscountPercent,
  shoppingSocialProof,
  shoppingSalePriceTl,
} from "@/data/shoppingProductAttrs";
import { ListingDescriptionHtml } from "@/components/ListingDescriptionHtml";
import { ListingQuestionsBlock } from "@/components/ListingQuestionsBlock";
import {
  PremiumStoreInfoModal,
  type PremiumStorePopupConfig,
} from "@/components/shopping/PremiumStoreInfoModal";
import { useCart, useRegisterShoppingSurface } from "@/components/cart/CartProvider";
import { PriceWithKurus } from "@/components/shopping/PriceWithKurus";

export type ShoppingPdpListing = {
  id: string;
  title: string;
  description: string;
  askPrice: number;
  coverImage?: string | null;
  images: string[];
  attributes?: Record<string, unknown> | null;
  seller: {
    id: string;
    name: string | null;
    commercialTitle?: string | null;
    isCommercial?: boolean;
    logoUrl?: string | null;
    shopId?: string | null;
    shopName?: string | null;
    avgRating?: number | null;
    reviewCount?: number;
    stats?: {
      totalListings?: number;
      successfulSales?: number;
      bidAcceptanceRate?: number | null;
    } | null;
    isPremiumSeller?: boolean;
    showPremiumBadge?: boolean;
    showPremiumStoreBadge?: boolean;
  };
  escrowAvailable?: boolean;
  escrowSettings?: { buttonLabel?: string } | null;
};

type Crumb = { label: string; href: string };

type Spec = { label: string; value: string };

type Props = {
  listing: ShoppingPdpListing;
  crumbs: Crumb[];
  specs: Spec[];
  favorited: boolean;
  isSeller: boolean;
  onFavorite: () => void;
  onShare?: () => void;
  onBuy: () => void;
  onOffer?: () => void;
  onSubmitOffer?: (amountTl: number) => boolean | void | Promise<boolean | void>;
  onAddCart?: () => void;
  buyDisabled?: boolean;
  offerDisabled?: boolean;
  offerBusy?: boolean;
  buyLabel?: string;
  offerLabel?: string;
  cartLabel?: string;
  statusBanner?: ReactNode;
  afterActions?: ReactNode;
};

const DEMO_BUYERS = [
  { name: "Mehmet Y.", city: "İstanbul", when: "2 dakika önce" },
  { name: "Ayşe K.", city: "Ankara", when: "18 dakika önce" },
  { name: "Can D.", city: "İzmir", when: "1 saat önce" },
  { name: "Elif S.", city: "Bursa", when: "3 saat önce" },
];

function starsLabel(avg: number) {
  const full = Math.max(0, Math.min(5, Math.round(avg)));
  return "★".repeat(full) + "☆".repeat(5 - full);
}

export function ShoppingProductDetail({
  listing,
  crumbs,
  specs,
  favorited,
  isSeller,
  onFavorite,
  onShare,
  onBuy,
  onOffer,
  onSubmitOffer,
  onAddCart,
  buyDisabled,
  offerDisabled,
  offerBusy,
  buyLabel = "Hemen Al",
  offerLabel = "Teklif Ver",
  cartLabel = "Sepete Ekle",
  statusBanner,
  afterActions,
}: Props) {
  useRegisterShoppingSurface(true);
  const { addItem } = useCart();
  const router = useRouter();
  const images = useMemo(() => {
    const list = listing.images?.length
      ? listing.images
      : listing.coverImage
        ? [listing.coverImage]
        : [];
    return list;
  }, [listing]);

  const attrs = (listing.attributes || {}) as Record<string, unknown>;
  const [imageIdx, setImageIdx] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const [offerFormOpen, setOfferFormOpen] = useState(false);
  const [offerWhole, setOfferWhole] = useState("");
  const [offerKurus, setOfferKurus] = useState(0);
  const [offerLocalError, setOfferLocalError] = useState("");
  const [premiumPopupOpen, setPremiumPopupOpen] = useState(false);
  const [premiumPopup, setPremiumPopup] = useState<PremiumStorePopupConfig>({
    enabled: true,
    title: "Premium Mağaza nedir?",
    body: "",
    applyEnabled: true,
    applyLabel: "Başvur",
    applyUrl: "/hesabim?s=magaza",
  });

  const [detailTab, setDetailTab] = useState<"specs" | "desc" | "qa" | "reviews" | "shipping">("specs");
  const [buyButtonColor, setBuyButtonColor] = useState("#2563eb");

  useEffect(() => {
    fetch("/api/theme")
      .then((r) => r.json())
      .then((d) => {
        const c = String(d?.shoppingBuyButtonColor || "").trim();
        if (/^#[0-9a-fA-F]{6}$/.test(c)) setBuyButtonColor(c);
        const p = d?.premiumStorePopup;
        if (!p || typeof p !== "object") return;
        setPremiumPopup({
          enabled: p.enabled !== false,
          title: String(p.title || "Premium Mağaza nedir?"),
          body: String(p.body || ""),
          applyEnabled: p.applyEnabled !== false,
          applyLabel: String(p.applyLabel || "Başvur"),
          applyUrl: String(p.applyUrl || "/hesabim?s=magaza"),
        });
      })
      .catch(() => {});
  }, []);

  function openPremiumPopup() {
    if (!premiumPopup.enabled) return;
    setPremiumPopupOpen(true);
  }

  function applyPremiumPopup() {
    setPremiumPopupOpen(false);
    const url = premiumPopup.applyUrl || "/hesabim?s=magaza";
    if (url.startsWith("http://") || url.startsWith("https://")) {
      window.location.assign(url);
      return;
    }
    router.push(url);
  }

  const listPrice = parseNumAttr(attrs.listPrice);
  const premiumPrice = parseNumAttr(attrs.premiumPrice);
  const stockQty = parseNumAttr(attrs.stockQty);
  const salePrice = shoppingSalePriceTl({ askPrice: listing.askPrice, attributes: attrs });
  const disc = shoppingDiscountPercent(listPrice, salePrice);
  const save = listPrice && listPrice > salePrice ? Math.round((listPrice - salePrice) * 100) / 100 : null;
  const highlights = parseHighlights(attrs.highlights);
  const social = shoppingSocialProof(listing.id);
  const badgeText = String(attrs.badgeText || "").trim() || (listing.seller.isPremiumSeller ? "PREMIUM" : "EN ÇOK SATAN");
  const shippingLabel = String(attrs.shippingLabel || "").trim() || "Yarın Kapında";
  const freeShip = String(attrs.shippingFree || "").toLowerCase() === "evet" || attrs.shippingFree === true;
  const sameDay = String(attrs.sameDayShipping || "").toLowerCase() === "evet" || attrs.sameDayShipping === true;
  const videoUrl = String(attrs.videoUrl || "").trim();
  const view360 = String(attrs.viewAngle360 || "").trim();
  const installmentNote = String(attrs.installmentNote || "").trim();
  const returnDays = parseNumAttr(attrs.returnDays) || 14;

  const storeName =
    listing.seller.shopName ||
    listing.seller.commercialTitle ||
    listing.seller.name ||
    "Mağaza";
  const storeHref = listing.seller.shopId
    ? `/satici/${listing.seller.shopId}`
    : `/satici/${listing.seller.id}`;
  const rating = listing.seller.avgRating != null ? Number(listing.seller.avgRating) : 4.8;
  const reviewCount = listing.seller.reviewCount || 0;
  const acceptance = listing.seller.stats?.bidAcceptanceRate;
  const positivePct =
    acceptance != null
      ? (acceptance * (acceptance <= 1 ? 100 : 1)).toFixed(1)
      : "98.7";
  /** Mağaza puanı rozeti (Trendyol tarzı 0–10) */
  const storeScore = Math.min(10, Math.max(0, rating <= 5 ? rating * 2 : rating)).toFixed(1).replace(".", ",");

  const installmentPlans = useMemo(() => parseInstallments(attrs.installments), [attrs.installments]);

  const stockPct =
    stockQty != null && stockQty > 0 ? Math.max(8, Math.min(100, (stockQty / 50) * 100)) : null;

  const installmentRows = useMemo(() => {
    if (installmentPlans.length) {
      return installmentPlans.map((p) => {
        const calc = calcInstallmentAmounts(salePrice, p.months, p.ratePercent);
        return {
          card: p.card,
          months: calc.months,
          monthly: calc.monthly,
          total: calc.total,
          ratePercent: p.ratePercent,
        };
      });
    }
    if (installmentNote) {
      return installmentNote
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean)
        .map((line) => {
          const [left, right] = line.split("|").map((s) => s.trim());
          return {
            card: left || line,
            months: 0,
            monthly: 0,
            total: 0,
            ratePercent: 0,
            legacyRight: right || "",
          };
        });
    }
    const base = salePrice;
    return [
      { card: "Tüm kartlar", months: 1, monthly: base, total: base, ratePercent: 0 },
      {
        card: "World",
        months: 3,
        monthly: calcInstallmentAmounts(base, 3, 0).monthly,
        total: calcInstallmentAmounts(base, 3, 0).total,
        ratePercent: 0,
      },
      {
        card: "Bonus",
        months: 6,
        monthly: calcInstallmentAmounts(base, 6, 4.5).monthly,
        total: calcInstallmentAmounts(base, 6, 4.5).total,
        ratePercent: 4.5,
      },
    ];
  }, [installmentPlans, installmentNote, salePrice]);

  const otherSellers = useMemo(() => {
    const base = salePrice;
    return [
      { name: "BRITA Türkiye", score: "9,5", price: Math.round(base * 1.13), freeShip: true },
      { name: "Evimizden", score: "9,1", price: Math.round(base * 1.08), freeShip: true },
      { name: "Su Market", score: "8,7", price: Math.round(base * 1.05), freeShip: false },
    ];
  }, [salePrice]);

  const premiumDiscountTl =
    premiumPrice != null && premiumPrice > 0 && premiumPrice < salePrice
      ? Math.round(salePrice - premiumPrice)
      : null;

  function prev() {
    if (!images.length) return;
    setImageIdx((i) => (i - 1 + images.length) % images.length);
  }
  function next() {
    if (!images.length) return;
    setImageIdx((i) => (i + 1) % images.length);
  }

  const showPremiumStore =
    Boolean(listing.seller.isPremiumSeller) &&
    listing.seller.showPremiumBadge !== false &&
    listing.seller.showPremiumStoreBadge !== false;

  return (
    <div className="shop-pdp" style={{ ["--shop-buy" as string]: buyButtonColor }}>
      <div className="shop-pdp__topbar">
        <nav className="shop-pdp__crumbs" aria-label="Breadcrumb">
          <Link href="/">Ana Sayfa</Link>
          {crumbs.map((c) => (
            <span key={`${c.href}-${c.label}`} style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
              <span>›</span>
              <Link href={c.href}>{c.label}</Link>
            </span>
          ))}
          <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
            <span>›</span>
            <span style={{ color: "#0f172a", fontWeight: 700 }}>{listing.title.slice(0, 48)}{listing.title.length > 48 ? "…" : ""}</span>
          </span>
        </nav>
        <div className="shop-pdp__side-actions">
          <button
            type="button"
            className="shop-pdp__side-action-btn"
            onClick={onFavorite}
            aria-label="Favori"
            title="Favori"
          >
            <Heart size={18} color="#ef4444" fill={favorited ? "#ef4444" : "none"} strokeWidth={2} />
          </button>
          <button
            type="button"
            className="shop-pdp__side-action-btn"
            aria-label="Karşılaştır"
            title="Karşılaştır"
            disabled
          >
            <GitCompare size={18} strokeWidth={2} />
          </button>
          <button
            type="button"
            className="shop-pdp__side-action-btn"
            onClick={onShare}
            aria-label="Paylaş"
            title="Paylaş"
          >
            <Share2 size={18} strokeWidth={2} />
          </button>
        </div>
      </div>

      {statusBanner}

      <div className="shop-pdp__grid">
        {/* LEFT — gallery + social */}
        <div>
          <div className="shop-pdp__gallery">
            <div className="shop-pdp__main-img">
              {badgeText ? <div className="shop-pdp__badge">{badgeText}</div> : null}
              {images[imageIdx] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={images[imageIdx]} alt={listing.title} />
              ) : (
                <span style={{ color: "#94a3b8", fontWeight: 700 }}>Görsel yok</span>
              )}
              {images.length > 1 && (
                <>
                  <button type="button" className="shop-pdp__nav shop-pdp__nav--prev" onClick={prev} aria-label="Önceki">
                    <ChevronLeft size={18} />
                  </button>
                  <button type="button" className="shop-pdp__nav shop-pdp__nav--next" onClick={next} aria-label="Sonraki">
                    <ChevronRight size={18} />
                  </button>
                </>
              )}
              {images.length > 0 && (
                <button type="button" className="shop-pdp__zoom" onClick={() => setLightbox(true)}>
                  <Maximize2 size={14} /> Büyüt
                </button>
              )}
            </div>
            <div className="shop-pdp__thumbs">
              {images.map((src, i) => (
                <button
                  key={src + i}
                  type="button"
                  className={`shop-pdp__thumb${i === imageIdx ? " is-active" : ""}`}
                  onClick={() => setImageIdx(i)}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" />
                </button>
              ))}
              {videoUrl ? (
                <a className="shop-pdp__thumb" href={videoUrl} target="_blank" rel="noreferrer" title="Video">
                  <Video size={18} />
                </a>
              ) : null}
              {view360 ? (
                <a className="shop-pdp__thumb" href={view360} target="_blank" rel="noreferrer" title="360°">
                  <Box size={18} />
                </a>
              ) : null}
            </div>
          </div>

          <div className="shop-pdp__views">
            <div className="shop-pdp__avatars" aria-hidden>
              <span style={{ background: "linear-gradient(135deg,#fb923c,#ea580c)" }} />
              <span style={{ background: "linear-gradient(135deg,#60a5fa,#2563eb)" }} />
              <span style={{ background: "linear-gradient(135deg,#34d399,#059669)" }} />
            </div>
            <div>
              Bu ürünü son 24 saatte <strong>{social.views24h}</strong> kişi görüntüledi
            </div>
          </div>

          <div className="shop-pdp__buyers">
            <h3>Son satın alanlar</h3>
            <ul>
              {DEMO_BUYERS.map((b) => (
                <li key={b.name + b.when}>
                  <span>
                    <strong style={{ color: "#0f172a" }}>{b.name}</strong> — {b.city} — {b.when} satın aldı
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* MID — product info */}
        <div className="shop-pdp__mid">
          <h1 className="shop-pdp__title">{listing.title}</h1>

          <div className="shop-pdp__rating">
            <span className="shop-pdp__stars">{starsLabel(rating)}</span>
            <strong style={{ color: "#0f172a" }}>{rating.toFixed(1)}</strong>
            <a
              href="#shop-pdp-panels"
              onClick={(e) => {
                e.preventDefault();
                setDetailTab("reviews");
                document.getElementById("shop-pdp-panels")?.scrollIntoView({ behavior: "smooth" });
              }}
            >
              {reviewCount || "—"} değerlendirme
            </a>
            <a
              href="#shop-pdp-panels"
              onClick={(e) => {
                e.preventDefault();
                setDetailTab("qa");
                document.getElementById("shop-pdp-panels")?.scrollIntoView({ behavior: "smooth" });
              }}
            >
              Soru & cevap
            </a>
          </div>

          <div className="shop-pdp__price-box">
            {disc != null ? <div className="shop-pdp__disc">%{disc} İNDİRİM</div> : null}
            {listPrice != null && listPrice > salePrice ? (
              <div className="shop-pdp__list-price">
                <PriceWithKurus value={listPrice} muted />
              </div>
            ) : null}
            <div className="shop-pdp__sale-price">
              <PriceWithKurus value={salePrice} />
            </div>
            {save != null ? (
              <div className="shop-pdp__save">
                Kazancınız: <PriceWithKurus value={save} />
              </div>
            ) : null}
          </div>

          <div className="shop-pdp__trust">
            <div className="shop-pdp__trust-item">
              <BadgeCheck size={18} />
              Orijinal Ürün
            </div>
            <div className="shop-pdp__trust-item">
              <Truck size={18} />
              {sameDay ? "Aynı Gün Kargo" : "Hızlı Kargo"}
            </div>
            <div className="shop-pdp__trust-item">
              <RotateCcw size={18} />
              Kolay {returnDays} Gün İade
            </div>
            <div className="shop-pdp__trust-item">
              <Lock size={18} />
              Güvenli Ödeme
            </div>
          </div>

          {highlights.length > 0 && (
            <div className="shop-pdp__highlights">
              <ul>
                {highlights.slice(0, 6).map((h) => (
                  <li key={h}>{h}</li>
                ))}
              </ul>
              <a
                href="#shop-pdp-panels"
                onClick={(e) => {
                  e.preventDefault();
                  setDetailTab("specs");
                  document.getElementById("shop-pdp-panels")?.scrollIntoView({ behavior: "smooth" });
                }}
              >
                Tüm özellikler
              </a>
            </div>
          )}

          <div className="shop-pdp__ship">
            <Truck size={18} color="#16a34a" />
            <span>{shippingLabel}</span>
            {freeShip ? <span className="shop-pdp__ship-tag">ÜCRETSİZ KARGO</span> : null}
          </div>

          {stockQty != null && stockQty > 0 && (
            <div className="shop-pdp__stock">
              <div className="shop-pdp__stock-label">Son {stockQty} adet kaldı!</div>
              <div className="shop-pdp__stock-bar">
                <span style={{ width: `${stockPct}%` }} />
              </div>
              <div className="shop-pdp__stock-note">
                Bugün {social.cartToday} kişi sepete ekledi
              </div>
            </div>
          )}

          {!isSeller && !offerFormOpen && (
            <div className="shop-pdp__actions-wrap">
              <div className="shop-pdp__actions shop-pdp__actions--dual">
                <button
                  type="button"
                  className="shop-pdp__btn-offer"
                  onClick={() => {
                    if (offerDisabled || buyDisabled) return;
                    const base = Math.max(0, salePrice);
                    const whole = Math.trunc(base);
                    const kurus = Math.round((base - whole) * 100);
                    setOfferWhole(whole > 0 ? String(whole) : "");
                    setOfferKurus(Math.min(99, Math.max(0, kurus)));
                    setOfferLocalError("");
                    setOfferFormOpen(true);
                    onOffer?.();
                  }}
                  disabled={buyDisabled || offerDisabled}
                  title={offerDisabled ? "Bu ürün için teklif kabulü kapalı" : undefined}
                >
                  {offerLabel}
                </button>
                <button type="button" className="shop-pdp__btn-buy" onClick={onBuy} disabled={buyDisabled}>
                  {buyLabel}
                </button>
              </div>
              <button
                type="button"
                className="shop-pdp__btn-cart shop-pdp__btn-cart--full"
                disabled={buyDisabled}
                onClick={() => {
                  if (onAddCart) {
                    onAddCart();
                    return;
                  }
                  addItem({
                    listingId: listing.id,
                    title: listing.title,
                    price: salePrice,
                    image: images[0] || listing.coverImage || null,
                  });
                }}
              >
                <ShoppingCart size={18} strokeWidth={2.25} />
                {cartLabel}
              </button>
            </div>
          )}

          {!isSeller && offerFormOpen && (
            <div className="shop-pdp__offer-card">
              <div className="shop-pdp__offer-card-head">
                <strong>Teklif ver</strong>
                <button
                  type="button"
                  className="shop-pdp__offer-cancel"
                  onClick={() => {
                    setOfferFormOpen(false);
                    setOfferLocalError("");
                  }}
                >
                  Vazgeç
                </button>
              </div>
              <label className="shop-pdp__offer-label">Teklif fiyatı</label>
              <div className="shop-pdp__offer-price">
                <input
                  className="shop-pdp__offer-whole"
                  inputMode="numeric"
                  value={offerWhole}
                  onChange={(e) => setOfferWhole(e.target.value.replace(/[^\d]/g, "").replace(/^0+(?=\d)/, ""))}
                  placeholder="0"
                  aria-label="Teklif tutarı (TL)"
                />
                <span className="shop-pdp__offer-comma" aria-hidden>
                  ,
                </span>
                <select
                  className="shop-pdp__offer-kurus"
                  value={offerKurus}
                  onChange={(e) => setOfferKurus(Number(e.target.value) || 0)}
                  aria-label="Kuruş"
                >
                  {Array.from({ length: 100 }, (_, i) => (
                    <option key={i} value={i}>
                      {String(i).padStart(2, "0")}
                    </option>
                  ))}
                </select>
                <span className="shop-pdp__offer-tl">TL</span>
              </div>
              <p className="shop-pdp__offer-note">
                Teklifiniz kabul edilirse bildirime ödeme linkiniz Güvenli Ödeme olarak gönderilecek.
              </p>
              {offerLocalError ? <div className="shop-pdp__offer-error">{offerLocalError}</div> : null}
              <button
                type="button"
                className="shop-pdp__offer-submit"
                disabled={Boolean(offerBusy)}
                onClick={async () => {
                  const whole = Number(offerWhole || 0);
                  if (!Number.isFinite(whole) || whole <= 0) {
                    setOfferLocalError("Geçerli bir teklif tutarı girin");
                    return;
                  }
                  const amount = Math.round((whole + offerKurus / 100) * 100) / 100;
                  setOfferLocalError("");
                  if (onSubmitOffer) {
                    const ok = await onSubmitOffer(amount);
                    if (ok !== false) setOfferFormOpen(false);
                    return;
                  }
                  onOffer?.();
                }}
              >
                {offerBusy ? "Gönderiliyor…" : "Teklifi Gönder"}
              </button>
            </div>
          )}

          {afterActions}

          <div className="shop-pdp__ai">
            <div className="shop-pdp__ai-head">
              <Bot size={20} />
              Yapay Zeka Ürün Danışmanı <span>BETA</span>
            </div>
            <div style={{ fontSize: 12.5, opacity: 0.85, lineHeight: 1.4 }}>
              Ürün hakkında hızlı cevap alın — filtre uyumu, kargo süresi, iade koşulları.
            </div>
            <div className="shop-pdp__ai-chips">
              <button
                type="button"
                onClick={() => {
                  setDetailTab("qa");
                  document.getElementById("shop-pdp-panels")?.scrollIntoView({ behavior: "smooth" });
                }}
              >
                Filtre ne sıklıkla değişmeli?
              </button>
              <button
                type="button"
                onClick={() => {
                  setDetailTab("shipping");
                  document.getElementById("shop-pdp-panels")?.scrollIntoView({ behavior: "smooth" });
                }}
              >
                Kargo ne zaman gelir?
              </button>
              <button
                type="button"
                onClick={() => {
                  setDetailTab("shipping");
                  document.getElementById("shop-pdp-panels")?.scrollIntoView({ behavior: "smooth" });
                }}
              >
                İade nasıl yapılır?
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT — satıcı + güvence + premium + taksit + diğer satıcılar */}
        <aside className="shop-pdp__aside">
          <div className={`shop-pdp__side-seller-wrap${showPremiumStore ? " shop-pdp__side-seller-wrap--premium" : ""}`}>
            {showPremiumStore ? (
              <button
                type="button"
                className="shop-pdp__premium-emblem"
                title="Premium Mağaza"
                aria-label="Premium Mağaza bilgisi"
                onClick={openPremiumPopup}
              >
                <Crown size={12} strokeWidth={2.5} />
                <span>
                  Premium
                  <em>Mağaza</em>
                </span>
              </button>
            ) : null}
            <div className={`shop-pdp__side-seller${showPremiumStore ? " shop-pdp__side-seller--premium" : ""}`}>
              <div className="shop-pdp__side-seller-body">
                <div className="shop-pdp__side-seller-top">
                  <div className="shop-pdp__side-seller-name">
                    Satıcı: <strong>{storeName}</strong>
                  </div>
                  <span className="shop-pdp__side-score">{storeScore}</span>
                </div>
                <div className="shop-pdp__side-seller-row">
                  <span className="shop-pdp__side-positive">
                    <MessageCircle size={15} strokeWidth={2.25} />
                    %{positivePct} olumlu yorum
                  </span>
                  <Link href={storeHref} className="shop-pdp__side-store-link">
                    Mağazaya Git <ChevronRight size={14} strokeWidth={2.5} />
                  </Link>
                </div>
              </div>
            </div>
          </div>

          <button type="button" className="shop-pdp__side-premium" onClick={openPremiumPopup}>
            <Crown size={22} strokeWidth={2} className="shop-pdp__side-premium-icon" />
            <div className="shop-pdp__side-premium-body">
              <div className="shop-pdp__side-premium-title">Premium&apos;a Özel</div>
              <div className="shop-pdp__side-premium-sub">
                {premiumDiscountTl != null
                  ? `Bu üründe anında ${formatTl(premiumDiscountTl)} indirim`
                  : "Üyelere özel sepette indirim ve öncelikli kargo"}
              </div>
              {premiumPrice != null && premiumPrice > 0 && premiumPrice < salePrice ? (
                <div className="shop-pdp__side-premium-price">
                  Premium ile sepette <PriceWithKurus value={premiumPrice} />
                </div>
              ) : null}
            </div>
            <ChevronRight size={18} strokeWidth={2.25} className="shop-pdp__side-premium-chevron" />
          </button>

          <div className="shop-pdp__side-assure">
            <h3>Alışverişini Güvenceye Al</h3>
            <ul>
              <li>
                <span className="shop-pdp__side-assure-icon">
                  <RotateCcw size={16} />
                </span>
                <span>{returnDays} gün içinde koşulsuz iade</span>
                <ChevronRight size={16} className="shop-pdp__side-assure-arrow" />
              </li>
              <li>
                <span className="shop-pdp__side-assure-icon">
                  <ShieldCheck size={16} />
                </span>
                <span>Ürün garantisi</span>
                <ChevronRight size={16} className="shop-pdp__side-assure-arrow" />
              </li>
              <li>
                <span className="shop-pdp__side-assure-icon">
                  <BadgeCheck size={16} />
                </span>
                <span>Güvenli alışveriş</span>
                <ChevronRight size={16} className="shop-pdp__side-assure-arrow" />
              </li>
            </ul>
          </div>

          <div className="shop-pdp__side-install">
            <div className="shop-pdp__side-install-head">
              <h3>Taksit Seçenekleri</h3>
              <button type="button" className="shop-pdp__side-link">
                Tümünü Gör <ChevronRight size={14} strokeWidth={2.5} />
              </button>
            </div>
            <table className="shop-pdp__install-table">
              <thead>
                <tr>
                  <th>Kart</th>
                  <th>Aylık</th>
                  <th>Toplam</th>
                </tr>
              </thead>
              <tbody>
                {installmentRows.map((r, idx) => (
                  <tr key={`${r.card}-${r.months}-${idx}`}>
                    <td>
                      <div className="shop-pdp__install-card">{r.card}</div>
                      {"legacyRight" in r && (r as { legacyRight?: string }).legacyRight ? (
                        <div className="shop-pdp__install-months">{(r as { legacyRight?: string }).legacyRight}</div>
                      ) : r.months > 0 ? (
                        <div className="shop-pdp__install-months">
                          {r.months === 1 ? "Tek çekim" : `${r.months} taksit`}
                          {r.ratePercent > 0 ? ` · %${r.ratePercent} vade farkı` : " · vadesiz"}
                        </div>
                      ) : null}
                    </td>
                    <td>
                      <strong>
                        {"legacyRight" in r && (r as { legacyRight?: string }).legacyRight
                          ? "—"
                          : formatTl(r.monthly)}
                      </strong>
                    </td>
                    <td>
                      <strong>
                        {"legacyRight" in r && (r as { legacyRight?: string }).legacyRight
                          ? (r as { legacyRight?: string }).legacyRight
                          : formatTl(r.total)}
                      </strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="shop-pdp__side-install-note">
              Diğer taksit seçenekleri ödeme adımında gösterilecektir.
            </p>
          </div>

          <div className="shop-pdp__side-others">
            <button type="button" className="shop-pdp__side-others-toggle">
              <h3>Diğer Satıcılar ({otherSellers.length})</h3>
              <ChevronRight size={16} style={{ transform: "rotate(90deg)" }} />
            </button>
            <ul className="shop-pdp__side-others-list">
              {otherSellers.map((s) => (
                <li key={s.name}>
                  <div className="shop-pdp__side-others-who">
                    <span className="shop-pdp__side-others-avatar">{s.name[0]}</span>
                    <div>
                      <div className="shop-pdp__side-others-name">
                        {s.name}
                        <span className="shop-pdp__side-score shop-pdp__side-score--sm">{s.score}</span>
                      </div>
                      {s.freeShip ? (
                        <span className="shop-pdp__side-others-ship">Ücretsiz Kargo</span>
                      ) : (
                        <span className="shop-pdp__side-others-ship shop-pdp__side-others-ship--muted">
                          Kargo alıcıya
                        </span>
                      )}
                    </div>
                  </div>
                  <strong className="shop-pdp__side-others-price">{formatTl(s.price)}</strong>
                </li>
              ))}
            </ul>
            <Link href="/alisveris" className="shop-pdp__side-others-all">
              Tüm {otherSellers.length} satıcıyı gör
            </Link>
          </div>
        </aside>
      </div>

      <div className="shop-pdp__footer-trust">
        <div className="shop-pdp__footer-item">
          <Truck size={20} />
          100 TL ve üzeri ücretsiz kargo
        </div>
        <div className="shop-pdp__footer-item">
          <Package size={20} />
          Aynı gün / ertesi gün teslimat
        </div>
        <div className="shop-pdp__footer-item">
          <RotateCcw size={20} />
          {returnDays} gün iade garantisi
        </div>
        <div className="shop-pdp__footer-item">
          <ShieldCheck size={20} />
          %100 orijinal ürün
        </div>
        <div className="shop-pdp__footer-item">
          <Headphones size={20} />
          7/24 müşteri desteği
        </div>
      </div>

      <div className="shop-pdp__panels" id="shop-pdp-panels">
        <div className="shop-pdp__tabs" role="tablist" aria-label="Ürün detay sekmeleri">
          {(
            [
              { id: "specs", label: "Ürün Özellikleri" },
              { id: "desc", label: "Açıklama" },
              { id: "qa", label: "Soru & Cevap" },
              { id: "reviews", label: "Ürün Yorumları" },
              { id: "shipping", label: "Kargo & İade" },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={detailTab === t.id}
              className={`shop-pdp__tab${detailTab === t.id ? " is-active" : ""}`}
              onClick={() => setDetailTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="shop-pdp__tab-panel" role="tabpanel">
          {detailTab === "specs" ? (
            specs.length > 0 ? (
              <table className="shop-pdp__specs-table">
                <tbody>
                  {specs.map((s) => (
                    <tr key={s.label}>
                      <th>{s.label}</th>
                      <td>{s.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="shop-pdp__tab-empty">Özellik bilgisi girilmemiş.</p>
            )
          ) : null}

          {detailTab === "desc" ? (
            listing.description ? (
              <div className="shop-pdp__desc">
                <ListingDescriptionHtml text={listing.description} />
              </div>
            ) : (
              <p className="shop-pdp__tab-empty">Ürün açıklaması eklenmemiş.</p>
            )
          ) : null}

          {detailTab === "qa" ? <ListingQuestionsBlock listingId={listing.id} /> : null}

          {detailTab === "reviews" ? (
            <div className="shop-pdp__reviews">
              <div className="shop-pdp__reviews-summary">
                <div className="shop-pdp__reviews-score">
                  <strong>{rating.toFixed(1)}</strong>
                  <span className="shop-pdp__stars">{starsLabel(rating)}</span>
                  <span>{reviewCount} değerlendirme</span>
                </div>
              </div>
              {reviewCount > 0 ? (
                <ul className="shop-pdp__reviews-list">
                  {DEMO_BUYERS.slice(0, Math.min(3, Math.max(1, reviewCount))).map((b, i) => (
                    <li key={`${b.name}-${i}`}>
                      <div className="shop-pdp__review-head">
                        <strong>{b.name}</strong>
                        <span>{b.city} · {b.when}</span>
                      </div>
                      <div className="shop-pdp__stars">{starsLabel(Math.max(4, rating - i * 0.2))}</div>
                      <p>
                        {i === 0
                          ? "Ürün açıklamasıyla uyumlu, kargo hızlı geldi. Tavsiye ederim."
                          : i === 1
                            ? "Kalitesi iyi, paketleme özenliydi. Tekrar alırım."
                            : "Beklentimi karşıladı, satıcı iletişimi olumlu."}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="shop-pdp__tab-empty">Henüz ürün yorumu yok. İlk yorumu siz yazabilirsiniz.</p>
              )}
            </div>
          ) : null}

          {detailTab === "shipping" ? (
            <div className="shop-pdp__ship-panel">
              <div className="shop-pdp__ship-row">
                <Truck size={18} />
                <div>
                  <strong>Teslimat</strong>
                  <p>{shippingLabel}{sameDay ? " · Aynı gün kargo seçeneği" : ""}</p>
                </div>
              </div>
              <div className="shop-pdp__ship-row">
                <Package size={18} />
                <div>
                  <strong>Kargo ücreti</strong>
                  <p>{freeShip ? "Ücretsiz kargo" : "Sipariş tutarına göre kargo ücreti uygulanabilir"}</p>
                </div>
              </div>
              <div className="shop-pdp__ship-row">
                <RotateCcw size={18} />
                <div>
                  <strong>İade</strong>
                  <p>Teslimattan sonra {returnDays} gün içinde kolay iade</p>
                </div>
              </div>
              <div className="shop-pdp__ship-row">
                <ShieldCheck size={18} />
                <div>
                  <strong>Güvenli alışveriş</strong>
                  <p>Ödeme ve teslimat süreci platform güvencesiyle ilerler</p>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {lightbox && images[imageIdx] && (
        <div
          role="dialog"
          aria-modal
          onClick={() => setLightbox(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 80,
            background: "rgba(15,23,42,.88)",
            display: "grid",
            placeItems: "center",
            padding: 16,
            cursor: "zoom-out",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={images[imageIdx]}
            alt={listing.title}
            style={{ maxWidth: "min(960px, 100%)", maxHeight: "90vh", objectFit: "contain", borderRadius: 8 }}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      <PremiumStoreInfoModal
        open={premiumPopupOpen}
        config={premiumPopup}
        onClose={() => setPremiumPopupOpen(false)}
        onApply={applyPremiumPopup}
      />
    </div>
  );
}
