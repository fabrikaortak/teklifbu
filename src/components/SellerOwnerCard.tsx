"use client";

import Link from "next/link";
import {
  Building2,
  CheckCircle2,
  ChevronRight,
  FileText,
  Handshake,
  Heart,
  LayoutGrid,
  Percent,
  Phone,
  ShieldCheck,
  Star,
  UserRound,
} from "lucide-react";
import { formatPhoneTr } from "@/lib/format";

export type SellerCardData = {
  id: string;
  name: string | null;
  phone: string | null;
  memberSince: string;
  memberYearsLabel?: string | null;
  identityVisible?: boolean;
  contactVisible: boolean;
  isCommercial?: boolean;
  commercialTitle?: string | null;
  yetkiBelgeNo?: string | null;
  logoUrl?: string | null;
  isPremiumSeller?: boolean;
  showPremiumBadge?: boolean;
  showYearsBadge?: boolean;
  reviewCount?: number;
  avgRating?: number | null;
  verifications?: {
    identity?: boolean;
    tax?: boolean;
    phone?: boolean;
    email?: boolean;
  } | null;
  stats?: {
    totalListings?: number;
    successfulSales?: number;
    bidAcceptanceRate?: number | null;
    avgResponseMinutes?: number | null;
  } | null;
  lastActiveAt?: string | null;
};

type Props = {
  seller: SellerCardData;
  memberLabel: string;
  sellerFav: boolean;
  isSeller: boolean;
  onToggleFavorite: () => void;
  onNeedLogin: () => void;
  compact?: boolean;
  /** Satıcı profil sayfasında: kendi profiline link yok, ilanlara kaydır */
  profileMode?: boolean;
};

function lastActiveLabel(iso?: string | null) {
  if (!iso) return null;
  const diff = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(diff) || diff < 0) return null;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "az önce";
  if (m < 60) return `${m} dakika önce`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} saat önce`;
  const d = Math.floor(h / 24);
  if (d === 1) return "1 gün önce";
  if (d < 30) return `${d} gün önce`;
  return new Date(iso).toLocaleDateString("tr-TR");
}

export function SellerOwnerCard({
  seller,
  memberLabel,
  sellerFav,
  isSeller,
  onToggleFavorite,
  onNeedLogin: _onNeedLogin,
  compact,
  profileMode,
}: Props) {
  const showIdentity = seller.identityVisible !== false;
  const title =
    showIdentity && seller.isCommercial && seller.commercialTitle
      ? seller.commercialTitle
      : showIdentity && seller.name
        ? seller.name
        : seller.isCommercial
          ? "Kurumsal Üye"
          : "İlan Sahibi";

  if (seller.isCommercial) {
    return (
      <CommercialSellerCard
        seller={seller}
        title={title}
        showIdentity={showIdentity}
        memberLabel={memberLabel}
        sellerFav={sellerFav}
        isSeller={isSeller}
        onToggleFavorite={onToggleFavorite}
        compact={compact}
        profileMode={profileMode}
      />
    );
  }

  const avatar = compact ? 56 : 64;
  const stats = seller.stats;

  return (
    <div
      className="seller-owner-card"
      style={{
        display: "grid",
        gap: compact ? 16 : 18,
        padding: 0,
        borderRadius: 0,
        background: "transparent",
        border: "none",
        boxShadow: "none",
      }}
    >
      <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
        <div
          style={{
            width: avatar,
            height: avatar,
            borderRadius: 16,
            overflow: "hidden",
            flexShrink: 0,
            background: "linear-gradient(145deg, #ffedd5 0%, #fdba74 100%)",
            display: "grid",
            placeItems: "center",
            color: "#c2410c",
            fontWeight: 900,
            fontSize: 20,
            boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.55)",
          }}
        >
          {(seller.name || "İ").charAt(0).toUpperCase()}
        </div>

        <div style={{ flex: 1, minWidth: 0, display: "grid", gap: 8 }}>
          <div
            style={{
              fontWeight: 900,
              fontSize: compact ? 16 : 17,
              color: "#0f172a",
              lineHeight: 1.25,
              letterSpacing: "-0.01em",
            }}
          >
            {title}
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#64748b", lineHeight: 1.35 }}>
            Üyelik · {memberLabel}
          </div>
          {seller.contactVisible && seller.phone ? (
            <a
              href={`tel:${seller.phone}`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                fontSize: 14,
                fontWeight: 800,
                color: "var(--orange)",
                marginTop: 4,
                textDecoration: "none",
              }}
            >
              <Phone size={15} />
              {formatPhoneTr(seller.phone)}
            </a>
          ) : null}
          {!profileMode ? (
            <Link
              href={`/satici/${seller.id}`}
              style={{
                marginTop: 8,
                fontSize: 13,
                fontWeight: 800,
                color: "var(--orange)",
                textDecoration: "none",
              }}
            >
              Satıcı profili →
            </Link>
          ) : null}
        </div>
      </div>

      {profileMode && stats ? (
        <div className="seller-trust-card__stats" style={{ paddingTop: 4 }}>
          <div className="seller-trust-card__stat">
            <span className="seller-trust-card__stat-ico">
              <FileText size={18} strokeWidth={2} />
            </span>
            <strong>{String(stats.totalListings ?? 0)}</strong>
            <span>Toplam İlan</span>
          </div>
          <div className="seller-trust-card__stat">
            <span className="seller-trust-card__stat-ico">
              <Handshake size={18} strokeWidth={2} />
            </span>
            <strong>{String(stats.successfulSales ?? 0)}</strong>
            <span>Başarılı Satış</span>
          </div>
          <div className="seller-trust-card__stat">
            <span className="seller-trust-card__stat-ico">
              <Percent size={18} strokeWidth={2} />
            </span>
            <strong>
              {stats.bidAcceptanceRate != null ? `%${stats.bidAcceptanceRate}` : "—"}
            </strong>
            <span>Teklif Kabul Oranı</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function CommercialSellerCard({
  seller,
  title,
  showIdentity,
  memberLabel,
  sellerFav,
  isSeller,
  onToggleFavorite,
  compact,
  profileMode,
}: {
  seller: SellerCardData;
  title: string;
  showIdentity: boolean;
  memberLabel: string;
  sellerFav: boolean;
  isSeller: boolean;
  onToggleFavorite: () => void;
  compact?: boolean;
  profileMode?: boolean;
}) {
  const v = seller.verifications || {};
  const verifyItems = [
    { key: "identity", ok: Boolean(v.identity), label: "Kimlik Doğrulandı" },
    { key: "tax", ok: Boolean(v.tax), label: "Vergi Levhası Doğrulandı" },
    { key: "phone", ok: Boolean(v.phone), label: "Telefon Doğrulandı" },
    { key: "email", ok: Boolean(v.email), label: "E-posta Doğrulandı" },
  ].filter((x) => x.ok);

  const stats = seller.stats;
  const lastActive = lastActiveLabel(seller.lastActiveAt);
  const profileHref = `/satici/${seller.id}`;
  const showCorporateBadge =
    Boolean(v.tax) || Boolean(v.identity) || seller.isPremiumSeller;

  const statItems = [
    {
      key: "listings",
      icon: <FileText size={18} strokeWidth={2} />,
      value: String(stats?.totalListings ?? 0),
      label: "Toplam İlan",
    },
    {
      key: "sales",
      icon: <Handshake size={18} strokeWidth={2} />,
      value: String(stats?.successfulSales ?? 0),
      label: "Başarılı Satış",
    },
    {
      key: "rate",
      icon: <Percent size={18} strokeWidth={2} />,
      value: stats?.bidAcceptanceRate != null ? `%${stats.bidAcceptanceRate}` : "—",
      label: "Teklif Kabul Oranı",
    },
  ];

  return (
    <div className={`seller-trust-card${compact ? " is-compact" : ""}`}>
      <div className="seller-trust-card__head">
        <div className="seller-trust-card__avatar" aria-hidden>
          {showIdentity && seller.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={seller.logoUrl} alt="" />
          ) : (
            <Building2 size={26} strokeWidth={2} />
          )}
        </div>

        <div className="seller-trust-card__identity">
          <div className="seller-trust-card__title-row">
            <h3 className="seller-trust-card__title">{title}</h3>
            {showCorporateBadge ? (
              <span className="seller-trust-card__badge">
                <ShieldCheck size={13} strokeWidth={2.25} />
                Doğrulanmış Kurumsal
              </span>
            ) : seller.showPremiumBadge && seller.isPremiumSeller ? (
              <span className="seller-trust-card__badge">
                <ShieldCheck size={13} strokeWidth={2.25} />
                Premium Üye
              </span>
            ) : null}
          </div>

          {(seller.reviewCount ?? 0) > 0 ? (
            <div className="seller-trust-card__rating">
              <Star size={14} fill="#f59e0b" color="#f59e0b" />
              <strong>{seller.avgRating ? Number(seller.avgRating).toFixed(1) : "—"}</strong>
              <span>({seller.reviewCount} değerlendirme)</span>
            </div>
          ) : (
            <div className="seller-trust-card__meta">
              {seller.showYearsBadge ? seller.memberYearsLabel || memberLabel : `Üyelik · ${memberLabel}`}
            </div>
          )}

          {showIdentity && seller.name && seller.commercialTitle ? (
            <div className="seller-trust-card__person">{seller.name}</div>
          ) : null}
        </div>

        {!isSeller ? (
          <button
            type="button"
            className={`seller-trust-card__fav${sellerFav ? " is-on" : ""}`}
            aria-label={sellerFav ? "Favorilerden çıkar" : "Favorilere ekle"}
            onClick={onToggleFavorite}
          >
            <Heart size={16} fill={sellerFav ? "#ea580c" : "none"} color="#ea580c" />
          </button>
        ) : null}
      </div>

      {verifyItems.length > 0 ? (
        <div className="seller-trust-card__verify">
          {verifyItems.map((item) => (
            <div key={item.key} className="seller-trust-card__verify-item">
              <CheckCircle2 size={16} strokeWidth={2.25} />
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      ) : null}

      <div className="seller-trust-card__stats">
        {statItems.map((s) => (
          <div key={s.key} className="seller-trust-card__stat">
            <span className="seller-trust-card__stat-ico">{s.icon}</span>
            <strong>{s.value}</strong>
            <span>{s.label}</span>
          </div>
        ))}
      </div>

      {lastActive ? (
        profileMode ? (
          <a href="#ilanlar" className="seller-trust-card__active">
            <span className="seller-trust-card__dot" aria-hidden />
            <span>Son aktif: {lastActive}</span>
            <ChevronRight size={16} strokeWidth={2} />
          </a>
        ) : (
          <Link href={profileHref} className="seller-trust-card__active">
            <span className="seller-trust-card__dot" aria-hidden />
            <span>Son aktif: {lastActive}</span>
            <ChevronRight size={16} strokeWidth={2} />
          </Link>
        )
      ) : null}

      {seller.contactVisible && seller.phone ? (
        <a href={`tel:${seller.phone}`} className="seller-trust-card__phone">
          <Phone size={15} />
          {formatPhoneTr(seller.phone)}
        </a>
      ) : null}

      <div className="seller-trust-card__actions">
        {profileMode ? (
          <a href="#ilanlar" className="seller-trust-card__btn seller-trust-card__btn--outline">
            <LayoutGrid size={15} strokeWidth={2.25} />
            İlanlara Git
          </a>
        ) : (
          <Link href={profileHref} className="seller-trust-card__btn seller-trust-card__btn--outline">
            <LayoutGrid size={15} strokeWidth={2.25} />
            Tüm İlanlar
          </Link>
        )}
        {!profileMode ? (
          <Link href={profileHref} className="seller-trust-card__btn seller-trust-card__btn--solid">
            <UserRound size={15} strokeWidth={2.25} />
            Satıcı Profili
          </Link>
        ) : (
          <a href="#ilanlar" className="seller-trust-card__btn seller-trust-card__btn--solid">
            <UserRound size={15} strokeWidth={2.25} />
            İlanları Gör
          </a>
        )}
      </div>
    </div>
  );
}
