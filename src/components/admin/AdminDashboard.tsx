"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  FileText,
  TrendingUp,
  UserPlus,
  Shield,
  Wallet,
  CalendarDays,
  CheckCircle2,
  XCircle,
  ArrowUpRight,
  Coins,
  LayoutDashboard,
  Clock3,
  PencilLine,
  Building2,
} from "lucide-react";
import { formatCompact, formatTl } from "@/lib/format";
import {
  AdmGlassCard,
  AdmHero,
  AdmKpiGrid,
  AdmQuickLink,
  type AdmKpiItem,
} from "@/components/admin/AdminOverviewUI";

const CAT_COLORS = ["#f97316", "#3b82f6", "#22c55e", "#a855f7", "#eab308", "#94a3b8"];
const BID_COLORS = { pending: "#f97316", approved: "#22c55e", rejected: "#ef4444", expired: "#94a3b8" };

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.max(1, Math.floor(diff / 60000));
  if (m < 60) return `${m} dakika önce`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} saat önce`;
  return `${Math.floor(h / 24)} gün önce`;
}

function formatVolume(n: number) {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)} Milyar TL`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)} Milyon TL`;
  return formatTl(n);
}

function LineChart({ series }: { series: Array<{ date: string; listings: number; bids: number }> }) {
  const w = 640;
  const h = 220;
  const pad = { t: 16, r: 12, b: 28, l: 36 };
  const maxY = Math.max(8, ...series.flatMap((s) => [s.listings, s.bids])) * 1.15 || 10;
  const innerW = w - pad.l - pad.r;
  const innerH = h - pad.t - pad.b;
  const x = (i: number) => pad.l + (i / Math.max(1, series.length - 1)) * innerW;
  const y = (v: number) => pad.t + innerH - (v / maxY) * innerH;

  function path(key: "listings" | "bids") {
    return series.map((s, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(s[key])}`).join(" ");
  }

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => Math.round(maxY * t));

  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height="220" role="img" aria-label="Teklif ve ilan grafiği">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={pad.l} x2={w - pad.r} y1={y(t)} y2={y(t)} stroke="#eef2f7" strokeWidth="1" />
          <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" fontSize="10" fill="#94a3b8">
            {t}
          </text>
        </g>
      ))}
      <path d={path("listings")} fill="none" stroke="#f97316" strokeWidth="2.5" strokeLinecap="round" />
      <path d={path("bids")} fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" />
      {series
        .filter((_, i) => i % 5 === 0 || i === series.length - 1)
        .map((s, idx) => {
          const i = series.indexOf(s);
          return (
            <text key={s.date + idx} x={x(i)} y={h - 8} textAnchor="middle" fontSize="10" fill="#94a3b8">
              {new Date(s.date).toLocaleDateString("tr-TR", { day: "2-digit", month: "short" })}
            </text>
          );
        })}
    </svg>
  );
}

function Donut({
  segments,
  center,
}: {
  segments: Array<{ value: number; color: string }>;
  center: string;
}) {
  const total = segments.reduce((a, s) => a + s.value, 0) || 1;
  const r = 54;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <svg width="140" height="140" viewBox="0 0 140 140">
      <circle cx="70" cy="70" r={r} fill="none" stroke="#f1f5f9" strokeWidth="18" />
      {segments.map((s, i) => {
        const len = (s.value / total) * c;
        const el = (
          <circle
            key={i}
            cx="70"
            cy="70"
            r={r}
            fill="none"
            stroke={s.color}
            strokeWidth="18"
            strokeDasharray={`${len} ${c - len}`}
            strokeDashoffset={-offset}
            transform="rotate(-90 70 70)"
            strokeLinecap="butt"
          />
        );
        offset += len;
        return el;
      })}
      <text x="70" y="66" textAnchor="middle" fontSize="11" fill="#64748b" fontWeight="600">
        Toplam
      </text>
      <text x="70" y="84" textAnchor="middle" fontSize="16" fill="#0f172a" fontWeight="800">
        {center}
      </text>
    </svg>
  );
}

function Sparkline({ color, values }: { color: string; values: number[] }) {
  const w = 90;
  const h = 32;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const pts = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * w;
      const y = h - ((v - min) / (max - min || 1)) * (h - 4) - 2;
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <polyline fill="none" stroke={color} strokeWidth="2" points={pts} />
    </svg>
  );
}

export function AdminDashboard() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    fetch("/api/admin?view=dashboard")
      .then((r) => r.json())
      .then(setData);
  }, []);

  const dateLabel = useMemo(() => {
    const end = new Date();
    const start = new Date(end.getTime() - 30 * 864e5);
    const fmt = (d: Date) =>
      d.toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric" });
    return `${fmt(start)} — ${fmt(end)}`;
  }, []);

  if (!data?.kpis) {
    return <AdmGlassCard style={{ padding: 24, color: "#64748b", fontWeight: 600 }}>Dashboard yükleniyor…</AdmGlassCard>;
  }

  const { kpis, chartSeries, categories, bidStatus, liveBids, activity, system, quick } = data;
  const catTotal = categories.reduce((a: number, c: any) => a + c.count, 0) || 1;

  const kpisUi: AdmKpiItem[] = [
    {
      label: "Toplam İlan",
      value: formatCompact(kpis.totalListings),
      trend: kpis.trends.listings,
      icon: FileText,
      tone: "orange",
    },
    {
      label: "Toplam Teklif",
      value: formatCompact(kpis.totalBids),
      trend: kpis.trends.bids,
      icon: TrendingUp,
      tone: "violet",
    },
    {
      label: "Yeni Kullanıcı",
      value: formatCompact(kpis.totalUsers),
      trend: kpis.trends.users,
      icon: UserPlus,
      tone: "emerald",
    },
    {
      label: "Mutlu Satıcı",
      value: formatCompact(kpis.sellers),
      trend: kpis.trends.sellers,
      icon: Shield,
      tone: "blue",
    },
    {
      label: "İşlem Hacmi",
      value: formatVolume(kpis.volume),
      trend: kpis.trends.volume,
      icon: Wallet,
      tone: "orange",
    },
  ];

  const actionKpis: AdmKpiItem[] = [
    {
      label: "Kurumsal onay",
      value: formatCompact(kpis.pendingCommercialUserCount || 0),
      icon: Building2,
      tone: (kpis.pendingCommercialUserCount || 0) > 0 ? "orange" : "slate",
      href: "/admin/ticari-uyeler",
      hint: "Bekleyen ticari üye",
    },
    {
      label: "Onay bekleyen",
      value: formatCompact(kpis.pendingReviewCount || 0),
      icon: Clock3,
      tone: (kpis.pendingReviewCount || 0) > 0 ? "rose" : "slate",
      href: "/admin/emlak-vasita/ilan-onay",
      hint: "İlan onayları",
    },
    {
      label: "Düzenleme",
      value: formatCompact(kpis.pendingEditCount || 0),
      icon: PencilLine,
      tone: (kpis.pendingEditCount || 0) > 0 ? "violet" : "slate",
      href: "/admin/emlak-vasita/duzenleme-onay",
    },
    {
      label: "Ek süre",
      value: formatCompact(kpis.pendingExtensionCount || 0),
      icon: Clock3,
      tone: (kpis.pendingExtensionCount || 0) > 0 ? "blue" : "slate",
      href: "/admin/emlak-vasita/ek-sure",
    },
    {
      label: "Satıcı talepleri",
      value: formatCompact(kpis.pendingSellerRequestCount || 0),
      icon: UserPlus,
      tone: (kpis.pendingSellerRequestCount || 0) > 0 ? "orange" : "slate",
      href: "/admin/satici-talepleri",
    },
  ];

  return (
    <div>
      <AdmHero
        accent="orange"
        eyebrow="Platform"
        title={
          <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
            <LayoutDashboard size={28} strokeWidth={2.2} />
            Genel bakış
          </span>
        }
        subtitle={
          <>
            Son 30 gün performansı · Aktif ilan{" "}
            <strong style={{ color: "#fdba74" }}>{formatCompact(kpis.activeListings || 0)}</strong>
            {" · "}
            Okunmamış mesaj {formatCompact(kpis.unreadMessages || 0)}
          </>
        }
        actions={
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              background: "rgba(255,255,255,0.12)",
              borderRadius: 999,
              padding: "7px 12px",
              fontSize: 12.5,
              fontWeight: 700,
            }}
          >
            <CalendarDays size={14} />
            {dateLabel}
          </div>
        }
      />

      <AdmKpiGrid items={kpisUi} />
      <AdmKpiGrid items={actionKpis} />

      <div className="adm-overview-split" style={{ marginBottom: 14 }}>
        <AdmGlassCard style={{ padding: 14 }}>
          <div className="adm-card-head" style={{ marginBottom: 8 }}>
            <h3 style={{ margin: 0, fontSize: 14.5, fontWeight: 800 }}>Teklif & İlan</h3>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "#64748b" }}>
                <i style={{ width: 8, height: 8, borderRadius: 99, background: "#f97316", display: "inline-block" }} />{" "}
                İlan
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "#64748b" }}>
                <i style={{ width: 8, height: 8, borderRadius: 99, background: "#3b82f6", display: "inline-block" }} />{" "}
                Teklif
              </span>
            </div>
          </div>
          <LineChart series={chartSeries} />
        </AdmGlassCard>

        <AdmGlassCard style={{ padding: 14 }}>
          <div className="adm-card-head">
            <h3 style={{ margin: 0, fontSize: 14.5, fontWeight: 800 }}>Canlı teklif akışı</h3>
          </div>
          <div>
            {(liveBids || []).map((b: any) => (
              <Link key={b.id} href={`/ilan/${b.listing.id}`} className="adm-live-item">
                <div className="adm-live-thumb">
                  {b.listing.coverImage && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={b.listing.coverImage} alt="" />
                  )}
                </div>
                <div className="adm-live-meta">
                  <div className="adm-live-title">{b.listing.title}</div>
                  <div className="adm-live-sub">
                    {[b.listing.district, b.listing.city].filter(Boolean).join(", ")} · {timeAgo(b.createdAt)}
                  </div>
                </div>
                <div className="adm-live-prices">
                  <div className="adm-live-ask">
                    <span>İlan</span>
                    <strong>{formatTl(b.listing.askPrice)}</strong>
                  </div>
                  <div className="adm-live-price">
                    <span>Teklif</span>
                    <strong>{formatTl(b.amount)}</strong>
                  </div>
                </div>
                <div className="adm-live-user">
                  <div className="adm-live-user-av">{(b.bidder.name || "U").slice(0, 1)}</div>
                  <span>{b.bidder.handle}</span>
                </div>
              </Link>
            ))}
          </div>
          <div className="adm-live-footer">
            <i /> Anlık olarak güncellenmektedir
          </div>
        </AdmGlassCard>
      </div>

      <div className="adm-dash-3" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12, marginBottom: 14 }}>
        <AdmGlassCard style={{ padding: 14 }}>
          <div className="adm-card-head">
            <h3 style={{ margin: 0, fontSize: 14.5, fontWeight: 800 }}>Kategori dağılımı</h3>
          </div>
          <div className="adm-donut-wrap">
            <Donut
              center={formatCompact(kpis.totalListings)}
              segments={categories.map((c: any, i: number) => ({
                value: c.count || 0.01,
                color: CAT_COLORS[i % CAT_COLORS.length],
              }))}
            />
            <div className="adm-legend">
              {categories.map((c: any, i: number) => (
                <div key={c.slug} className="adm-legend-row">
                  <div className="adm-legend-left">
                    <span className="adm-dot-color" style={{ background: CAT_COLORS[i % CAT_COLORS.length] }} />
                    {c.name}
                  </div>
                  <div className="adm-legend-right">
                    {formatCompact(c.count)} · %{Math.round((c.count / catTotal) * 100)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </AdmGlassCard>

        <AdmGlassCard style={{ padding: 14 }}>
          <div className="adm-card-head">
            <h3 style={{ margin: 0, fontSize: 14.5, fontWeight: 800 }}>Teklif durumları</h3>
          </div>
          <div className="adm-donut-wrap">
            <Donut
              center={formatCompact(bidStatus.total || 0)}
              segments={[
                { value: bidStatus.pending || 0.01, color: BID_COLORS.pending },
                { value: bidStatus.approved || 0.01, color: BID_COLORS.approved },
                { value: bidStatus.rejected || 0.01, color: BID_COLORS.rejected },
                { value: bidStatus.expired || 0.01, color: BID_COLORS.expired },
              ]}
            />
            <div className="adm-legend">
              {[
                ["Beklemede", bidStatus.pending, BID_COLORS.pending],
                ["Kabul Edilen", bidStatus.approved, BID_COLORS.approved],
                ["Reddedilen", bidStatus.rejected, BID_COLORS.rejected],
                ["Süresi Dolan", bidStatus.expired, BID_COLORS.expired],
              ].map(([label, count, color]) => (
                <div key={String(label)} className="adm-legend-row">
                  <div className="adm-legend-left">
                    <span className="adm-dot-color" style={{ background: String(color) }} />
                    {label}
                  </div>
                  <div className="adm-legend-right">
                    {formatCompact(Number(count))} · %
                    {bidStatus.total ? Math.round((Number(count) / bidStatus.total) * 100) : 0}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </AdmGlassCard>

        <AdmGlassCard style={{ padding: 14 }}>
          <div className="adm-card-head">
            <h3 style={{ margin: 0, fontSize: 14.5, fontWeight: 800 }}>Dikeyler</h3>
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            <AdmQuickLink
              href="/admin/emlak-vasita"
              label="Vasıta & Emlak"
              description="Konut, araç, makine"
            />
            <AdmQuickLink href="/admin/alisveris" label="Alışveriş" description="İkinci el / sıfır" />
            <AdmQuickLink href="/admin/premium" label="Premium" description="Otel · Lojistik · Yolculuk" />
            <AdmQuickLink href="/admin/gelirler" label="Gelirler" description="Finans özeti" />
          </div>
          <div style={{ marginTop: 14, display: "grid", gap: 8 }}>
            {(system || []).map((s: any) => (
              <div key={s.name} className="adm-sys-row">
                <span>{s.name}</span>
                <span className="adm-sys-ok">
                  <CheckCircle2 size={14} /> Çalışıyor
                </span>
              </div>
            ))}
          </div>
        </AdmGlassCard>
      </div>

      <div className="adm-overview-split">
        <AdmGlassCard style={{ padding: 14, overflow: "auto" }}>
          <div className="adm-card-head">
            <h3 style={{ margin: 0, fontSize: 14.5, fontWeight: 800 }}>Son işlemler</h3>
          </div>
          <table className="adm-table">
            <thead>
              <tr>
                <th>İşlem</th>
                <th>Kullanıcı</th>
                <th>Tür</th>
                <th>Detay</th>
                <th>Tarih</th>
              </tr>
            </thead>
            <tbody>
              {(activity || []).map((a: any) => {
                const tone =
                  a.tone === "ok"
                    ? { bg: "#ecfdf5", color: "#16a34a", Icon: CheckCircle2 }
                    : a.tone === "err"
                      ? { bg: "#fef2f2", color: "#ef4444", Icon: XCircle }
                      : a.tone === "token"
                        ? { bg: "#fff7ed", color: "#f97316", Icon: Coins }
                        : { bg: "#eff6ff", color: "#2563eb", Icon: ArrowUpRight };
                const Icon = tone.Icon;
                return (
                  <tr key={a.id}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span className="adm-act-ico" style={{ background: tone.bg, color: tone.color }}>
                          <Icon size={14} />
                        </span>
                        <strong style={{ fontSize: 13 }}>{a.type}</strong>
                      </div>
                    </td>
                    <td>{a.user}</td>
                    <td>{a.label}</td>
                    <td style={{ maxWidth: 180, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {a.detail}
                    </td>
                    <td style={{ whiteSpace: "nowrap", color: "#64748b" }}>
                      {new Date(a.at).toLocaleString("tr-TR", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </AdmGlassCard>

        <AdmGlassCard style={{ padding: 14 }}>
          <div className="adm-card-head">
            <h3 style={{ margin: 0, fontSize: 14.5, fontWeight: 800 }}>Hızlı özet</h3>
          </div>
          {[
            {
              label: "Ortalama Teklif Süresi",
              value: quick.avgBidDuration,
              trend: "+4.2%",
              color: "#f97316",
              spark: [2, 3, 2, 4, 3, 5, 4, 6],
            },
            {
              label: "Teklif / İlan Oranı",
              value: String(quick.bidPerListing),
              trend: "+2.1%",
              color: "#3b82f6",
              spark: [1, 2, 2, 3, 3, 4, 5, 4],
            },
            {
              label: "Kabul Oranı",
              value: `%${quick.acceptRate}`,
              trend: "+1.4%",
              color: "#16a34a",
              spark: [3, 3, 4, 3, 5, 4, 6, 5],
            },
            {
              label: "Aktif Kullanıcı (Online)",
              value: formatCompact(quick.onlineUsers),
              trend: "+8.6%",
              color: "#7c3aed",
              spark: [2, 4, 3, 5, 4, 6, 5, 7],
            },
          ].map((row) => (
            <div key={row.label} className="adm-spark-row">
              <div>
                <div className="adm-spark-label">{row.label}</div>
                <div className="adm-spark-value">{row.value}</div>
                <div className="adm-spark-trend">{row.trend}</div>
              </div>
              <Sparkline color={row.color} values={row.spark} />
            </div>
          ))}
        </AdmGlassCard>
      </div>
    </div>
  );
}
