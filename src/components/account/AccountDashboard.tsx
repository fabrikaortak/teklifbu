"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  Bell,
  Coins,
  Crown,
  Eye,
  Heart,
  MapPin,
  MessageSquare,
  Plus,
  Sparkles,
  Store,
  TrendingUp,
} from "lucide-react";
import { formatTl, maskName } from "@/lib/format";
import { bidStatusLabel } from "@/lib/listingStatus";
import { isCorporateAccount, normalizeAccountType } from "@/lib/accountTypes";

type DashProps = {
  data: any;
  offersEnabled: boolean;
  onOpenShopPackage: () => void;
  onOpenCommercial?: () => void;
};

function agoTr(iso: string | Date) {
  const t = new Date(iso).getTime();
  const d = Date.now() - t;
  if (!Number.isFinite(d) || d < 0) return "—";
  const m = Math.floor(d / 60000);
  if (m < 1) return "az önce";
  if (m < 60) return `${m} dakika önce`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} saat önce`;
  const day = Math.floor(h / 24);
  return `${day} gün önce`;
}

function statusTone(status: string) {
  if (status === "APPROVED") return "ok";
  if (status === "ACTIVE" || status === "PENDING") return "wait";
  return "muted";
}

export function AccountDashboard({ data, offersEnabled, onOpenShopPackage }: DashProps) {
  const user = data.user || {};
  const stats = data.stats || {};
  const firstName = String(user.name || "Üye").trim().split(/\s+/)[0] || "Üye";
  const listings = Array.isArray(data.listings) ? data.listings : [];
  const activeListings = listings.filter((l: any) => l.status === "ACTIVE").slice(0, 5);
  const myBids = Array.isArray(data.bids) ? data.bids : [];
  const allReceived = Array.isArray(data.receivedBids) ? data.receivedBids : [];
  const givenList = myBids.slice(0, 5);
  const receivedList = allReceived.slice(0, 5);

  const now = Date.now();
  const day = 86400000;
  const offersToday = allReceived.filter((b: any) => now - new Date(b.createdAt).getTime() < day).length;
  const offersPrev = allReceived.filter((b: any) => {
    const t = now - new Date(b.createdAt).getTime();
    return t >= day && t < day * 2;
  }).length;
  const offerTrend =
    offersPrev > 0
      ? Math.round(((offersToday - offersPrev) / offersPrev) * 100)
      : offersToday > 0
        ? 100
        : null;

  const payments = Array.isArray(data.payments) ? data.payments : [];
  const earningsTl = payments
    .filter((p: any) => ["PAID", "SIMULATED", "COMPLETED", "SUCCESS"].includes(String(p.status || "").toUpperCase()))
    .reduce((s: number, p: any) => s + (Number(p.amountTl) || 0), 0);
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const earningsMonth = payments
    .filter((p: any) => {
      const st = String(p.status || "").toUpperCase();
      if (!["PAID", "SIMULATED", "COMPLETED", "SUCCESS"].includes(st)) return false;
      return new Date(p.createdAt).getTime() >= monthStart.getTime();
    })
    .reduce((s: number, p: any) => s + (Number(p.amountTl) || 0), 0);

  const perf = useMemo(() => {
    const views = Number(stats.totalViews) || 0;
    const fav = Number(stats.listingFavorites) || 0;
    const bids = Number(stats.bidsReceived) || 0;
    const total = Math.max(1, views + fav + bids);
    return {
      views,
      fav,
      bids,
      total: views + fav + bids,
      pViews: Math.round((views / total) * 100),
      pFav: Math.round((fav / total) * 100),
      pBids: Math.round((bids / total) * 100),
    };
  }, [stats]);

  const donutStyle = {
    background: `conic-gradient(
      var(--orange) 0 ${perf.pViews}%,
      #38bdf8 ${perf.pViews}% ${perf.pViews + perf.pFav}%,
      #a78bfa ${perf.pViews + perf.pFav}% 100%
    )`,
  } as const;

  const storeHref = `/satici/${user.id}`;
  const isCorp = isCorporateAccount(user.accountType);

  const kpiCards = [
    {
      key: "views",
      icon: <Eye size={18} strokeWidth={2} />,
      tone: "cyan",
      value: Number(stats.totalViews || 0).toLocaleString("tr-TR"),
      label: "İlan Görüntülenme",
      trend: null as number | null,
      trendLabel: "toplam",
    },
    {
      key: "offers",
      icon: <MessageSquare size={18} strokeWidth={2} />,
      tone: "purple",
      value: String(
        offersEnabled
          ? Number(stats.bidsReceivedActive || offersToday || 0)
          : Number(stats.unreadMessages || 0)
      ),
      label: offersEnabled ? "Yeni Teklif" : "Yeni Mesaj",
      trend: offersEnabled ? offerTrend : null,
      trendLabel: "düne göre",
    },
    {
      key: "fav",
      icon: <Heart size={18} strokeWidth={2} />,
      tone: "red",
      value: Number(stats.listingFavorites || 0).toLocaleString("tr-TR"),
      label: "Favorilere Eklendi",
      trend: null as number | null,
      trendLabel: "toplam",
    },
    {
      key: "earn",
      icon: <TrendingUp size={18} strokeWidth={2} />,
      tone: "teal",
      value: formatTl(earningsMonth || earningsTl || 0),
      label: "Toplam Kazanç",
      trend: null as number | null,
      trendLabel: "bu ay",
    },
  ];

  return (
    <div className="acc-dash">
      <div className="acc-dash-hero">
        <div className="acc-dash-hero__sky" aria-hidden>
          <span className="acc-dash-star acc-dash-star--a" />
          <span className="acc-dash-star acc-dash-star--b" />
          <span className="acc-dash-star acc-dash-star--c" />
          <span className="acc-dash-star acc-dash-star--d" />
          <span className="acc-dash-star acc-dash-star--e" />
          <span className="acc-dash-star acc-dash-star--f" />
          <span className="acc-dash-star acc-dash-star--g" />
          <span className="acc-dash-star acc-dash-star--h" />
          <span className="acc-dash-star acc-dash-star--i" />
          <span className="acc-dash-star acc-dash-star--j" />
          <span className="acc-dash-star acc-dash-star--k" />
          <span className="acc-dash-star acc-dash-star--l" />
          <span className="acc-dash-nebula" />
        </div>
        <div className="acc-dash-hero__head">
          <div className="acc-dash-hero__text">
            <h1>Merhaba {firstName} 👋</h1>
            <p>Bugün neler olup bittiğine hızlıca göz atın.</p>
          </div>
        </div>
        <div className="acc-dash-kpis">
          {kpiCards.map((k) => (
            <div key={k.key} className="acc-dash-kpi">
              <div className="acc-dash-kpi__top">
                <span className={`acc-dash-kpi__ico acc-dash-kpi__ico--${k.tone}`}>{k.icon}</span>
                <strong>{k.value}</strong>
              </div>
              <div className="acc-dash-kpi__label">{k.label}</div>
              {k.trend != null && k.trend !== 0 ? (
                <div className={`acc-dash-kpi__trend${k.trend < 0 ? " is-down" : ""}`}>
                  {k.trend > 0 ? "↑" : "↓"} %{Math.abs(k.trend)} {k.trendLabel}
                </div>
              ) : (
                <div className="acc-dash-kpi__trend is-muted">{k.trendLabel}</div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="acc-dash-section-title">Bugün Size Özel</div>
      <div className="acc-dash-quick">
        <Link href="/hesabim?s=mesajlar" className="acc-dash-quick__card acc-dash-quick__card--blue">
          <MessageSquare size={18} />
          <div>
            <strong>Mesajlar</strong>
            <span>
              {Number(stats.unreadMessages || 0) > 0
                ? `${stats.unreadMessages} okunmamış mesaj`
                : "Mesajlarınızı kontrol edin"}
            </span>
          </div>
        </Link>
        <Link href="/hesabim?s=jetonlarim" className="acc-dash-quick__card acc-dash-quick__card--yellow">
          <Coins size={18} />
          <div>
            <strong>Jeton yükleyin</strong>
            <span>Bakiye: {Number(stats.tokenBalance || 0)}</span>
          </div>
        </Link>
        <button type="button" className="acc-dash-quick__card acc-dash-quick__card--pink" onClick={onOpenShopPackage}>
          <Crown size={18} />
          <div>
            <strong>Premium</strong>
            <span>{data.shopPackage ? data.shopPackage.name : "Pakete geçin"}</span>
          </div>
        </button>
        <Link href="/ilan-ver" className="acc-dash-quick__card acc-dash-quick__card--orange">
          <Plus size={18} />
          <div>
            <strong>İlan verin</strong>
            <span>Yeni ilan oluşturun</span>
          </div>
        </Link>
      </div>

      {offersEnabled ? (
        <div className="acc-dash-offers">
          <div className="acc-dash-card acc-dash-card--offers">
            <div className="acc-dash-card__head">
              <h2>Verdiğim Teklifler</h2>
              <Link href="/hesabim?s=tekliflerim">Tümünü Gör</Link>
            </div>
            <ul className="acc-dash-list acc-dash-list--offers">
              {givenList.map((b: any) => {
                const removed = Boolean(b.listingRemoved || b.listingGone);
                const title = b.listingTitle || b.listing?.title || "İlan";
                const href = removed ? null : `/ilan/${b.listing?.id}`;
                const cover = b.listing?.coverImage || null;
                const tone = statusTone(b.status);
                const inner = (
                  <>
                    <span className="acc-dash-offer__img">
                      {cover ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={cover} alt="" />
                      ) : (
                        <span className="acc-dash-offer__ph" />
                      )}
                    </span>
                    <span className="acc-dash-offer__info">
                      <span className="acc-dash-offer__title">{title}</span>
                      <span className="acc-dash-offer__meta">
                        <strong>{formatTl(b.amount)}</strong>
                        <span>· {agoTr(b.createdAt)}</span>
                      </span>
                    </span>
                    <span className={`acc-dash-pill acc-dash-pill--${tone}`}>{bidStatusLabel(b.status)}</span>
                  </>
                );
                return (
                  <li key={`g-${b.id}`}>
                    {href ? (
                      <Link href={href} className="acc-dash-offer">
                        {inner}
                      </Link>
                    ) : (
                      <div className="acc-dash-offer is-gone">{inner}</div>
                    )}
                  </li>
                );
              })}
              {!givenList.length ? <li className="acc-dash-empty">Henüz teklif vermediniz.</li> : null}
            </ul>
          </div>

          <div className="acc-dash-card acc-dash-card--offers">
            <div className="acc-dash-card__head">
              <h2>Aldığım Teklifler</h2>
              <Link href="/hesabim?s=tekliflerim">Tümünü Gör</Link>
            </div>
            <ul className="acc-dash-list acc-dash-list--offers">
              {receivedList.map((b: any) => {
                const tone = statusTone(b.status);
                const cover = b.listingCoverImage || null;
                return (
                  <li key={`r-${b.id}`}>
                    <Link href={`/ilan/${b.listingId}`} className="acc-dash-offer">
                      <span className="acc-dash-offer__img">
                        {cover ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={cover} alt="" />
                        ) : (
                          <span className="acc-dash-offer__ph" />
                        )}
                      </span>
                      <span className="acc-dash-offer__info">
                        <span className="acc-dash-offer__title">{b.listingTitle || "İlan"}</span>
                        <span className="acc-dash-offer__meta">
                          {maskName(b.bidderName) || "—"} · <strong>{formatTl(b.amount)}</strong>
                          <span>· {agoTr(b.createdAt)}</span>
                        </span>
                      </span>
                      <span className={`acc-dash-pill acc-dash-pill--${tone}`}>{bidStatusLabel(b.status)}</span>
                    </Link>
                  </li>
                );
              })}
              {!receivedList.length ? <li className="acc-dash-empty">İlanlarınıza henüz teklif gelmedi.</li> : null}
            </ul>
          </div>
        </div>
      ) : null}

      <div className={`acc-dash-grid${offersEnabled ? " acc-dash-grid--two" : ""}`}>
        {!offersEnabled ? (
          <div className="acc-dash-card">
            <div className="acc-dash-card__head">
              <h2>Bildirimler</h2>
              <Link href="/hesabim?s=bildirimler">Tümünü Gör</Link>
            </div>
            <ul className="acc-dash-list">
              {(data.notifications || []).slice(0, 5).map((n: any) => (
                <li key={n.id}>
                  <div className="acc-dash-list__body">
                    <div className="acc-dash-list__title">{n.title || "Bildirim"}</div>
                    <div className="acc-dash-list__meta">{agoTr(n.createdAt)}</div>
                  </div>
                  <Bell size={14} color="#94a3b8" />
                </li>
              ))}
              {!(data.notifications || []).length ? (
                <li className="acc-dash-empty">Bildirim yok.</li>
              ) : null}
            </ul>
          </div>
        ) : null}

        <div className="acc-dash-card">
          <div className="acc-dash-card__head">
            <h2>Aktif İlanlarım</h2>
            <Link href="/hesabim?s=ilanlarim">Tümünü Gör</Link>
          </div>
          <ul className="acc-dash-list">
            {activeListings.map((l: any) => (
              <li key={l.id}>
                <Link href={`/ilan/${l.id}`} className="acc-dash-listing">
                  <span className="acc-dash-listing__img">
                    {l.coverImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={l.coverImage} alt="" />
                    ) : null}
                  </span>
                  <span className="acc-dash-listing__info">
                    <span className="acc-dash-listing__title">{l.title}</span>
                    <span className="acc-dash-listing__price">{formatTl(l.askPrice)}</span>
                    <span className="acc-dash-listing__meta">
                      <Eye size={12} /> {Number(l.viewCount || 0)}
                      {l.city ? (
                        <>
                          {" "}
                          · <MapPin size={12} /> {l.city}
                        </>
                      ) : null}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
            {!activeListings.length ? <li className="acc-dash-empty">Aktif ilanınız yok.</li> : null}
          </ul>
          <Link href="/ilan-ver" className="acc-dash-cta">
            <Plus size={15} /> Yeni İlan Ver
          </Link>
        </div>

        <div className="acc-dash-card">
          <div className="acc-dash-card__head">
            <h2>İlan Performansım</h2>
          </div>
          <div className="acc-dash-perf">
            <div className="acc-dash-donut" style={donutStyle}>
              <div className="acc-dash-donut__hole">
                <strong>{perf.total.toLocaleString("tr-TR")}</strong>
                <span>Toplam sinyal</span>
              </div>
            </div>
            <ul className="acc-dash-legend">
              <li>
                <i style={{ background: "var(--orange)" }} /> Görüntülenme %{perf.pViews}
              </li>
              <li>
                <i style={{ background: "#38bdf8" }} /> Favori %{perf.pFav}
              </li>
              <li>
                <i style={{ background: "#a78bfa" }} /> Teklif %{perf.pBids}
              </li>
            </ul>
          </div>
          {(isCorp || data.sellerPanel?.allowed) && (
            <div className="acc-dash-store-row">
              {isCorp ? (
                <Link href={storeHref} className="acc-dash-store-btn">
                  <Store size={15} /> Mağazamı Görüntüle
                </Link>
              ) : null}
              {data.sellerPanel?.allowed ? (
                <Link href="/magaza/panel" className="acc-dash-store-btn acc-dash-store-btn--ghost">
                  <Sparkles size={15} /> {data.sellerPanel.buttonLabel || "Satıcı Paneli"}
                </Link>
              ) : null}
            </div>
          )}
          {(data.shopPackage || isCorp || normalizeAccountType(user.accountType) === "BIREYSEL_TICARI") && (
            <button type="button" className="acc-dash-cta acc-dash-cta--ghost" onClick={onOpenShopPackage}>
              <Crown size={15} /> {data.shopPackage ? "Paketi Yönet" : "Kurumsal Paket Al"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
