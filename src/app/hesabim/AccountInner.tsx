"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { formatTl, paymentPurposeLabel, paymentStatusLabel, maskName } from "@/lib/format";
import { ListingCard, ListingCardData } from "@/components/ListingCard";
import { ListingViewToggle, useListingView } from "@/components/ListingViewToggle";
import {
  canSellerEditListing,
  canSellerDeleteListing,
  canSellerUnpublishListing,
  isLiveListingStatus,
  listingHasBids,
  listingStatusLabel,
} from "@/lib/listingStatus";
import {
  canRequestListingExtension,
  EXTENSION_DAY_OPTIONS,
} from "@/lib/listingExtension";
import { useDialog } from "@/components/ui/ConfirmDialog";
import { RecentSalesStrip } from "@/components/RecentSalesStrip";
import { CommercialSubtypePicker } from "@/components/CommercialSubtypePicker";
import { CommercialBusinessForm } from "@/components/CommercialBusinessForm";
import {
  isCorporateAccount,
  normalizeAccountType,
  parseCommercialSubtypes,
  accountTypeLabelTr,
  type CommercialSubtype,
} from "@/lib/accountTypes";
import {
  commercialStatusLabel,
  mergeCommercialIntoProfile,
  parseCommercialProfile,
  validateCommercialProfile,
  type CommercialProfile,
} from "@/data/commercialProfile";
import {
  MessageSquareWarning,
  X,
  FileText,
  Gavel,
  Bell,
  BellRing,
  Heart,
  Coins,
  MessagesSquare,
  Settings,
  Shield,
  ShieldCheck,
  Sparkles,
  ShoppingBag,
  Store,
  LogOut,
  HelpCircle,
  Crown,
  Home,
  Star,
} from "lucide-react";
import { SellerGrantEditModal } from "@/components/SellerGrantEditModal";
import { AiBulkListingPanel } from "@/components/account/AiBulkListingPanel";
import { AccountDashboard } from "@/components/account/AccountDashboard";
import { AccountShoppingPanel } from "@/components/account/AccountShoppingPanel";
import { AccountListingCreatePanel } from "@/components/account/AccountListingCreatePanel";
import { CommercialEditModal } from "@/components/CommercialEditModal";
import { CommercialBulkListingUpdate } from "@/components/account/CommercialBulkListingUpdate";
import { ShopPackageBuyModal } from "@/components/ShopPackageBuyModal";
import { useTheme } from "@/components/ThemeProvider";
import { CLASSIFIED_NOTIFICATION_KEYS } from "@/lib/notificationPrefs";

const MENU_ICONS: Record<string, ReactNode> = {
  ozet: <Home size={15} strokeWidth={2.2} />,
  ilanlarim: <FileText size={15} strokeWidth={2} />,
  "ilan-ekle": <ShoppingBag size={15} strokeWidth={2} />,
  "ai-ilan": <Sparkles size={15} strokeWidth={2} />,
  tekliflerim: <Gavel size={15} strokeWidth={2} />,
  alisveris: <ShoppingBag size={15} strokeWidth={2} />,
  bildirimler: <Bell size={15} strokeWidth={2} />,
  "bildirim-ayarlar": <BellRing size={15} strokeWidth={2} />,
  favoriler: <Heart size={15} strokeWidth={2} />,
  jetonlarim: <Coins size={15} strokeWidth={2} />,
  mesajlar: <MessagesSquare size={15} strokeWidth={2} />,
  "guvenli-ode": <ShieldCheck size={15} strokeWidth={2} />,
  ayarlar: <Settings size={15} strokeWidth={2} />,
  guvenlik: <Shield size={15} strokeWidth={2} />,
  faturalar: <FileText size={15} strokeWidth={2} />,
};

export default function AccountInner() {
  const router = useRouter();
  const search = useSearchParams();
  const { offersEnabled, escrow } = useTheme();
  const rawSection = search.get("s") || "ozet";
  const section = !offersEnabled && rawSection === "tekliflerim" ? "ozet" : rawSection;
  const [data, setData] = useState<any>(null);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [aiTokenCost, setAiTokenCost] = useState(2);
  const [commercialOpen, setCommercialOpen] = useState(false);
  const [shopPackageOpen, setShopPackageOpen] = useState(false);

  async function loadMe() {
    const r = await fetch("/api/me");
    if (r.status === 401) {
      router.push("/giris");
      return;
    }
    setData(await r.json());
  }

  useEffect(() => {
    loadMe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  useEffect(() => {
    fetch("/api/ai/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        setAiEnabled(Boolean(d.enabled));
        setAiTokenCost(Number(d.tokenCost) || 2);
      })
      .catch(() => {});
  }, []);

  if (!data) return <div className="page-shell" style={{ paddingTop: 40, paddingBottom: 40 }}>Yükleniyor...</div>;

  const menu: [string, string][] = [
    ["ozet", "Ana Sayfa"],
    ["ilanlarim", "İlanlarım"],
    ["ilan-ekle", "İlan Ekle"],
    ...(aiEnabled ? [["ai-ilan", "AI ile ilan ekle"] as [string, string]] : []),
    ...(offersEnabled ? [["tekliflerim", "Tekliflerim"] as [string, string]] : []),
    ["alisveris", "Alışverişlerim"],
    ["favoriler", "Favorilerim"],
    ["mesajlar", "Mesajlarım"],
    ["jetonlarim", "Jetonlarım"],
    ...(data.paymentsVisible !== false ? [["faturalar", "Faturalarım"] as [string, string]] : []),
    ["bildirimler", "Bildirimlerim"],
    ["bildirim-ayarlar", "Bildirim Ayarları"],
    ...(escrow.enabled ? [["guvenli-ode", "Güvenli Öde"] as [string, string]] : []),
    ["ayarlar", "Ayarlarım"],
    ["guvenlik", "Güvenlik"],
  ];

  const menuBadges: Record<string, number | string | null> = {
    ilanlarim: data.stats?.activeListings || null,
    tekliflerim: offersEnabled ? data.stats?.bidsGiven || null : null,
    favoriler: data.stats?.favorites || null,
    mesajlar: data.stats?.unreadMessages || null,
    jetonlarim: data.stats?.tokenBalance ?? 0,
    bildirimler: (data.notifications || []).filter((n: any) => !n.isRead).length || null,
  };

  const avatarSrc = data.user.avatarUrl || data.user.logoUrl || null;
  const initials = String(data.user.name || "Ü")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p: string) => p[0]?.toUpperCase() || "")
    .join("") || "Ü";
  const isCorp = isCorporateAccount(data.user.accountType);
  const memberLabel = isCorp
    ? "Kurumsal Üye"
    : accountTypeLabelTr(data.user.accountType) || "Üye";
  const avgRating = data.stats?.avgRating != null ? Number(data.stats.avgRating) : null;
  const reviewCount = Number(data.stats?.reviewCount || 0);
  const satisfactionPct =
    data.stats?.satisfactionPct != null
      ? Number(data.stats.satisfactionPct)
      : avgRating != null
        ? Math.round((avgRating / 5) * 100)
        : null;

  return (
    <>
    <div className={`page-shell account-layout${section === "ilan-ekle" ? " account-layout--form" : ""}`}>
      {section !== "ilan-ekle" ? (
      <aside className="account-menu">
        <div className="account-menu-profile">
          <div className="account-menu-profile__top">
            <div className="account-menu-avatar">
              {avatarSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarSrc} alt="" />
              ) : (
                <span>{initials}</span>
              )}
            </div>
            <div className="account-menu-profile__meta">
              <div className="account-menu-user__name">{data.user.name || "Kullanıcı"}</div>
              {isCorp && normalizeAccountType(data.user.accountType) === "TICARI" ? (
                <button
                  type="button"
                  className="account-menu-type-pill"
                  onClick={() => setCommercialOpen(true)}
                  title="Ticari bilgileri düzenle"
                >
                  {memberLabel}
                </button>
              ) : (
                <span className="account-menu-type-pill">{memberLabel}</span>
              )}
              {avgRating != null && reviewCount > 0 ? (
                <div className="account-menu-rating">
                  <Star size={13} fill="currentColor" strokeWidth={0} />
                  <strong>{avgRating.toFixed(1)}</strong>
                  <span>({reviewCount})</span>
                </div>
              ) : null}
              {normalizeAccountType(data.user.accountType) === "TICARI" && data.user.commercialStatus ? (
                <div className="account-menu-user__status">
                  {commercialStatusLabel(data.user.commercialStatus)}
                  {data.user.hasPendingCommercialUpdate ? " · Güncelleme bekliyor" : ""}
                </div>
              ) : null}
            </div>
          </div>

          <div className="account-menu-mini-stats">
            <div>
              <strong>{data.stats?.activeListings ?? 0}</strong>
              <span>Aktif İlan</span>
            </div>
            <div>
              <strong>{offersEnabled ? (data.stats?.bidsReceived ?? 0) : (data.stats?.totalViews ?? 0)}</strong>
              <span>{offersEnabled ? "Teklif Aldı" : "Görüntülenme"}</span>
            </div>
            <div>
              <strong>{satisfactionPct != null ? `%${satisfactionPct}` : "—"}</strong>
              <span>Memnuniyet</span>
            </div>
          </div>

          <div className="account-menu-actions">
            {isCorp ? (
              <Link href={`/satici/${data.user.id}`} className="account-menu-store-btn">
                <Store size={16} strokeWidth={2.2} /> Mağazamı Görüntüle
              </Link>
            ) : null}
            {data.sellerPanel?.allowed ? (
              <Link href="/magaza/panel" className="account-menu-store-btn account-menu-store-btn--ghost">
                <Sparkles size={15} strokeWidth={2.2} /> {data.sellerPanel.buttonLabel || "Satıcı Paneli"}
              </Link>
            ) : null}
            {(data.shopPackage ||
              isCorp ||
              normalizeAccountType(data.user.accountType) === "BIREYSEL_TICARI") &&
            data.shopPackageBuyEnabled !== false ? (
              <button
                type="button"
                className="account-menu-store-btn account-menu-store-btn--ghost"
                onClick={() => setShopPackageOpen(true)}
              >
                <Crown size={15} strokeWidth={2.2} /> {data.shopPackage ? "Paketim" : "Premium"}
              </button>
            ) : null}
          </div>
        </div>

        <nav className="account-menu-nav">
          {menu.map(([k, label]) => {
            const badge = menuBadges[k];
            const showBadge = badge != null && badge !== 0;
            return (
              <Link
                key={k}
                href={`/hesabim?s=${k}`}
                className={`account-menu-link${section === k ? " is-active" : ""}`}
              >
                <span className="account-menu-ico">
                  {MENU_ICONS[k] || <HelpCircle size={15} strokeWidth={2} />}
                </span>
                <span className="account-menu-link__label">{label}</span>
                {showBadge ? <span className="account-menu-badge">{badge}</span> : null}
              </Link>
            );
          })}
        </nav>

        <button
          className="btn-outline account-menu-logout"
          onClick={async () => {
            await fetch("/api/auth", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "logout" }),
            });
            window.dispatchEvent(new Event("teklifbu:auth"));
            router.push("/");
            router.refresh();
          }}
        >
          <LogOut size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
          Çıkış Yap
        </button>
      </aside>
      ) : null}

      <section style={{ display: "grid", gap: 16, alignContent: "start", alignSelf: "start", minWidth: 0 }}>
        {section === "ozet" && (
          <AccountDashboard
            data={data}
            offersEnabled={offersEnabled}
            onOpenShopPackage={() => setShopPackageOpen(true)}
          />
        )}

        {section === "alisveris" && <AccountShoppingPanel userId={data.user.id} />}

        {section === "ilan-ekle" && <AccountListingCreatePanel />}

        {section === "faturalar" && data.paymentsVisible !== false && (
          <div className="card account-bids-card">
            <div className="account-bids-card__head">Faturalarım / Ödemeler</div>
            <table className="account-bids-table">
              <thead>
                <tr>
                  <th>Tarih</th>
                  <th>Açıklama</th>
                  <th>Tutar</th>
                  <th>Durum</th>
                </tr>
              </thead>
              <tbody>
                {(data.payments || []).map((p: any) => (
                  <tr key={p.id}>
                    <td>{new Date(p.createdAt).toLocaleDateString("tr-TR")}</td>
                    <td>
                      <div style={{ fontWeight: 700 }}>{paymentPurposeLabel(p.purpose)}</div>
                      {p.months ? (
                        <div style={{ fontSize: 12, color: "var(--muted)" }}>{p.months} ay</div>
                      ) : null}
                      {p.days ? (
                        <div style={{ fontSize: 12, color: "var(--muted)" }}>{p.days} gün</div>
                      ) : null}
                    </td>
                    <td className="price-bid">{formatTl(p.amountTl)}</td>
                    <td style={{ fontWeight: 700 }}>{paymentStatusLabel(p.status)}</td>
                  </tr>
                ))}
                {!(data.payments || []).length && (
                  <tr>
                    <td colSpan={4} className="account-bids-empty">
                      Henüz ödeme kaydı yok.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {section === "tekliflerim" && offersEnabled && (
          <>
            <ApprovedDealsPanel bids={(data.bids || []).filter((b: any) => b.status === "APPROVED")} />

            <div className="card account-bids-card">
              <div className="account-bids-card__head">
                Aldığım Teklifler
                {Number(data.stats?.bidsReceivedActive) > 0 ? (
                  <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 800, color: "var(--orange)" }}>
                    {data.stats.bidsReceivedActive} aktif
                  </span>
                ) : null}
              </div>
              <table className="account-bids-table">
                <thead>
                  <tr>
                    <th>İlan</th>
                    <th>Teklif veren</th>
                    <th>Tutar</th>
                    <th>Tarih</th>
                    <th>Durum</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.receivedBids || []).map((b: any) => (
                    <tr key={b.id}>
                      <td>
                        <Link href={`/ilan/${b.listingId}`}>{b.listingTitle || "İlan"}</Link>
                      </td>
                      <td>{maskName(b.bidderName) || "—"}</td>
                      <td className="price-bid">{formatTl(b.amount)}</td>
                      <td>{new Date(b.createdAt).toLocaleDateString("tr-TR")}</td>
                      <td>
                        <span
                          style={{
                            color:
                              b.status === "APPROVED"
                                ? "var(--green)"
                                : b.status === "ACTIVE"
                                  ? "#2563eb"
                                  : "#6b7280",
                            fontWeight: 700,
                          }}
                        >
                          {bidStatusLabel(b.status)}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {!(data.receivedBids || []).length && (
                    <tr>
                      <td colSpan={5} className="account-bids-empty">
                        İlanlarınıza henüz teklif gelmedi.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="card account-bids-card">
              <div className="account-bids-card__head">Verdiğim Teklifler</div>
              <table className="account-bids-table">
                <thead>
                  <tr>
                    <th>İlan</th>
                    <th>Tutar</th>
                    <th>Tarih</th>
                    <th>Durum</th>
                  </tr>
                </thead>
                <tbody>
                  {data.bids.map((b: any) => {
                    const removed = Boolean(b.listingRemoved || b.listingGone);
                    const title = b.listingTitle || b.listing?.title || "İlan";
                    return (
                    <tr key={b.id}>
                      <td>
                        {removed ? (
                          <div style={{ display: "grid", gap: 3 }}>
                            <span style={{ fontWeight: 700, color: "#64748b" }}>{title}</span>
                            <span className="account-bids-pill">İlan kaldırıldı</span>
                          </div>
                        ) : (
                          <Link href={`/ilan/${b.listing.id}`}>{b.listing.title}</Link>
                        )}
                      </td>
                      <td className="price-bid">{formatTl(b.amount)}</td>
                      <td>{new Date(b.createdAt).toLocaleDateString("tr-TR")}</td>
                      <td>
                        <span
                          style={{
                            color:
                              b.status === "APPROVED"
                                ? "var(--green)"
                                : b.status === "ACTIVE"
                                  ? "#2563eb"
                                  : "#6b7280",
                            fontWeight: 700,
                          }}
                        >
                          {bidStatusLabel(b.status)}
                        </span>
                      </td>
                    </tr>
                    );
                  })}
                  {!data.bids?.length && (
                    <tr>
                      <td colSpan={4} className="account-bids-empty">
                        Henüz teklif yok.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {section === "ilanlarim" && (
          <MyListingsPanel
            listings={data.listings || []}
            allowLiveEdit={data.listingEditWhileLive !== false}
            aiEnabled={aiEnabled}
            isCommercial={normalizeAccountType(data.user.accountType) === "TICARI"}
            onRefresh={loadMe}
          />
        )}
        {section === "ai-ilan" && aiEnabled && (
          <AiBulkListingPanel
            tokenBalance={Number(data.stats?.tokenBalance ?? data.user?.tokenBalance ?? 0)}
            tokenCost={aiTokenCost}
          />
        )}
        {section === "ai-ilan" && !aiEnabled && (
          <div className="card" style={{ padding: 18 }}>
            <h2 style={{ marginTop: 0 }}>AI ile ilan ekle</h2>
            <p style={{ color: "var(--muted)" }}>Bu özellik şu an kapalı. Admin → AI menüsünden açılabilir.</p>
          </div>
        )}
        {section === "bildirimler" && <NotificationsPanel items={data.notifications || []} />}
        {section === "bildirim-ayarlar" && (
          <NotificationSettingsPanel
            initialPrefs={data.notificationPrefs || {}}
            events={data.notificationEvents || []}
            offersEnabled={offersEnabled}
          />
        )}

        {section === "jetonlarim" && (
          <div className="card" style={{ padding: 18 }}>
            <h2 style={{ marginTop: 0 }}>Jetonlarım</h2>
            <p>
              Bakiyeniz: <strong>{data.stats.tokenBalance}</strong>
            </p>
            <Link href="/jeton" className="btn-orange" style={{ display: "inline-block", padding: "10px 16px" }}>
              Paketleri Gör
            </Link>
          </div>
        )}

        {section === "favoriler" && <FavoritesPanel />}
        {section === "mesajlar" && <MessagesPanel />}
        {section === "guvenli-ode" && escrow.enabled && <EscrowDealsPanel />}
        {section === "ayarlar" && (
          <AccountSettings
            user={data.user}
            profileFields={data.profileFields || []}
            onSaved={loadMe}
            requireSellerIban={escrow.requireSellerIban}
          />
        )}
        {section === "guvenlik" && (
          <div className="card" style={{ padding: 18, display: "grid", gap: 10 }}>
            <h2 style={{ marginTop: 0 }}>Güvenlik</h2>
            <p style={{ margin: 0, color: "var(--muted)", lineHeight: 1.5 }}>
              Telefon doğrulandı. Şifre değiştirmek için{" "}
              <Link href="/hesabim?s=ayarlar" style={{ color: "var(--orange)", fontWeight: 700 }}>
                Hesap Ayarları
              </Link>
              ’na gidin (admin şifre alanını açmışsa görünür).
            </p>
          </div>
        )}
      </section>
    </div>
    <RecentSalesStrip placement="profile" shellClassName="page-shell" className="recent-sales--compact" />
    {normalizeAccountType(data.user.accountType) === "TICARI" ? (
      <CommercialEditModal
        open={commercialOpen}
        onClose={() => setCommercialOpen(false)}
        onSaved={loadMe}
        initialSubtypes={data.user.commercialSubtypes}
        initialProfile={data.user.profile}
        initialLogoUrl={data.user.logoUrl}
        initialStoreCoverUrl={data.user.storeCoverUrl}
        pendingProfile={data.user.pendingCommercialProfile}
        pendingSubtypes={data.user.pendingCommercialSubtypes}
        commercialStatus={data.user.commercialStatus}
        hasPendingUpdate={Boolean(data.user.hasPendingCommercialUpdate)}
      />
    ) : null}
    <ShopPackageBuyModal
      open={shopPackageOpen}
      title={data.shopPackage ? "Paket yenile / yükselt" : "Kurumsal paket al"}
      description={
        data.shopPackage
          ? "Yeni paket seçerseniz abonelik süreniz uzatılır veya paket güncellenir."
          : "İlan vermek için kurumsal paket seçip satın alabilirsiniz."
      }
      onClose={() => setShopPackageOpen(false)}
      onPurchased={() => {
        setShopPackageOpen(false);
        loadMe();
      }}
    />
    </>
  );
}

function bidStatusLabel(status?: string) {
  switch (status) {
    case "APPROVED":
      return "Onaylandı";
    case "ACTIVE":
      return "Aktif";
    case "REJECTED":
      return "Reddedildi";
    case "EXPIRED":
      return "Süresi doldu";
    case "WITHDRAWN":
      return "Geri çekildi";
    default:
      return status || "—";
  }
}

function ApprovedDealsPanel({
  bids,
}: {
  bids: Array<{ id: string; amount: number; listing: ListingCardData & { status?: string } }>;
}) {
  if (!bids.length) return null;
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <h2 style={{ margin: 0, fontSize: 14, fontWeight: 900 }}>Onaylanan anlaşmalarım</h2>
      <p style={{ margin: 0, fontSize: 12, color: "var(--muted)", lineHeight: 1.4 }}>
        Satıcının onayladığı teklifleriniz. İlanda iletişim bilgileri açılmıştır.
      </p>
      <div style={{ display: "grid", gap: 8 }}>
        {bids.map((b) => (
          <div
            key={b.id}
            className="card"
            style={{
              padding: 10,
              display: "grid",
              gridTemplateColumns: "minmax(0,1fr) auto",
              gap: 10,
              alignItems: "center",
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: "#065f46" }}>Sonuçlandı · Onaylandı</div>
              <Link href={`/ilan/${b.listing.id}`} style={{ fontWeight: 800, fontSize: 13 }}>
                {b.listing.title}
              </Link>
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                Teklifiniz: <strong className="price-bid">{formatTl(b.amount)}</strong>
              </div>
            </div>
            <Link href={`/ilan/${b.listing.id}`} className="btn-orange" style={{ padding: "6px 10px", fontSize: 12 }}>
              İlana Git
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}

function NotificationsPanel({
  items,
}: {
  items: Array<{
    id: string;
    title: string;
    body: string;
    link?: string | null;
    isRead: boolean;
    createdAt: string;
    eventKey?: string | null;
  }>;
}) {
  const search = useSearchParams();
  const grantId = search.get("grant");
  const [grantOpen, setGrantOpen] = useState(Boolean(grantId));
  const [editModalId, setEditModalId] = useState<string | null>(null);
  const { alert } = useDialog();
  const grantNotif = items.find(
    (n) =>
      (grantId && n.link?.includes(`grant=${grantId}`)) ||
      n.eventKey === "seller_edit_fields_granted"
  );
  const resolvedGrantId =
    grantId || (grantNotif?.link?.match(/grant=([^&]+)/)?.[1] ?? null);

  useEffect(() => {
    fetch("/api/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "read-all" }),
    }).then(() => window.dispatchEvent(new Event("teklifbu:auth")));
  }, []);

  useEffect(() => {
    if (grantId) setGrantOpen(true);
  }, [grantId]);

  function openEdit(id: string) {
    setGrantOpen(false);
    setEditModalId(id);
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <h2 style={{ margin: 0 }}>Bildirimler</h2>
        <Link
          href="/hesabim?s=bildirim-ayarlar"
          className="btn-outline"
          style={{ padding: "8px 12px", fontSize: 13 }}
        >
          Bildirim Ayarları
        </Link>
      </div>
      <div className="card" style={{ padding: 18, display: "grid", gap: 10 }}>
        {items.map((n) => {
          const isGrant =
            n.eventKey === "seller_edit_fields_granted" || (n.link || "").includes("grant=");
          const gId = n.link?.match(/grant=([^&]+)/)?.[1];
          return (
            <div
              key={n.id}
              style={{
                padding: "12px 14px",
                borderRadius: 12,
                background: n.isRead ? "#f8fafc" : "#fff7ed",
                border: "1px solid var(--line)",
              }}
            >
              <div style={{ fontWeight: 800, fontSize: 14 }}>{n.title}</div>
              <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 4, lineHeight: 1.45 }}>
                {n.body}
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginTop: 8,
                  fontSize: 12,
                  color: "#94a3b8",
                  gap: 8,
                  flexWrap: "wrap",
                }}
              >
                <span>{new Date(n.createdAt).toLocaleString("tr-TR")}</span>
                {isGrant && gId ? (
                  <button
                    type="button"
                    onClick={() => openEdit(gId)}
                    style={{
                      fontWeight: 800,
                      color: "var(--orange)",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      padding: 0,
                    }}
                  >
                    Düzenle
                  </button>
                ) : n.link ? (
                  <Link href={n.link} style={{ fontWeight: 700, color: "var(--orange)" }}>
                    Aç
                  </Link>
                ) : null}
              </div>
            </div>
          );
        })}
        {!items.length && <div style={{ color: "var(--muted)" }}>Bildirim yok.</div>}
      </div>

      {grantOpen && resolvedGrantId && !editModalId && (
        <div
          className="tb-dialog-backdrop"
          role="dialog"
          aria-modal="true"
          onClick={() => setGrantOpen(false)}
        >
          <div
            className="tb-dialog"
            style={{ textAlign: "left", width: "min(440px, 100%)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="tb-dialog-close"
              aria-label="Kapat"
              onClick={() => setGrantOpen(false)}
            >
              ×
            </button>
            <h3 className="tb-dialog-title">Düzenleme izni</h3>
            <p className="tb-dialog-message" style={{ textAlign: "left" }}>
              {grantNotif?.body ||
                "Yönetici belirli alanları düzenlemenize izin verdi. Yalnızca açılan bölümleri değiştirebilirsiniz."}
            </p>
            <div className="tb-dialog-actions" style={{ justifyContent: "flex-end" }}>
              <button
                type="button"
                className="tb-dialog-btn tb-dialog-btn-ghost"
                onClick={() => setGrantOpen(false)}
              >
                Sonra
              </button>
              <button
                type="button"
                className="tb-dialog-btn tb-dialog-btn-primary"
                onClick={() => openEdit(resolvedGrantId)}
              >
                Düzenle
              </button>
            </div>
          </div>
        </div>
      )}

      {editModalId && (
        <SellerGrantEditModal
          grantId={editModalId}
          onClose={() => setEditModalId(null)}
          onSubmitted={async () => {
            await alert({
              title: "Onaya gönderildi",
              message: "Değişiklikleriniz yönetici onayına düştü.",
              tone: "success",
            });
          }}
        />
      )}
    </div>
  );
}

function NotificationSettingsPanel({
  initialPrefs,
  events,
  offersEnabled = true,
}: {
  initialPrefs: Record<string, boolean>;
  events: Array<{ key: string; label: string; desc: string }>;
  offersEnabled?: boolean;
}) {
  const [prefs, setPrefs] = useState<Record<string, boolean>>(initialPrefs);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const { alert } = useDialog();

  const visibleEvents = offersEnabled
    ? events
    : events.filter((e) => (CLASSIFIED_NOTIFICATION_KEYS as readonly string[]).includes(e.key));

  useEffect(() => {
    setPrefs(initialPrefs);
  }, [initialPrefs]);

  async function save() {
    setSaving(true);
    setMsg("");
    const res = await fetch("/api/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "save-notification-prefs", prefs }),
    });
    const d = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      await alert({
        title: "Kaydedilemedi",
        message: d.error || "Bildirim ayarları güncellenemedi",
        tone: "danger",
      });
      return;
    }
    if (d.notificationPrefs) setPrefs(d.notificationPrefs);
    setMsg("Bildirim ayarlarınız kaydedildi.");
  }

  function toggle(key: string) {
    setPrefs((p) => ({ ...p, [key]: !p[key] }));
    setMsg("");
  }

  function setAll(value: boolean) {
    const next: Record<string, boolean> = { ...prefs };
    for (const e of visibleEvents) next[e.key] = value;
    setPrefs(next);
    setMsg("");
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div>
        <h2 style={{ margin: "0 0 4px" }}>Bildirim Ayarları</h2>
        <p style={{ margin: 0, fontSize: 14, color: "var(--muted)" }}>
          Hangi durumlarda bildirim almak istediğinizi seçin.
        </p>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" className="btn-outline" style={{ padding: "8px 12px", fontSize: 13 }} onClick={() => setAll(true)}>
          Tümünü aç
        </button>
        <button type="button" className="btn-outline" style={{ padding: "8px 12px", fontSize: 13 }} onClick={() => setAll(false)}>
          Tümünü kapat
        </button>
        <Link href="/hesabim?s=bildirimler" className="btn-outline" style={{ padding: "8px 12px", fontSize: 13 }}>
          Bildirimlere dön
        </Link>
      </div>

      <div className="card" style={{ padding: 8, display: "grid", gap: 0 }}>
        {visibleEvents.map((e) => {
          const on = prefs[e.key] !== false;
          return (
            <label
              key={e.key}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 14,
                padding: "14px 12px",
                borderBottom: "1px solid var(--line)",
                cursor: "pointer",
              }}
            >
              <span style={{ minWidth: 0 }}>
                <span style={{ display: "block", fontWeight: 800, fontSize: 14 }}>{e.label}</span>
                <span style={{ display: "block", fontSize: 12, color: "var(--muted)", marginTop: 3, lineHeight: 1.4 }}>
                  {e.desc}
                </span>
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={on}
                onClick={() => toggle(e.key)}
                style={{
                  width: 48,
                  height: 28,
                  borderRadius: 999,
                  border: "none",
                  cursor: "pointer",
                  background: on ? "var(--orange)" : "#e2e8f0",
                  position: "relative",
                  flexShrink: 0,
                  transition: "background .15s",
                }}
              >
                <span
                  style={{
                    position: "absolute",
                    top: 3,
                    left: on ? 23 : 3,
                    width: 22,
                    height: 22,
                    borderRadius: "50%",
                    background: "#fff",
                    boxShadow: "0 1px 4px rgba(0,0,0,.2)",
                    transition: "left .15s",
                  }}
                />
              </button>
            </label>
          );
        })}
        {!visibleEvents.length && (
          <div style={{ padding: 16, color: "var(--muted)" }}>Ayar seçenekleri yüklenemedi.</div>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <button
          type="button"
          className="btn-orange"
          style={{ padding: "12px 18px" }}
          disabled={saving}
          onClick={save}
        >
          {saving ? "Kaydediliyor..." : "Ayarları Kaydet"}
        </button>
        {msg && <span style={{ fontSize: 13, fontWeight: 700, color: "var(--green)" }}>{msg}</span>}
      </div>
    </div>
  );
}

type MyListing = ListingCardData & {
  status?: string;
  rejectionReason?: string | null;
  endsAt?: string | Date | null;
  durationDays?: number;
  approvedBidId?: string | null;
  pendingExtension?: { id: string; days: number; createdAt: string } | null;
  pendingEdit?: { id: string; createdAt: string } | null;
};

function MyListingsPanel({
  listings: initial,
  allowLiveEdit = true,
  aiEnabled = false,
  isCommercial = false,
  onRefresh,
}: {
  listings: MyListing[];
  allowLiveEdit?: boolean;
  aiEnabled?: boolean;
  isCommercial?: boolean;
  onRefresh?: () => void;
}) {
  const [listings, setListings] = useState(initial);
  const [tab, setTab] = useState<"live" | "offline">("live");
  const [bulkOpen, setBulkOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [extendFor, setExtendFor] = useState<MyListing | null>(null);
  const [extendDays, setExtendDays] = useState<(typeof EXTENSION_DAY_OPTIONS)[number]>(7);
  const [extendMsg, setExtendMsg] = useState("");
  const [editBlockedFor, setEditBlockedFor] = useState<MyListing | null>(null);
  const [contactOpen, setContactOpen] = useState(false);
  const [contactMsg, setContactMsg] = useState("");
  const [contactBusy, setContactBusy] = useState(false);
  const [contactFeedback, setContactFeedback] = useState("");
  const { confirm, alert } = useDialog();

  useEffect(() => {
    setListings(initial);
  }, [initial]);

  const live = useMemo(() => listings.filter((l) => isLiveListingStatus(l.status)), [listings]);
  const offline = useMemo(() => listings.filter((l) => !isLiveListingStatus(l.status)), [listings]);
  const items = tab === "live" ? live : offline;

  async function unpublish(id: string) {
    const ok = await confirm({
      title: "İlandan kaldır",
      message: "İlan yayından kaldırılsın mı? İsterseniz daha sonra düzenleyip tekrar yayınlayabilirsiniz.",
      confirmLabel: "Kaldır",
      cancelLabel: "Vazgeç",
      tone: "warning",
    });
    if (!ok) return;
    setBusyId(id);
    setError("");
    const res = await fetch(`/api/listings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "unpublish" }),
    });
    const data = await res.json().catch(() => ({}));
    setBusyId(null);
    if (!res.ok) {
      setError(data.error || "İlandan kaldırılamadı");
      return;
    }
    setListings((prev) => prev.map((l) => (l.id === id ? { ...l, status: "ARCHIVED" } : l)));
    setTab("offline");
  }

  async function remove(id: string) {
    const listing = listings.find((x) => x.id === id);
    if (!canSellerDeleteListing(listing?.status)) {
      await alert({
        title: "Silinemez",
        message: "Sonuçlanan ilanlar silinemez.",
        tone: "warning",
      });
      return;
    }
    const ok = await confirm({
      title: "İlanı sil",
      message: "İlan kalıcı olarak silinsin mi? Bu işlem geri alınamaz.",
      confirmLabel: "Sil",
      cancelLabel: "Vazgeç",
      tone: "danger",
    });
    if (!ok) return;
    setBusyId(id);
    setError("");
    const res = await fetch(`/api/listings/${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    setBusyId(null);
    if (!res.ok) {
      setError(data.error || "Silinemedi");
      return;
    }
    if (data.softDeleted) {
      setListings((prev) =>
        prev.map((l) => (l.id === id ? { ...l, status: "ARCHIVED" } : l))
      );
      setTab("offline");
      return;
    }
    setListings((prev) => prev.filter((l) => l.id !== id));
  }

  async function submitAdminContact() {
    if (!editBlockedFor) return;
    const message = contactMsg.trim();
    if (message.length < 10) {
      setContactFeedback("Mesajınız en az 10 karakter olmalıdır.");
      return;
    }
    setContactBusy(true);
    setContactFeedback("");
    const res = await fetch(`/api/listings/${editBlockedFor.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "request-admin-edit-help", message }),
    });
    const data = await res.json().catch(() => ({}));
    setContactBusy(false);
    if (!res.ok) {
      setContactFeedback(data.error || "Mesaj gönderilemedi");
      return;
    }
    setContactFeedback("");
    setContactMsg("");
    setContactOpen(false);
    setEditBlockedFor(null);
    await alert({
      title: "Mesaj iletildi",
      message: "Talebiniz yönetici paneline düştü. En kısa sürede incelenecektir.",
      tone: "success",
    });
  }

  async function submitExtension() {
    if (!extendFor) return;
    setBusyId(extendFor.id);
    setExtendMsg("");
    setError("");
    const res = await fetch(`/api/listings/${extendFor.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "request-extension", days: extendDays }),
    });
    const data = await res.json().catch(() => ({}));
    setBusyId(null);
    if (!res.ok) {
      setExtendMsg(data.error || "Talep gönderilemedi");
      return;
    }
    setListings((prev) =>
      prev.map((l) =>
        l.id === extendFor.id
          ? {
              ...l,
              pendingExtension: {
                id: data.requestId,
                days: extendDays,
                createdAt: new Date().toISOString(),
              },
            }
          : l
      )
    );
    setExtendFor(null);
    setError("");
    setExtendMsg("");
  }

  return (
    <div className="my-listings-panel">
      {aiEnabled && (
        <Link
          href="/hesabim?s=ai-ilan"
          className="card"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "14px 16px",
            marginBottom: 12,
            textDecoration: "none",
            background: "linear-gradient(110deg, #fff7ed 0%, #fff 55%)",
            border: "1px solid #fed7aa",
          }}
        >
          <span
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: "rgba(255,102,0,.12)",
              display: "grid",
              placeItems: "center",
              color: "var(--orange)",
            }}
          >
            <Sparkles size={20} />
          </span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <strong style={{ display: "block", fontSize: 14, color: "#0f172a" }}>AI ile ilan ekle</strong>
            <span style={{ fontSize: 12.5, color: "var(--muted)" }}>
              Ekran görüntüsünden ilan bilgilerini oku, forma aktar
            </span>
          </span>
        </Link>
      )}
      <div className="my-listings-tabs">
        <button
          type="button"
          className={tab === "live" && !bulkOpen ? "my-listings-tab active" : "my-listings-tab"}
          onClick={() => {
            setBulkOpen(false);
            setTab("live");
          }}
        >
          Yayındaki ilanlarım ({live.length})
        </button>
        <button
          type="button"
          className={tab === "offline" && !bulkOpen ? "my-listings-tab active" : "my-listings-tab"}
          onClick={() => {
            setBulkOpen(false);
            setTab("offline");
          }}
        >
          Yayında olmayan ilanlarım ({offline.length})
        </button>
        {isCommercial ? (
          <button
            type="button"
            className={bulkOpen ? "my-listings-tab active" : "my-listings-tab"}
            onClick={() => setBulkOpen((v) => !v)}
          >
            Toplu güncelle
          </button>
        ) : null}
      </div>

      {isCommercial && bulkOpen ? (
        <CommercialBulkListingUpdate
          listings={listings}
          embedded
          onSubmitted={() => {
            setBulkOpen(false);
            onRefresh?.();
          }}
        />
      ) : null}

      {!bulkOpen ? (
        <>
      {error && <div style={{ color: "#dc2626", fontWeight: 600, fontSize: 13 }}>{error}</div>}

      <div className="my-listings-list">
        {items.map((l) => (
          <div key={l.id} className="my-listing-item">
            <div className="my-listing-row">
              <div className="my-listing-row-card">
                <ListingCard listing={l} variant="row" />
              </div>
              <div className="card my-listing-actions">
                <div
                  className="my-listing-status"
                  style={{
                    color:
                      l.status === "REJECTED"
                        ? "#b91c1c"
                        : l.status === "PENDING_REVIEW"
                          ? "#c2410c"
                          : "#64748b",
                  }}
                >
                  {listingStatusLabel(l.status)}
                  {l.pendingExtension ? ` · +${l.pendingExtension.days}g onay bekliyor` : ""}
                  {l.pendingEdit ? " · Düzenleme onayı bekliyor" : ""}
                </div>
                {canSellerEditListing(l.status, { allowLiveEdit }) ? (
                  listingHasBids(l) ? (
                    <button
                      type="button"
                      className="btn-outline my-listing-btn"
                      onClick={() => {
                        setContactOpen(false);
                        setContactMsg("");
                        setContactFeedback("");
                        setEditBlockedFor(l);
                      }}
                      style={{ opacity: 0.55 }}
                      title="Teklif alan ilan düzenlenemez"
                    >
                      Düzenle
                    </button>
                  ) : (
                    <Link href={`/ilan-ver?edit=${l.id}`} className="btn-outline my-listing-btn">
                      {l.pendingEdit ? "Düzenlemeyi Güncelle" : "Düzenle"}
                    </Link>
                  )
                ) : (
                  <button
                    type="button"
                    className="btn-outline my-listing-btn"
                    disabled
                    title="Düzenlemek için önce ilandan kaldırın"
                  >
                    Düzenle
                  </button>
                )}
                {canRequestListingExtension(l.status, {
                  endsAt: l.endsAt,
                  approvedBidId: l.approvedBidId,
                }) && (
                  <button
                    type="button"
                    className="btn-outline my-listing-btn"
                    disabled={busyId === l.id || !!l.pendingExtension}
                    onClick={() => {
                      setExtendDays(7);
                      setExtendMsg("");
                      setExtendFor(l);
                    }}
                    title={
                      l.pendingExtension
                        ? "Bekleyen ek süre talebiniz var"
                        : "Ek süre talep et (yönetici onayı)"
                    }
                  >
                    {l.pendingExtension ? "Ek Süre Bekliyor" : "Ek Süre"}
                  </button>
                )}
                <button
                  type="button"
                  className="btn-outline my-listing-btn"
                  disabled={busyId === l.id || !canSellerUnpublishListing(l.status)}
                  onClick={() => unpublish(l.id)}
                  title={
                    !canSellerUnpublishListing(l.status)
                      ? l.status === "APPROVED"
                        ? "Sonuçlanan ilan kaldırılamaz"
                        : "İlan zaten yayında değil"
                      : undefined
                  }
                >
                  İlandan Kaldır
                </button>
                <button
                  type="button"
                  className="btn-outline my-listing-btn my-listing-btn-danger"
                  disabled={busyId === l.id || !canSellerDeleteListing(l.status)}
                  onClick={() => remove(l.id)}
                  title={
                    !canSellerDeleteListing(l.status)
                      ? "Sonuçlanan ilanlar silinemez"
                      : undefined
                  }
                >
                  Sil
                </button>
              </div>
            </div>
            {l.status === "REJECTED" && l.rejectionReason && (
              <div className="my-listing-reject">Red sebebi: {l.rejectionReason}</div>
            )}
          </div>
        ))}
        {!items.length && (
          <div className="card" style={{ padding: 14, fontSize: 14 }}>
            {tab === "live" ? "Yayında ilanınız yok." : "Yayında olmayan ilanınız yok."}
          </div>
        )}
      </div>
        </>
      ) : null}

      {extendFor && (
        <div
          className="tb-dialog-backdrop"
          role="dialog"
          aria-modal="true"
          onClick={() => (busyId === extendFor.id ? null : setExtendFor(null))}
        >
          <div className="tb-dialog" style={{ textAlign: "left", width: "min(440px, 100%)" }} onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="tb-dialog-close"
              aria-label="Kapat"
              disabled={busyId === extendFor.id}
              onClick={() => setExtendFor(null)}
            >
              ×
            </button>
            <h3 className="tb-dialog-title" style={{ textAlign: "left", paddingRight: 28 }}>
              Ek süre talep et
            </h3>
            <p className="tb-dialog-message" style={{ textAlign: "left" }}>
              <strong>{extendFor.title}</strong> için süre uzatması isteyin. Talep yönetici onayına düşer.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 18 }}>
              {EXTENSION_DAY_OPTIONS.map((d) => (
                <button
                  key={d}
                  type="button"
                  className={extendDays === d ? "tb-dialog-btn tb-dialog-btn-primary" : "tb-dialog-btn tb-dialog-btn-ghost"}
                  style={{ minWidth: 0, padding: "10px 6px" }}
                  onClick={() => setExtendDays(d)}
                  disabled={busyId === extendFor.id}
                >
                  {d} gün
                </button>
              ))}
            </div>
            {extendMsg && (
              <div style={{ color: "#dc2626", fontWeight: 600, fontSize: 13, marginBottom: 12 }}>
                {extendMsg}
              </div>
            )}
            <div className="tb-dialog-actions" style={{ justifyContent: "flex-end" }}>
              <button
                type="button"
                className="tb-dialog-btn tb-dialog-btn-ghost"
                disabled={busyId === extendFor.id}
                onClick={() => setExtendFor(null)}
              >
                Vazgeç
              </button>
              <button
                type="button"
                className="tb-dialog-btn tb-dialog-btn-primary"
                disabled={busyId === extendFor.id}
                onClick={submitExtension}
              >
                Talep Gönder
              </button>
            </div>
          </div>
        </div>
      )}

      {editBlockedFor && (
        <div
          className="tb-dialog-backdrop"
          role="dialog"
          aria-modal="true"
          onClick={() => (contactBusy ? null : setEditBlockedFor(null))}
        >
          <div
            className="tb-dialog"
            style={{ textAlign: "left", width: "min(460px, 100%)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="tb-dialog-close"
              aria-label="Kapat"
              disabled={contactBusy}
              onClick={() => setEditBlockedFor(null)}
            >
              <X size={16} />
            </button>
            <div
              className="tb-dialog-icon"
              style={{
                background: "linear-gradient(145deg, #ffedd5, #fed7aa)",
                color: "#c2410c",
              }}
            >
              <MessageSquareWarning size={22} strokeWidth={2.25} />
            </div>
            <h3 className="tb-dialog-title">Düzenleme yapılamaz</h3>
            <p className="tb-dialog-message">
              İlanınıza teklif geldiği için düzenleme yapamazsınız. Yayındaki içerik teklif verenler
              için korunur.
            </p>

            {!contactOpen ? (
              <div className="tb-dialog-actions" style={{ flexWrap: "wrap" }}>
                <button
                  type="button"
                  className="tb-dialog-btn tb-dialog-btn-ghost"
                  onClick={() => setEditBlockedFor(null)}
                >
                  Tamam
                </button>
                <button
                  type="button"
                  className="tb-dialog-btn tb-dialog-btn-warning"
                  onClick={() => setContactOpen(true)}
                >
                  Yönetici ile iletişime geç
                </button>
              </div>
            ) : (
              <div style={{ display: "grid", gap: 12, marginTop: 4 }}>
                <p style={{ margin: 0, fontSize: 13, color: "var(--muted)", lineHeight: 1.5 }}>
                  İlanda hâlâ değişiklik yapmak istiyorsanız yöneticiye kısa bir mesaj yazın. Talep
                  admin paneline düşer.
                </p>
                <textarea
                  className="input"
                  rows={4}
                  placeholder="Örn: Fiyat ve açıklamayı güncellemem gerekiyor çünkü..."
                  value={contactMsg}
                  onChange={(e) => setContactMsg(e.target.value)}
                  disabled={contactBusy}
                />
                {contactFeedback && (
                  <div style={{ color: "#dc2626", fontWeight: 600, fontSize: 13 }}>
                    {contactFeedback}
                  </div>
                )}
                <div className="tb-dialog-actions" style={{ justifyContent: "flex-end" }}>
                  <button
                    type="button"
                    className="tb-dialog-btn tb-dialog-btn-ghost"
                    disabled={contactBusy}
                    onClick={() => setContactOpen(false)}
                  >
                    Geri
                  </button>
                  <button
                    type="button"
                    className="tb-dialog-btn tb-dialog-btn-primary"
                    disabled={contactBusy}
                    onClick={submitAdminContact}
                  >
                    {contactBusy ? "Gönderiliyor..." : "Mesajı Gönder"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function FavoritesPanel() {
  const [items, setItems] = useState<ListingCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const { view, changeView } = useListingView("teklifbu:favorites-view", "grid");

  async function load() {
    setLoading(true);
    const res = await fetch("/api/favorites");
    if (res.ok) {
      const d = await res.json();
      setItems((d.items || []).map((x: any) => ({ ...x.listing, isFavorited: true })));
    } else {
      setItems([]);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
    function onFav() {
      load();
    }
    window.addEventListener("teklifbu:favorites", onFav);
    return () => window.removeEventListener("teklifbu:favorites", onFav);
  }, []);

  if (loading) {
    return <div className="card" style={{ padding: 18 }}>Yükleniyor...</div>;
  }

  return (
    <div className="favorites-panel" style={{ display: "grid", gap: 12 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ fontSize: 14, color: "var(--muted)" }}>
          {items.length ? `${items.length} favori ilan` : "Henüz favori ilan yok."}
        </div>
        <ListingViewToggle view={view} onChange={changeView} />
      </div>

      <div
        style={
          view === "grid"
            ? { display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 14 }
            : { display: "grid", gap: 10 }
        }
      >
        {items.map((l) => (
          <ListingCard
            key={l.id}
            listing={l}
            variant={view === "list" ? "row" : "grid"}
            onFavoriteChange={(id, favorited) => {
              if (!favorited) setItems((prev) => prev.filter((x) => x.id !== id));
            }}
          />
        ))}
        {!items.length && (
          <div className="card" style={{ padding: 18, gridColumn: "1 / -1" }}>
            Favori ilan yok.
          </div>
        )}
      </div>
    </div>
  );
}

function escrowStatusLabel(status?: string) {
  switch (status) {
    case "AWAITING_PAYMENT":
      return "Ödeme bekleniyor";
    case "FUNDED":
      return "Ödeme alındı";
    case "AWAITING_SHIPMENT":
      return "Kargo bekleniyor";
    case "SHIPPED":
      return "Kargoya verildi";
    case "BUYER_REVIEW":
      return "Teslim onayı bekleniyor";
    case "RELEASED":
      return "Tamamlandı · Ödendi";
    case "REFUNDED":
      return "İade edildi";
    case "DISPUTED":
      return "Anlaşmazlık";
    case "CANCELLED":
      return "İptal edildi";
    case "EXPIRED":
      return "Süresi doldu";
    default:
      return status || "—";
  }
}

function EscrowDealsPanel() {
  const [deals, setDeals] = useState<any[]>([]);
  const [meId, setMeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [cargoForm, setCargoForm] = useState<{
    dealId: string;
    trackingNo: string;
    carrier: string;
    receiptUrl: string;
  } | null>(null);
  const [disputeFor, setDisputeFor] = useState<{ dealId: string; reason: string } | null>(null);
  const { alert, confirm } = useDialog();

  async function load() {
    setLoading(true);
    const [dealsRes, authRes] = await Promise.all([fetch("/api/escrow"), fetch("/api/auth")]);
    const dealsData = await dealsRes.json().catch(() => ({}));
    const authData = await authRes.json().catch(() => ({}));
    setDeals(dealsData.deals || []);
    setMeId(authData.user?.id || null);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submitCargo() {
    if (!cargoForm) return;
    if (!cargoForm.trackingNo.trim()) {
      setError("Kargo takip numarası gerekli");
      return;
    }
    setBusyId(cargoForm.dealId);
    setError("");
    const res = await fetch("/api/escrow", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "submit-cargo",
        dealId: cargoForm.dealId,
        trackingNo: cargoForm.trackingNo,
        carrier: cargoForm.carrier,
        receiptUrl: cargoForm.receiptUrl,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setBusyId(null);
    if (!res.ok) {
      setError(data.error || "Kargo bilgisi kaydedilemedi");
      return;
    }
    setCargoForm(null);
    await load();
  }

  async function confirmReceipt(dealId: string) {
    const ok = await confirm({
      title: "Teslim aldığınızı onaylıyor musunuz?",
      message: "Onayladığınızda ödeme satıcıya aktarılır. Bu işlem geri alınamaz.",
      confirmLabel: "Onayla",
      cancelLabel: "Vazgeç",
      tone: "info",
    });
    if (!ok) return;
    setBusyId(dealId);
    const res = await fetch("/api/escrow", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "confirm", dealId }),
    });
    const data = await res.json().catch(() => ({}));
    setBusyId(null);
    if (!res.ok) {
      await alert({ title: "İşlem başarısız", message: data.error || "Onaylanamadı", tone: "danger" });
      return;
    }
    await load();
  }

  async function submitDispute() {
    if (!disputeFor) return;
    if (!disputeFor.reason.trim()) {
      setError("Anlaşmazlık sebebi gerekli");
      return;
    }
    setBusyId(disputeFor.dealId);
    setError("");
    const res = await fetch("/api/escrow", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "dispute", dealId: disputeFor.dealId, reason: disputeFor.reason }),
    });
    const data = await res.json().catch(() => ({}));
    setBusyId(null);
    if (!res.ok) {
      setError(data.error || "Gönderilemedi");
      return;
    }
    setDisputeFor(null);
    await load();
  }

  if (loading) {
    return (
      <div className="card" style={{ padding: 18 }}>
        Yükleniyor...
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div>
        <h2 style={{ margin: "0 0 4px" }}>Güvenli Öde</h2>
        <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>
          Alıcı veya satıcı olarak yer aldığınız Güvenli Öde işlemleri.
        </p>
      </div>

      {error && <div style={{ color: "#dc2626", fontWeight: 600, fontSize: 13 }}>{error}</div>}

      <div className="card" style={{ padding: 0 }}>
        {deals.map((d) => {
          const isBuyer = d.buyerId === meId;
          const isSeller = d.sellerId === meId;
          return (
            <div
              key={d.id}
              style={{ padding: 14, borderBottom: "1px solid var(--line)", display: "grid", gap: 10 }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <div style={{ minWidth: 0 }}>
                  {(() => {
                    const item = d.linkedOrder?.items?.[0];
                    const title =
                      d.listing?.title ||
                      (item?.productNameSnapshot
                        ? `${item.productNameSnapshot}${
                            item.variantTitleSnapshot ? ` · ${item.variantTitleSnapshot}` : ""
                          }`
                        : null) ||
                      (d.sellerOffer?.product?.name
                        ? `${d.sellerOffer.product.name}${
                            d.sellerOffer.variant?.title ? ` · ${d.sellerOffer.variant.title}` : ""
                          }`
                        : null) ||
                      (d.linkedOrder?.orderNo ? `Sipariş ${d.linkedOrder.orderNo}` : "Katalog sipariş");
                    const href = d.listing?.id
                      ? `/ilan/${d.listing.id}`
                      : item?.productId || d.sellerOffer?.product?.id
                        ? `/urun/${item?.productId || d.sellerOffer.product.id}`
                        : null;
                    return href ? (
                      <Link href={href} style={{ fontWeight: 800, fontSize: 14 }}>
                        {title}
                      </Link>
                    ) : (
                      <span style={{ fontWeight: 800, fontSize: 14 }}>{title}</span>
                    );
                  })()}
                  <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                    {isBuyer ? "Alıcı" : isSeller ? "Satıcı" : ""} ·{" "}
                    {new Date(d.createdAt).toLocaleDateString("tr-TR")}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div className="price-bid">{formatTl(d.amountTl)}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#c2410c" }}>
                    {escrowStatusLabel(d.status)}
                  </div>
                </div>
              </div>

              {d.status === "AWAITING_SHIPMENT" &&
                isSeller &&
                (cargoForm && cargoForm.dealId === d.id ? (
                  <div style={{ display: "grid", gap: 8, background: "#f8fafc", borderRadius: 10, padding: 12 }}>
                    <input
                      className="input"
                      placeholder="Kargo takip no *"
                      value={cargoForm.trackingNo}
                      onChange={(e) => setCargoForm({ ...cargoForm, trackingNo: e.target.value })}
                    />
                    <input
                      className="input"
                      placeholder="Kargo firması"
                      value={cargoForm.carrier}
                      onChange={(e) => setCargoForm({ ...cargoForm, carrier: e.target.value })}
                    />
                    <input
                      className="input"
                      placeholder="Fiş / fatura görsel URL (opsiyonel)"
                      value={cargoForm.receiptUrl}
                      onChange={(e) => setCargoForm({ ...cargoForm, receiptUrl: e.target.value })}
                    />
                    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                      <button
                        type="button"
                        className="btn-outline"
                        style={{ padding: "8px 12px" }}
                        disabled={busyId === d.id}
                        onClick={() => setCargoForm(null)}
                      >
                        Vazgeç
                      </button>
                      <button
                        type="button"
                        className="btn-orange"
                        style={{ padding: "8px 12px" }}
                        disabled={busyId === d.id}
                        onClick={submitCargo}
                      >
                        {busyId === d.id ? "Kaydediliyor..." : "Kargo bilgisini gönder"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="btn-orange"
                    style={{ padding: "8px 12px", width: "fit-content" }}
                    onClick={() => {
                      setError("");
                      setCargoForm({ dealId: d.id, trackingNo: "", carrier: "", receiptUrl: "" });
                    }}
                  >
                    Kargo bilgisi gir
                  </button>
                ))}

              {d.status === "BUYER_REVIEW" &&
                isBuyer &&
                (disputeFor && disputeFor.dealId === d.id ? (
                  <div style={{ display: "grid", gap: 8, background: "#fef2f2", borderRadius: 10, padding: 12 }}>
                    <textarea
                      className="input"
                      rows={3}
                      placeholder="Anlaşmazlık sebebi *"
                      value={disputeFor.reason}
                      onChange={(e) => setDisputeFor({ ...disputeFor, reason: e.target.value })}
                    />
                    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                      <button
                        type="button"
                        className="btn-outline"
                        style={{ padding: "8px 12px" }}
                        disabled={busyId === d.id}
                        onClick={() => setDisputeFor(null)}
                      >
                        Vazgeç
                      </button>
                      <button
                        type="button"
                        className="btn-orange"
                        style={{ padding: "8px 12px", background: "#dc2626", borderColor: "#dc2626" }}
                        disabled={busyId === d.id}
                        onClick={submitDispute}
                      >
                        {busyId === d.id ? "Gönderiliyor..." : "Anlaşmazlığı Gönder"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      className="btn-orange"
                      style={{ padding: "8px 12px" }}
                      disabled={busyId === d.id}
                      onClick={() => confirmReceipt(d.id)}
                    >
                      Teslim Aldım, Onayla
                    </button>
                    <button
                      type="button"
                      className="btn-outline"
                      style={{ padding: "8px 12px", color: "#b91c1c", borderColor: "#fecaca" }}
                      disabled={busyId === d.id}
                      onClick={() => {
                        setError("");
                        setDisputeFor({ dealId: d.id, reason: "" });
                      }}
                    >
                      Anlaşmazlık Bildir
                    </button>
                  </div>
                ))}

              {d.status === "AWAITING_SHIPMENT" && isBuyer && (
                <div style={{ fontSize: 12, color: "var(--muted)" }}>
                  Satıcının ürünü kargoya vermesi bekleniyor.
                </div>
              )}
              {d.status === "BUYER_REVIEW" && isSeller && (
                <div style={{ fontSize: 12, color: "var(--muted)" }}>
                  Kargo takip no: {d.cargoTrackingNo || "—"} · Alıcının teslim onayı bekleniyor.
                </div>
              )}
              {d.status === "DISPUTED" && (
                <div style={{ fontSize: 12, color: "#b91c1c" }}>Bu işlem yönetici incelemesinde.</div>
              )}
            </div>
          );
        })}
        {!deals.length && (
          <div style={{ padding: 18, color: "var(--muted)", fontSize: 14 }}>
            Henüz Güvenli Öde işleminiz yok.
          </div>
        )}
      </div>
    </div>
  );
}

function MessagesPanel() {
  const search = useSearchParams();
  const peerId = search.get("to") || "";
  const listingId = search.get("listingId") || "";
  const [meId, setMeId] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [canSend, setCanSend] = useState(false);
  const [access, setAccess] = useState<"approved" | "everyone">("approved");
  const [approved, setApproved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [peerName, setPeerName] = useState("");
  const [listingTitle, setListingTitle] = useState("");
  const [activePeer, setActivePeer] = useState(peerId);
  const [activeListing, setActiveListing] = useState(listingId);

  async function loadInbox() {
    const res = await fetch("/api/messages");
    if (!res.ok) return;
    const d = await res.json();
    setMessages(d.messages || []);
    setCanSend(Boolean(d.canSend));
    setAccess(d.access === "everyone" ? "everyone" : "approved");
    setApproved(Boolean(d.approved));
  }

  async function loadThread(peer: string, lid: string) {
    if (!peer) return;
    const q = new URLSearchParams({ peerId: peer });
    if (lid) q.set("listingId", lid);
    const res = await fetch(`/api/messages?${q}`);
    if (!res.ok) return;
    const d = await res.json();
    setMessages(d.messages || []);
    setCanSend(Boolean(d.canSend));
    setAccess(d.access === "everyone" ? "everyone" : "approved");
    setApproved(Boolean(d.approved));
    const sample = (d.messages || [])[0];
    if (sample) {
      const other = sample.senderId === meId ? sample.receiver : sample.sender;
      setPeerName(other?.name || "Üye");
      setListingTitle(sample.listing?.title || "");
    }
  }

  useEffect(() => {
    fetch("/api/auth")
      .then((r) => r.json())
      .then((d) => setMeId(d.user?.id || null));
  }, []);

  useEffect(() => {
    if (listingId && !listingTitle) {
      fetch(`/api/listings?id=${encodeURIComponent(listingId)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (d?.listing?.title) setListingTitle(d.listing.title);
          if (d?.listing?.seller?.name) setPeerName(d.listing.seller.name);
        })
        .catch(() => {});
    }
  }, [listingId, listingTitle]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      if (activePeer) {
        await loadThread(activePeer, activeListing);
      } else {
        await loadInbox();
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePeer, activeListing, meId]);

  useEffect(() => {
    setActivePeer(peerId);
    setActiveListing(listingId);
  }, [peerId, listingId]);

  const threads = useMemo(() => {
    if (activePeer || !meId) return [];
    const map = new Map<
      string,
      { key: string; peerId: string; peerName: string; listingId: string | null; listingTitle: string; lastBody: string; lastAt: string; unread: number }
    >();
    for (const m of messages) {
      const other = m.senderId === meId ? m.receiver : m.sender;
      if (!other?.id) continue;
      const lid = m.listingId || m.listing?.id || "";
      const key = `${other.id}::${lid}`;
      const prev = map.get(key);
      const unreadAdd = m.receiverId === meId && !m.isRead ? 1 : 0;
      if (!prev) {
        map.set(key, {
          key,
          peerId: other.id,
          peerName: other.name || "Üye",
          listingId: lid || null,
          listingTitle: m.listing?.title || "Genel",
          lastBody: m.body,
          lastAt: m.createdAt,
          unread: unreadAdd,
        });
      } else if (new Date(m.createdAt) > new Date(prev.lastAt)) {
        prev.lastBody = m.body;
        prev.lastAt = m.createdAt;
        prev.unread += unreadAdd;
      } else {
        prev.unread += unreadAdd;
      }
    }
    return Array.from(map.values()).sort(
      (a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime()
    );
  }, [messages, activePeer, meId]);

  async function send() {
    if (!activePeer || !text.trim()) return;
    setSending(true);
    setError("");
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          receiverId: activePeer,
          listingId: activeListing || null,
          body: text.trim(),
        }),
      });
      const d = await res.json();
      if (!res.ok) {
        setError(d.error || "Gönderilemedi");
        return;
      }
      setText("");
      await loadThread(activePeer, activeListing);
    } finally {
      setSending(false);
    }
  }

  if (loading && !messages.length && !activePeer) {
    return (
      <div className="card" style={{ padding: 18, color: "var(--muted)" }}>
        Mesajlar yükleniyor…
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: 18, display: "grid", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <h2 style={{ margin: 0 }}>Mesajlar</h2>
        {activePeer && (
          <button
            type="button"
            className="btn-outline"
            style={{ padding: "8px 12px", fontSize: 13 }}
            onClick={() => {
              setActivePeer("");
              setActiveListing("");
              window.history.replaceState(null, "", "/hesabim?s=mesajlar");
            }}
          >
            ← Gelen kutusu
          </button>
        )}
      </div>

      {!canSend && activePeer && (
        <div
          style={{
            background: "#fff7ed",
            border: "1px solid #fed7aa",
            borderRadius: 10,
            padding: 12,
            fontSize: 13,
            color: "#9a3412",
            lineHeight: 1.45,
          }}
        >
          {access === "approved" && !approved
            ? "Mesaj göndermek için bu ilandaki teklifinizin onaylanmış olması gerekir."
            : "Mesaj gönderme şu an kapalı."}
        </div>
      )}

      {!activePeer ? (
        <div style={{ display: "grid", gap: 8 }}>
          {threads.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => {
                setActivePeer(t.peerId);
                setActiveListing(t.listingId || "");
                setPeerName(t.peerName);
                setListingTitle(t.listingTitle);
                const q = new URLSearchParams({ s: "mesajlar", to: t.peerId });
                if (t.listingId) q.set("listingId", t.listingId);
                window.history.replaceState(null, "", `/hesabim?${q}`);
              }}
              style={{
                textAlign: "left",
                border: "1px solid var(--line)",
                borderRadius: 12,
                padding: "12px 14px",
                background: t.unread ? "#fff7ed" : "#fff",
                cursor: "pointer",
                display: "grid",
                gap: 4,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <strong style={{ fontSize: 14 }}>{t.peerName}</strong>
                <span style={{ fontSize: 11, color: "var(--muted)" }}>
                  {new Date(t.lastAt).toLocaleString("tr-TR")}
                </span>
              </div>
              <div style={{ fontSize: 12, color: "var(--muted)" }}>{t.listingTitle}</div>
              <div style={{ fontSize: 13, color: "#334155" }}>{t.lastBody}</div>
            </button>
          ))}
          {!threads.length && <div style={{ color: "var(--muted)" }}>Henüz mesaj yok.</div>}
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ fontSize: 13, color: "var(--muted)" }}>
            <strong style={{ color: "#0f172a" }}>{peerName || "Üye"}</strong>
            {listingTitle ? ` · ${listingTitle}` : ""}
          </div>
          <div
            style={{
              display: "grid",
              gap: 8,
              maxHeight: 360,
              overflow: "auto",
              padding: 10,
              background: "#f8fafc",
              borderRadius: 12,
              border: "1px solid #e2e8f0",
            }}
          >
            {messages.map((m) => {
              const mine = m.senderId === meId;
              return (
                <div
                  key={m.id}
                  style={{
                    justifySelf: mine ? "end" : "start",
                    maxWidth: "85%",
                    background: mine ? "#ffedd5" : "#fff",
                    border: "1px solid #e2e8f0",
                    borderRadius: 12,
                    padding: "8px 12px",
                  }}
                >
                  <div style={{ fontSize: 14, whiteSpace: "pre-wrap", lineHeight: 1.45 }}>{m.body}</div>
                  <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
                    {new Date(m.createdAt).toLocaleString("tr-TR")}
                  </div>
                </div>
              );
            })}
            {!messages.length && (
              <div style={{ color: "var(--muted)", fontSize: 13 }}>Henüz yazışma yok. İlk mesajı siz gönderin.</div>
            )}
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            <textarea
              className="input"
              style={{ minHeight: 90, resize: "vertical" }}
              placeholder={canSend ? "Mesajınızı yazın…" : "Mesaj gönderme yetkiniz yok"}
              value={text}
              disabled={!canSend || sending}
              onChange={(e) => setText(e.target.value)}
            />
            {error && <div style={{ color: "#b91c1c", fontSize: 13, fontWeight: 600 }}>{error}</div>}
            <button
              type="button"
              className="btn-orange"
              style={{ padding: 12, fontWeight: 800 }}
              disabled={!canSend || sending || !text.trim()}
              onClick={send}
            >
              {sending ? "Gönderiliyor…" : "Gönder"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

type ProfileFieldUi = {
  key: string;
  label: string;
  type: string;
  group: string;
  groupLabel: string;
  placeholder?: string;
  readOnly?: boolean;
  required?: boolean;
  hint?: string;
  maxLength?: number | null;
};

function AccountSettings({
  user,
  profileFields,
  onSaved,
  requireSellerIban = false,
}: {
  user: any;
  profileFields: ProfileFieldUi[];
  onSaved: () => void | Promise<void>;
  requireSellerIban?: boolean;
}) {
  const profile = user?.profile || {};
  const [values, setValues] = useState<Record<string, string>>(() => ({
    firstName: profile.firstName || "",
    lastName: profile.lastName || "",
    tcKimlik: profile.tcKimlik || "",
    birthDate: profile.birthDate || "",
    email: profile.email || user?.email || "",
    phone: profile.phone || user?.phone || "",
    address: profile.address || "",
    city: profile.city || "",
    district: profile.district || "",
    postalCode: profile.postalCode || "",
    companyName: profile.companyName || "",
    taxOffice: profile.taxOffice || "",
    taxNumber: profile.taxNumber || "",
    accountType: normalizeAccountType(profile.accountType || user?.accountType),
  }));
  const [commercialSubtypes, setCommercialSubtypes] = useState<CommercialSubtype[]>(() =>
    parseCommercialSubtypes(user?.commercialSubtypes)
  );
  const [commercialProfile, setCommercialProfile] = useState<CommercialProfile>(() =>
    parseCommercialProfile(user?.profile)
  );
  const [demoFillEnabled, setDemoFillEnabled] = useState(false);
  const [iban, setIban] = useState(String(user?.iban || ""));
  const [ibanSaving, setIbanSaving] = useState(false);
  const [ibanMsg, setIbanMsg] = useState("");
  const [ibanErr, setIbanErr] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [pwdSaving, setPwdSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [pwdMsg, setPwdMsg] = useState("");
  const [pwdErr, setPwdErr] = useState("");

  useEffect(() => {
    const p = user?.profile || {};
    setValues({
      firstName: p.firstName || "",
      lastName: p.lastName || "",
      tcKimlik: p.tcKimlik || "",
      birthDate: p.birthDate || "",
      email: p.email || user?.email || "",
      phone: p.phone || user?.phone || "",
      address: p.address || "",
      city: p.city || "",
      district: p.district || "",
      postalCode: p.postalCode || "",
      companyName: p.companyName || "",
      taxOffice: p.taxOffice || "",
      taxNumber: p.taxNumber || "",
      accountType: normalizeAccountType(p.accountType || user?.accountType),
    });
    setCommercialSubtypes(parseCommercialSubtypes(user?.commercialSubtypes));
    setCommercialProfile(parseCommercialProfile(user?.profile));
    setIban(String(user?.iban || ""));
  }, [user]);

  useEffect(() => {
    fetch("/api/commercial-settings")
      .then((r) => r.json())
      .then((d) => setDemoFillEnabled(Boolean(d.demoFillEnabled)))
      .catch(() => {});
  }, []);

  const groups = Array.from(
    new Map(
      profileFields.filter((f) => f.type !== "password").map((f) => [f.group, f.groupLabel])
    ).entries()
  );
  const passwordField = profileFields.find((f) => f.type === "password");

  function setVal(key: string, v: string) {
    setValues((prev) => ({ ...prev, [key]: v }));
  }

  async function saveProfile() {
    setSaving(true);
    setErr("");
    setMsg("");
    try {
      if (values.accountType === "TICARI") {
        if (!commercialSubtypes.length) {
          setErr("Ticari üyelikte en az bir faaliyet alanı seçin");
          return;
        }
        const cerr = validateCommercialProfile(commercialProfile);
        if (cerr) {
          setErr(cerr);
          return;
        }
      }
      const res = await fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save-profile",
          values:
            values.accountType === "TICARI"
              ? mergeCommercialIntoProfile(values, commercialProfile)
              : values,
          commercialSubtypes: values.accountType === "TICARI" ? commercialSubtypes : [],
          commercialProfile: values.accountType === "TICARI" ? commercialProfile : undefined,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(d.error || "Kaydedilemedi");
        return;
      }
      setMsg("Hesap bilgileri kaydedildi");
      await onSaved();
    } finally {
      setSaving(false);
    }
  }

  async function savePassword() {
    setPwdSaving(true);
    setPwdErr("");
    setPwdMsg("");
    setErr("");
    setMsg("");
    try {
      if (!currentPassword.trim()) {
        setPwdErr("Mevcut şifrenizi girin");
        return;
      }
      if (newPassword.length < 6) {
        setPwdErr("Yeni şifre en az 6 karakter olmalı");
        return;
      }
      if (newPassword !== confirmPassword) {
        setPwdErr("Yeni şifreler eşleşmiyor");
        return;
      }
      const res = await fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "change-password",
          currentPassword,
          newPassword,
          confirmPassword,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPwdErr(d.error || "Şifre değiştirilemedi");
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPwdMsg(d.message || "Şifreniz değiştirildi");
    } catch {
      setPwdErr("Bağlantı hatası — tekrar deneyin");
    } finally {
      setPwdSaving(false);
    }
  }

  async function saveIban() {
    setIbanSaving(true);
    setIbanErr("");
    setIbanMsg("");
    try {
      const res = await fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save-iban", iban }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setIbanErr(d.error || "IBAN kaydedilemedi");
        return;
      }
      setIbanMsg(d.message || "IBAN kaydedildi");
      await onSaved();
    } catch {
      setIbanErr("Bağlantı hatası — tekrar deneyin");
    } finally {
      setIbanSaving(false);
    }
  }

  if (!profileFields.length) {
    return (
      <div className="card" style={{ padding: 18 }}>
        <h2 style={{ marginTop: 0 }}>Hesap Ayarları</h2>
        <p style={{ color: "var(--muted)" }}>
          Görüntülenecek alan yok. Yönetici → Kullanıcı Ayarları menüsünden alan açabilirsiniz.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div
        className="account-settings-grid"
        style={{
          display: "grid",
          gridTemplateColumns: passwordField ? "minmax(0, 1.4fr) minmax(260px, 0.75fr)" : "minmax(0, 1fr)",
          gap: 16,
          alignItems: "start",
        }}
      >
        <div className="card" style={{ padding: 20, display: "grid", gap: 16 }}>
          <div>
            <h2 style={{ margin: "0 0 6px" }}>Hesap Ayarları</h2>
            <p style={{ margin: 0, fontSize: 13.5, color: "var(--muted)", lineHeight: 1.5 }}>
              Bilgilerinizi güncelleyin. Zorunlu alanlar (*) ile işaretlidir.
            </p>
            {values.accountType === "TICARI" && user?.commercialStatus ? (
              <div
                style={{
                  marginTop: 10,
                  padding: "8px 10px",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 700,
                  background:
                    String(user.commercialStatus).toUpperCase() === "APPROVED"
                      ? "#f0fdf4"
                      : String(user.commercialStatus).toUpperCase() === "REJECTED"
                        ? "#fef2f2"
                        : "#fff7ed",
                  color:
                    String(user.commercialStatus).toUpperCase() === "APPROVED"
                      ? "#166534"
                      : String(user.commercialStatus).toUpperCase() === "REJECTED"
                        ? "#b91c1c"
                        : "#c2410c",
                }}
              >
                Ticari durum: {commercialStatusLabel(user.commercialStatus)}
                {user.commercialReviewNote ? ` — ${user.commercialReviewNote}` : ""}
              </div>
            ) : null}
          </div>

          {groups.map(([group, groupLabel]) => (
            <div key={group} style={{ display: "grid", gap: 10 }}>
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: "#0f172a" }}>{groupLabel}</h3>
              <div style={{ display: "grid", gap: 10 }}>
                {profileFields
                  .filter((f) => f.group === group && f.type !== "password")
                  .map((f) => (
                    <label key={f.key} style={{ display: "grid", gap: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 700 }}>
                        {f.label}
                        {f.required ? <span style={{ color: "var(--orange)" }}> *</span> : null}
                      </span>
                      {f.type === "accountType" ? (
                        <div style={{ display: "grid", gap: 10 }}>
                          <select
                            className="select"
                            value={values.accountType || "BIREYSEL_TICARI"}
                            disabled={f.readOnly}
                            onChange={(e) => {
                              const v = e.target.value;
                              setVal("accountType", v);
                              if (v !== "TICARI") setCommercialSubtypes([]);
                            }}
                          >
                            <option value="BIREYSEL_TICARI">Bireysel</option>
                            <option value="TICARI">Ticari</option>
                          </select>
                          {values.accountType === "TICARI" ? (
                            <>
                              <CommercialSubtypePicker
                                value={commercialSubtypes}
                                onChange={setCommercialSubtypes}
                                disabled={f.readOnly}
                              />
                              <CommercialBusinessForm
                                value={commercialProfile}
                                onChange={setCommercialProfile}
                                demoFillEnabled={demoFillEnabled}
                                disabled={f.readOnly}
                              />
                            </>
                          ) : null}
                        </div>
                      ) : f.type === "textarea" ? (
                        <textarea
                          className="input"
                          rows={3}
                          value={values[f.key] || ""}
                          placeholder={f.placeholder}
                          disabled={f.readOnly}
                          maxLength={f.maxLength || undefined}
                          onChange={(e) => setVal(f.key, e.target.value)}
                          style={{ resize: "vertical", fontFamily: "inherit" }}
                        />
                      ) : (
                        <input
                          className="input"
                          type={f.type === "date" ? "date" : f.type === "email" ? "email" : "text"}
                          value={values[f.key] || ""}
                          placeholder={f.placeholder}
                          disabled={f.readOnly}
                          maxLength={f.maxLength || undefined}
                          inputMode={f.type === "tc" ? "numeric" : undefined}
                          onChange={(e) => setVal(f.key, e.target.value)}
                        />
                      )}
                      {f.hint ? (
                        <span style={{ fontSize: 12, color: "var(--muted)" }}>{f.hint}</span>
                      ) : null}
                    </label>
                  ))}
              </div>
            </div>
          ))}

          <button
            className="btn-orange"
            style={{ padding: 12, width: "fit-content" }}
            disabled={saving}
            onClick={saveProfile}
          >
            {saving ? "Kaydediliyor…" : "Bilgileri Kaydet"}
          </button>
        </div>

        {passwordField && (
          <div className="card" style={{ padding: 20, display: "grid", gap: 12, alignSelf: "start" }}>
            <div>
              <h3 style={{ margin: "0 0 6px", fontSize: 16 }}>Şifre Değiştir</h3>
              {passwordField.hint ? (
                <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>{passwordField.hint}</p>
              ) : null}
            </div>
            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>Mevcut şifre</span>
              <input
                className="input"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </label>
            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>Yeni şifre</span>
              <input
                className="input"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </label>
            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>Yeni şifre (tekrar)</span>
              <input
                className="input"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </label>
            <button
              type="button"
              className="btn-orange"
              style={{ padding: 12, width: "fit-content" }}
              disabled={pwdSaving}
              onClick={() => void savePassword()}
            >
              {pwdSaving ? "Güncelleniyor…" : "Şifreyi Güncelle"}
            </button>
            {(pwdMsg || pwdErr) && (
              <div
                role="status"
                style={{
                  padding: 12,
                  borderRadius: 10,
                  fontSize: 13.5,
                  fontWeight: 600,
                  background: pwdErr ? "#fef2f2" : "#f0fdf4",
                  color: pwdErr ? "#b91c1c" : "#166534",
                }}
              >
                {pwdErr || pwdMsg}
              </div>
            )}
          </div>
        )}
      </div>

      {requireSellerIban && (
        <div className="card" style={{ padding: 20, display: "grid", gap: 12 }}>
          <div>
            <h3 style={{ margin: "0 0 6px", fontSize: 16 }}>Güvenli Öde IBAN</h3>
            <p style={{ margin: 0, fontSize: 13, color: "var(--muted)", lineHeight: 1.5 }}>
              Güvenli Öde ile satış yapabilmeniz için satış gelirinizin aktarılacağı IBAN'ı
              tanımlamanız gerekir.
            </p>
          </div>
          <label style={{ display: "grid", gap: 6, maxWidth: 420 }}>
            <span style={{ fontSize: 13, fontWeight: 700 }}>IBAN</span>
            <input
              className="input"
              value={iban}
              placeholder="TR00 0000 0000 0000 0000 0000 00"
              onChange={(e) => setIban(e.target.value)}
            />
          </label>
          <button
            type="button"
            className="btn-orange"
            style={{ padding: 12, width: "fit-content" }}
            disabled={ibanSaving}
            onClick={saveIban}
          >
            {ibanSaving ? "Kaydediliyor…" : "IBAN'ı Kaydet"}
          </button>
          {(ibanMsg || ibanErr) && (
            <div
              role="status"
              style={{
                padding: 12,
                borderRadius: 10,
                fontSize: 13.5,
                fontWeight: 600,
                background: ibanErr ? "#fef2f2" : "#f0fdf4",
                color: ibanErr ? "#b91c1c" : "#166534",
              }}
            >
              {ibanErr || ibanMsg}
            </div>
          )}
        </div>
      )}

      {(msg || err) && (
        <div
          style={{
            padding: 12,
            borderRadius: 10,
            fontSize: 13.5,
            fontWeight: 600,
            background: err ? "#fef2f2" : "#f0fdf4",
            color: err ? "#b91c1c" : "#166534",
          }}
        >
          {err || msg}
        </div>
      )}

      <style>{`
        @media (max-width: 900px) {
          .account-settings-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
