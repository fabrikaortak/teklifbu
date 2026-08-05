"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  Award,
  Building2,
  CalendarDays,
  Camera,
  CheckCircle2,
  Clock3,
  Crown,
  Home,
  MapPin,
  MessageCircle,
  Phone,
  Share2,
  ShieldCheck,
  Star,
  Target,
  ThumbsUp,
} from "lucide-react";
import { ListingCard, type ListingCardData } from "@/components/ListingCard";
import { ListingViewToggle, useListingView } from "@/components/ListingViewToggle";
import { useTheme } from "@/components/ThemeProvider";
import { formatPhoneTr } from "@/lib/format";
import { memberYearsLabel } from "@/lib/sellerBadges";
import { useTokenBuyGate } from "@/hooks/useTokenBuyGate";
import type {
  SellerAchievement,
  SellerPublicProfile,
  SellerStoreReview,
} from "@/lib/sellerStoreTypes";

type TabKey = "ozet" | "magaza" | "yorumlar" | "basarilar" | "hakkinda";
type MagazaFilter = "all" | "live" | "completed";

function timeAgo(iso: string) {
  const m = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (m < 60) return `${m} dk önce`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} saat önce`;
  const d = Math.floor(h / 24);
  if (d === 1) return "1 gün önce";
  return `${d} gün önce`;
}

function Stars({ value }: { value: number | null | undefined }) {
  const v = Math.max(0, Math.min(5, Number(value) || 0));
  return (
    <span className="store-stars" aria-label={`${v.toFixed(1)} yıldız`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          size={14}
          fill={i < Math.round(v) ? "#f59e0b" : "none"}
          color={i < Math.round(v) ? "#f59e0b" : "#cbd5e1"}
        />
      ))}
    </span>
  );
}

export default function SellerProfilePage() {
  const params = useParams();
  const router = useRouter();
  const { offersEnabled } = useTheme();
  const id = String(params?.id || "");
  const [seller, setSeller] = useState<SellerPublicProfile | null>(null);
  const [listings, setListings] = useState<ListingCardData[]>([]);
  const [completedListings, setCompletedListings] = useState<ListingCardData[]>([]);
  const [reviews, setReviews] = useState<SellerStoreReview[]>([]);
  const [gallery, setGallery] = useState<string[]>([]);
  const [achievements, setAchievements] = useState<SellerAchievement[]>([]);
  const [reviewsEnabled, setReviewsEnabled] = useState(false);
  const [sellerFav, setSellerFav] = useState(false);
  const [isOwn, setIsOwn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [errorCode, setErrorCode] = useState("");
  const [brandMsg, setBrandMsg] = useState("");
  const [brandBusy, setBrandBusy] = useState<"logo" | "cover" | null>(null);
  const [logoFee, setLogoFee] = useState(0);
  const [tab, setTab] = useState<TabKey>("ozet");
  const [magazaFilter, setMagazaFilter] = useState<MagazaFilter>("all");
  const [galleryIdx, setGalleryIdx] = useState(0);
  const [copied, setCopied] = useState(false);
  const { view, changeView } = useListingView("teklifbu:seller-store-view", "grid");
  const { tokenModal, handleFetchResult } = useTokenBuyGate({
    continueLabel: "Mağazaya dön",
    title: "Logo yükleme için jeton gerekli",
    description:
      "Mağaza logosu yüklemek jeton harcar. Jeton yükledikten sonra logoyu tekrar seçebilirsiniz.",
  });

  function reloadSeller() {
    if (!id) return;
    fetch(`/api/sellers/${encodeURIComponent(id)}`)
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) return;
        setSeller(d.seller || null);
        setListings(Array.isArray(d.listings) ? d.listings : []);
        setCompletedListings(Array.isArray(d.completedListings) ? d.completedListings : []);
        setReviews(Array.isArray(d.reviews) ? d.reviews : []);
        setGallery(Array.isArray(d.gallery) ? d.gallery : []);
        setAchievements(Array.isArray(d.achievements) ? d.achievements : []);
        setReviewsEnabled(Boolean(d.reviewsEnabled));
        setSellerFav(Boolean(d.isSellerFavorited));
        setIsOwn(Boolean(d.isOwnProfile));
      })
      .catch(() => {});
  }

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError("");
    setErrorCode("");
    fetch(`/api/sellers/${encodeURIComponent(id)}`)
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) {
          setError(d.error || "Satıcı yüklenemedi");
          setErrorCode(String(d.code || ""));
          setSeller(null);
          return;
        }
        setSeller(d.seller || null);
        setListings(Array.isArray(d.listings) ? d.listings : []);
        setCompletedListings(Array.isArray(d.completedListings) ? d.completedListings : []);
        setReviews(Array.isArray(d.reviews) ? d.reviews : []);
        setGallery(Array.isArray(d.gallery) ? d.gallery : []);
        setAchievements(Array.isArray(d.achievements) ? d.achievements : []);
        setReviewsEnabled(Boolean(d.reviewsEnabled));
        setSellerFav(Boolean(d.isSellerFavorited));
        setIsOwn(Boolean(d.isOwnProfile));
      })
      .catch(() => setError("Satıcı yüklenemedi"))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!isOwn) return;
    fetch("/api/commercial-settings")
      .then((r) => r.json())
      .then((d) => setLogoFee(Number(d.logoFeeTokens) || 0))
      .catch(() => {});
  }, [isOwn]);

  async function uploadBrand(kind: "logo" | "cover", file: File | null) {
    if (!file || !isOwn) return;
    setBrandBusy(kind);
    setBrandMsg("");
    try {
      const body = new FormData();
      body.append("file", file);
      const up = await fetch("/api/upload", { method: "POST", body });
      const upData = await up.json().catch(() => ({}));
      if (!up.ok) {
        setBrandMsg(upData.error || "Yükleme başarısız");
        return;
      }
      const action = kind === "logo" ? "set-commercial-logo" : "set-commercial-store-cover";
      const payload =
        kind === "logo"
          ? { action, logoUrl: upData.url }
          : { action, storeCoverUrl: upData.url };
      const res = await fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (kind === "logo" && handleFetchResult(res, data, logoFee || 1)) return;
      if (!res.ok) {
        setBrandMsg(data.error || "Kaydedilemedi");
        return;
      }
      setBrandMsg(kind === "logo" ? "Logo güncellendi" : "Kapak güncellendi");
      reloadSeller();
    } catch {
      setBrandMsg("Bağlantı hatası");
    } finally {
      setBrandBusy(null);
    }
  }

  const title = useMemo(() => {
    if (!seller) return "Mağaza";
    return seller.commercialTitle || seller.shopName || seller.name || "Satıcı";
  }, [seller]);

  const memberLabel =
    seller?.memberYearsLabel || memberYearsLabel(seller?.memberSince) || "Yeni üye";

  async function toggleFavorite() {
    if (!seller) return;
    const res = await fetch("/api/favorite-sellers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sellerId: seller.id,
        action: sellerFav ? "remove" : "add",
      }),
    });
    if (res.status === 401) {
      router.push(`/giris?next=${encodeURIComponent(`/satici/${id}`)}`);
      return;
    }
    const d = await res.json().catch(() => ({}));
    if (res.ok) setSellerFav(Boolean(d.favorited));
  }

  async function shareStore() {
    const url = typeof window !== "undefined" ? window.location.href : "";
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        return;
      }
    } catch {
      /* fall through */
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* ignore */
    }
  }

  function contactSeller() {
    if (!seller) return;
    if (seller.contactVisible && seller.phone) {
      window.location.href = `tel:${seller.phone}`;
      return;
    }
    router.push(`/hesabim?s=mesajlar&to=${encodeURIComponent(seller.id)}`);
  }

  function sendMessage() {
    if (!seller) return;
    router.push(`/hesabim?s=mesajlar&to=${encodeURIComponent(seller.id)}`);
  }

  if (loading) {
    return (
      <div className="page-shell store-page">
        <div className="card store-loading">Mağaza profili yükleniyor…</div>
      </div>
    );
  }

  if (error || !seller) {
    const pendingApproval = errorCode === "PENDING_COMMERCIAL_APPROVAL";
    return (
      <div className="page-shell store-page">
        <div className="card store-empty">
          <div className="store-empty__title">
            {pendingApproval
              ? "Mağazanız yönetici onayından sonra aktif olacak"
              : error || "Satıcı bulunamadı"}
          </div>
          {pendingApproval ? (
            <p style={{ margin: 0, fontSize: 13, color: "#64748b", maxWidth: 420, lineHeight: 1.5 }}>
              Kurumsal kaydınız incelemede. Yönetici onayladığında mağaza sayfanız burada yayınlanır.
            </p>
          ) : null}
          <Link
            href={pendingApproval ? "/hesabim" : "/ilanlar"}
            className="btn-outline"
            style={{ padding: "10px 16px" }}
          >
            {pendingApproval ? "Hesabıma dön" : "İlanlara dön"}
          </Link>
        </div>
      </div>
    );
  }

  const v = seller.verifications || {};
  const stats = seller.stats || {};
  const hero = gallery[galleryIdx] || gallery[0] || null;
  const totalListingCount = (stats.activeListings ?? listings.length) + completedListings.length;
  const tabs: Array<{ key: TabKey; label: string }> = [
    { key: "ozet", label: "Mağaza Özeti" },
    {
      key: "magaza",
      label: offersEnabled ? `Tüm İlanlar (${totalListingCount})` : `İlanlar (${totalListingCount})`,
    },
    { key: "yorumlar", label: `Değerlendirmeler (${seller.reviewCount || 0})` },
    { key: "basarilar", label: "Başarılar" },
    { key: "hakkinda", label: "Hakkımızda" },
  ];

  const metricCards = [
    {
      key: "total",
      icon: <Home size={13} />,
      tone: "green",
      value: String(stats.totalListings ?? 0),
      label: "Toplam İlan",
      sub: `Aktif ${stats.activeListings ?? 0} ilan`,
    },
    {
      key: "sales",
      icon: <Building2 size={13} />,
      tone: "blue",
      value: String(stats.successfulSales ?? 0),
      label: "Tamamlanan Satış",
      sub: null,
    },
    ...(offersEnabled
      ? [
          {
            key: "rate",
            icon: <Target size={13} />,
            tone: "orange",
            value: stats.bidAcceptanceRate != null ? `%${stats.bidAcceptanceRate}` : "—",
            label: "Teklif Kabul Oranı",
            sub: null,
          },
        ]
      : []),
    {
      key: "reply",
      icon: <Clock3 size={13} />,
      tone: "purple",
      value: stats.avgResponseMinutes != null ? `${stats.avgResponseMinutes} dk` : "—",
      label: "Ortalama Cevap Süresi",
      sub: null,
    },
    {
      key: "positive",
      icon: <ThumbsUp size={13} />,
      tone: "green",
      value: seller.positiveReviewPercent != null ? `%${seller.positiveReviewPercent}` : "—",
      label: "Olumlu Değerlendirme",
      sub: null,
    },
    {
      key: "years",
      icon: <CalendarDays size={13} />,
      tone: "red",
      value: seller.memberYears > 0 ? `${seller.memberYears} yıl` : "Yeni",
      label: "Üyelik Süresi",
      sub: null,
    },
  ];

  const verifyRows = [
    { ok: v.identity, label: "Kimlik doğrulandı" },
    { ok: v.tax, label: "Vergi levhası doğrulandı" },
    { ok: v.phone, label: "Telefon doğrulandı" },
    { ok: v.email, label: "E-posta doğrulandı" },
    { ok: v.address, label: "Adres doğrulandı" },
  ];

  const mapQuery = [
    seller.commercial?.businessAddress,
    seller.commercial?.businessDistrict,
    seller.commercial?.businessCity,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="page-shell store-page">
      {tokenModal}
      <div className="store-topbar">
        <nav className="store-breadcrumb" aria-label="Sayfa yolu">
          <Link href="/">Ana Sayfa</Link>
          <span>/</span>
          <Link href="/ilanlar">Mağazalar</Link>
          <span>/</span>
          <strong>{title}</strong>
        </nav>
        <button type="button" className="store-side-action store-share-top" onClick={shareStore}>
          <Share2 size={12} />
          {copied ? "Link kopyalandı" : "Mağazayı Paylaş"}
        </button>
      </div>

      <div className="store-layout">
        <div className="store-main">
          <section className="card store-hero-wrap">
            <div className="store-hero">
              <div className="store-hero__identity">
                <div className={`store-hero__logo${isOwn ? " is-editable" : ""}`} aria-hidden={!isOwn}>
                  {seller.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={seller.logoUrl} alt="" />
                  ) : (
                    <Building2 size={42} strokeWidth={1.75} />
                  )}
                  {isOwn ? (
                    <label className="store-hero__edit-btn" title="Logo yükle">
                      {brandBusy === "logo" ? "…" : "Logo"}
                      <input
                        type="file"
                        accept="image/*"
                        hidden
                        disabled={brandBusy !== null}
                        onChange={(e) => void uploadBrand("logo", e.target.files?.[0] || null)}
                      />
                    </label>
                  ) : null}
                </div>
                {(v.tax || v.identity) && (
                  <div className="store-hero__verified">
                    <CheckCircle2 size={12} />
                    Doğrulanmış Kurumsal Üye
                  </div>
                )}
              </div>

              <div className="store-hero__info">
                <div className="store-hero__title-row">
                  <h1>{title}</h1>
                  {seller.isPremiumSeller && seller.showPremiumBadge ? (
                    <span className="store-pro-badge">
                      <Crown size={11} strokeWidth={2.4} />
                      PRO
                    </span>
                  ) : null}
                </div>

                <div className="store-hero__meta">
                  {(seller.reviewCount || 0) > 0 ? (
                    <>
                      <Star size={13} fill="#ea580c" color="#ea580c" />
                      <strong>{seller.avgRating ? Number(seller.avgRating).toFixed(1) : "—"}</strong>
                      <span>({seller.reviewCount} değerlendirme)</span>
                      <span className="store-dot">·</span>
                    </>
                  ) : null}
                  <span className="store-hero__tenure">
                    {seller.memberSinceYear
                      ? `${seller.memberSinceYear} yılından beri TeklifBu’da`
                      : memberLabel}
                  </span>
                </div>

                {seller.about ? <p className="store-hero__about">{seller.about}</p> : null}

                <div className="store-hero__actions">
                  <button type="button" className="btn-orange store-btn" onClick={contactSeller}>
                    <Phone size={12} />
                    İletişime Geç
                  </button>
                  {!isOwn ? (
                    <button type="button" className="btn-outline store-btn" onClick={sendMessage}>
                      <MessageCircle size={12} />
                      Mesaj Gönder
                    </button>
                  ) : null}
                  {!isOwn ? (
                    <button type="button" className="btn-outline store-btn" onClick={toggleFavorite}>
                      <Star size={12} fill={sellerFav ? "#ea580c" : "none"} color="#64748b" />
                      {sellerFav ? "Takipte" : "Takip Et"}
                    </button>
                  ) : null}
                </div>
              </div>

              <div className={`store-hero__media${isOwn ? " is-editable" : ""}`}>
                {hero ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={hero} alt="" />
                ) : (
                  <div className="store-hero__media-empty">
                    <Building2 size={28} />
                    <span>{isOwn ? "Kapak görseli ekleyin" : "Mağaza görseli yok"}</span>
                  </div>
                )}
                <div className="store-hero__fade" aria-hidden />
                {isOwn ? (
                  <label className="store-hero__edit-btn store-hero__edit-btn--cover" title="Kapak yükle">
                    <Camera size={12} />
                    {brandBusy === "cover" ? "Yükleniyor…" : "Kapak seç"}
                    <input
                      type="file"
                      accept="image/*"
                      hidden
                      disabled={brandBusy !== null}
                      onChange={(e) => void uploadBrand("cover", e.target.files?.[0] || null)}
                    />
                  </label>
                ) : gallery.length > 0 ? (
                  <button
                    type="button"
                    className="store-hero__photos"
                    onClick={() => setGalleryIdx((i) => (i + 1) % gallery.length)}
                  >
                    <Camera size={12} />
                    {gallery.length} Fotoğraf
                  </button>
                ) : null}
              </div>
            </div>
            {isOwn && brandMsg ? <div className="store-brand-msg">{brandMsg}</div> : null}

            <div className="store-tabs" role="tablist">
              {tabs.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.key}
                  className={tab === t.key ? "is-active" : undefined}
                  onClick={() => setTab(t.key)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </section>

          {(tab === "ozet" || tab === "magaza") && (
            <>
              {tab === "ozet" ? (
                <section className="store-metrics">
                  {metricCards.map((m) => (
                    <div key={m.key} className={`store-metric store-metric--${m.tone}`}>
                      <span className="store-metric__ico">{m.icon}</span>
                      <strong>{m.value}</strong>
                      <span className="store-metric__label">{m.label}</span>
                      {m.sub ? <span className="store-metric__sub">{m.sub}</span> : null}
                    </div>
                  ))}
                </section>
              ) : null}

              <section id="magaza" className="card store-section">
                <div className="store-section__head">
                  <div className="store-section__title-row">
                    <h2>MAĞAZA</h2>
                    <div className="store-magaza-filters">
                      {offersEnabled ? (
                        <>
                          <button
                            type="button"
                            className={`store-link-btn ${magazaFilter === "all" ? "is-active" : ""}`}
                            onClick={() => {
                              setMagazaFilter("all");
                              setTab("magaza");
                            }}
                          >
                            Tüm İlanlar
                          </button>
                          <button
                            type="button"
                            className={`store-link-btn ${magazaFilter === "live" ? "is-active" : ""}`}
                            onClick={() => {
                              setMagazaFilter("live");
                              setTab("magaza");
                            }}
                          >
                            İlanlar
                          </button>
                          <button
                            type="button"
                            className={`store-link-btn ${magazaFilter === "completed" ? "is-active" : ""}`}
                            onClick={() => {
                              setMagazaFilter("completed");
                              setTab("magaza");
                            }}
                          >
                            Sonuçlananlar
                          </button>
                        </>
                      ) : (
                        <button type="button" className="store-link-btn is-active">
                          İlanlar
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="store-section__tools">
                    <ListingViewToggle view={view} onChange={changeView} />
                  </div>
                </div>

                {(() => {
                  const source = !offersEnabled
                    ? [...listings, ...completedListings]
                    : magazaFilter === "completed"
                      ? completedListings
                      : magazaFilter === "live"
                        ? listings
                        : [...listings, ...completedListings];
                  const shown = tab === "ozet" ? source.slice(0, 8) : source;
                  const emptyText = !offersEnabled
                    ? "Bu mağazada henüz ilan yok."
                    : magazaFilter === "completed"
                      ? "Henüz sonuçlanan ilan yok."
                      : magazaFilter === "live"
                        ? "Bu mağazada şu an yayında ilan yok."
                        : "Bu mağazada henüz ilan yok.";
                  return !source.length ? (
                    <div className="store-empty-inline">{emptyText}</div>
                  ) : (
                    <div
                      className={view === "list" ? "store-listings-list" : "store-listings-grid"}
                    >
                      {shown.map((l) => (
                        <ListingCard
                          key={l.id}
                          listing={l}
                          variant={view === "list" ? "row" : "grid"}
                        />
                      ))}
                    </div>
                  );
                })()}
              </section>

              {tab === "ozet" && reviewsEnabled && reviews.length > 0 ? (
                <section className="card store-section">
                  <div className="store-section__head">
                    <div>
                      <h2>Son Değerlendirmeler</h2>
                      <p>{seller.reviewCount} toplam değerlendirme</p>
                    </div>
                    <button type="button" className="store-link-btn" onClick={() => setTab("yorumlar")}>
                      Tümünü Gör
                    </button>
                  </div>
                  <div className="store-reviews">
                    {reviews.slice(0, 4).map((r) => (
                      <article key={r.id} className="store-review">
                        <div className="store-review__avatar">{(r.authorName || "Ü").charAt(0)}</div>
                        <div className="store-review__body">
                          <div className="store-review__top">
                            <strong>{r.authorName}</strong>
                            <Stars value={r.rating} />
                            <span>{timeAgo(r.createdAt)}</span>
                          </div>
                          <p>{r.body}</p>
                          {r.listingId && r.listingTitle ? (
                            <Link href={`/ilan/${r.listingId}`} className="store-review__listing">
                              {r.listingTitle}
                            </Link>
                          ) : null}
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              ) : null}
            </>
          )}

          {tab === "yorumlar" && (
            <section className="card store-section">
              <div className="store-section__head">
                <div>
                  <h2>Değerlendirmeler</h2>
                  <p>
                    {(seller.reviewCount || 0) > 0
                      ? `${seller.avgRating ? Number(seller.avgRating).toFixed(1) : "—"} ortalama · ${seller.reviewCount} yorum`
                      : "Henüz değerlendirme yok"}
                  </p>
                </div>
              </div>
              {!reviewsEnabled ? (
                <div className="store-empty-inline">Değerlendirmeler yakında açılacak.</div>
              ) : !reviews.length ? (
                <div className="store-empty-inline">Henüz onaylı değerlendirme yok.</div>
              ) : (
                <div className="store-reviews store-reviews--stack">
                  {reviews.map((r) => (
                    <article key={r.id} className="store-review">
                      <div className="store-review__avatar">{(r.authorName || "Ü").charAt(0)}</div>
                      <div className="store-review__body">
                        <div className="store-review__top">
                          <strong>{r.authorName}</strong>
                          <Stars value={r.rating} />
                          <span>{timeAgo(r.createdAt)}</span>
                        </div>
                        <p>{r.body}</p>
                        {r.listingId && r.listingTitle ? (
                          <Link href={`/ilan/${r.listingId}`} className="store-review__listing">
                            {r.listingTitle}
                          </Link>
                        ) : null}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          )}

          {tab === "basarilar" && (
            <section className="card store-section">
              <div className="store-section__head">
                <div>
                  <h2>Başarılar</h2>
                  <p>Mağaza performans rozetleri</p>
                </div>
              </div>
              {!achievements.length ? (
                <div className="store-empty-inline">Henüz başarı rozeti yok.</div>
              ) : (
                <div className="store-achievements">
                  {achievements.map((a) => (
                    <div key={a.id} className={`store-achievement store-achievement--${a.tone}`}>
                      <Award size={22} />
                      <div>
                        <strong>{a.title}</strong>
                        <span>{a.subtitle}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {tab === "hakkinda" && (
            <section className="card store-section">
              <div className="store-section__head">
                <div>
                  <h2>Hakkımızda</h2>
                  <p>Mağaza bilgileri</p>
                </div>
              </div>
              <div className="store-about">
                {seller.about ? <p>{seller.about}</p> : null}
                <dl className="store-about__dl">
                  <div>
                    <dt>Mağaza türü</dt>
                    <dd>{seller.commercial?.companyTypeLabel || (seller.isCommercial ? "Kurumsal" : "Bireysel")}</dd>
                  </div>
                  <div>
                    <dt>Yetkili</dt>
                    <dd>{seller.commercial?.authorizedTitle || seller.name || "—"}</dd>
                  </div>
                  <div>
                    <dt>Kuruluş / üyelik</dt>
                    <dd>{seller.memberSinceYear || "—"}</dd>
                  </div>
                  <div>
                    <dt>Konum</dt>
                    <dd>
                      {[seller.commercial?.businessDistrict, seller.commercial?.businessCity]
                        .filter(Boolean)
                        .join(", ") || "—"}
                    </dd>
                  </div>
                  <div>
                    <dt>Adres</dt>
                    <dd>{seller.commercial?.businessAddress || "—"}</dd>
                  </div>
                  {seller.yetkiBelgeNo || seller.commercial?.yetkiBelgeNo ? (
                    <div>
                      <dt>Yetki belge no</dt>
                      <dd>{seller.yetkiBelgeNo || seller.commercial?.yetkiBelgeNo}</dd>
                    </div>
                  ) : null}
                </dl>
              </div>
            </section>
          )}

          <section className="store-why">
            <h3>Neden {title}?</h3>
            <div className="store-why__grid">
              <div>
                <ShieldCheck size={20} />
                <strong>Güvenilir Hizmet</strong>
                <span>Doğrulanmış üyelik ve şeffaf süreç</span>
              </div>
              <div>
                <Clock3 size={20} />
                <strong>Hızlı ve Şeffaf</strong>
                <span>Teklif süreci açık ve takip edilebilir</span>
              </div>
              <div>
                <Building2 size={20} />
                <strong>Uzman Kadro</strong>
                <span>Kategoriye özel mağaza deneyimi</span>
              </div>
              <div>
                <MessageCircle size={20} />
                <strong>7/24 Destek</strong>
                <span>Mesaj ve iletişim kanalları hazır</span>
              </div>
            </div>
          </section>
        </div>

        <aside className="store-side">
          <div className="card store-side-card">
            <h3>Güven & Doğrulamalar</h3>
            <ul className="store-verify-list">
              {verifyRows.map((row) => (
                <li key={row.label} className={row.ok ? "is-ok" : "is-off"}>
                  <CheckCircle2 size={16} />
                  {row.label}
                </li>
              ))}
            </ul>
            <div className="store-trust-badge">
              <ShieldCheck size={28} />
              <div>
                <strong>%100 Güvenli</strong>
                <span>Doğrulama kontrolleri</span>
              </div>
            </div>
          </div>

          <div className="card store-side-card">
            <h3>Mağaza Bilgileri</h3>
            <dl className="store-info-dl">
              <div>
                <dt>Tür</dt>
                <dd>{seller.commercial?.companyTypeLabel || (seller.isCommercial ? "Kurumsal" : "Bireysel")}</dd>
              </div>
              <div>
                <dt>Yetkili</dt>
                <dd>{seller.commercial?.authorizedTitle || seller.name || "—"}</dd>
              </div>
              <div>
                <dt>Üyelik</dt>
                <dd>{seller.memberSinceYear || memberLabel}</dd>
              </div>
              <div>
                <dt>Konum</dt>
                <dd>
                  {[seller.commercial?.businessDistrict, seller.commercial?.businessCity]
                    .filter(Boolean)
                    .join(", ") || "—"}
                </dd>
              </div>
            </dl>
            {mapQuery ? (
              <a
                className="btn-orange store-btn store-map-btn"
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`}
                target="_blank"
                rel="noreferrer"
              >
                <MapPin size={15} />
                Haritada Gör
              </a>
            ) : null}
            {seller.contactVisible && seller.phone ? (
              <a href={`tel:${seller.phone}`} className="store-side-phone">
                <Phone size={15} />
                {formatPhoneTr(seller.phone)}
              </a>
            ) : null}
          </div>

          {achievements.length > 0 ? (
            <div className="card store-side-card">
              <h3>Başarılar</h3>
              <div className="store-achievements store-achievements--side">
                {achievements.slice(0, 4).map((a) => (
                  <div key={a.id} className={`store-achievement store-achievement--${a.tone}`}>
                    <Award size={18} />
                    <div>
                      <strong>{a.title}</strong>
                      <span>{a.subtitle}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
