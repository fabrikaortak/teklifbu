"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Gavel } from "lucide-react";
import { MODE_HREF } from "@/lib/listingBrowseMode";
import { formatCompact, formatTl } from "@/lib/format";

type ListingRow = {
  id: string;
  title: string;
  city: string;
  district?: string | null;
  coverImage?: string | null;
  askPrice: number;
  highestBid: number;
  bidCount: number;
  endsAt?: string | Date | null;
  badge?: string;
  finalPrice?: number;
  profit?: number;
};

type InsightsPayload = {
  endingSoon: ListingRow[];
  mostBidsToday: ListingRow[];
  topProfit: ListingRow[];
  turkeyMap: Array<{ city: string; count: number }>;
  liveStats: {
    bidsToday: number;
    bidsTodayChangePct: number;
    soldLast24h: number;
    soldLast24hChangePct: number;
    totalBidVolumeTl: number;
    totalBidVolumeChangePct: number;
    activeListings: number;
    onlineUsers: number;
    topBidToday: { amount: number; listingId: string; title: string; city: string } | null;
  };
  forYou: ListingRow[];
};

type EnabledMap = Record<string, boolean>;

function loc(l: ListingRow) {
  return [l.district, l.city].filter(Boolean).join(", ") || l.city;
}

function shortTitle(t: string) {
  return t.length > 36 ? `${t.slice(0, 34)}…` : t;
}

function remainingHms(endsAt?: string | Date | null) {
  if (!endsAt) return null;
  const diff = new Date(endsAt).getTime() - Date.now();
  if (diff <= 0) return "00:00:00";
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function volumeLabel(n: number) {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)} Milyar TL`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} Milyon TL`;
  return formatTl(n);
}

function Thumb({ src }: { src?: string | null }) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" className="hi-thumb" />;
  }
  return <div className="hi-thumb hi-thumb--ph" />;
}

function Panel({
  n,
  title,
  href,
  children,
}: {
  n: number;
  title: string;
  href: string;
  children: ReactNode;
}) {
  return (
    <section className="hi-panel">
      <div className="hi-panel__head">
        <div className="hi-panel__title">
          <span className="hi-panel__num">{n}</span>
          <h2>{title}</h2>
        </div>
        <Link href={href} className="hi-panel__all">
          Tümünü Gör ›
        </Link>
      </div>
      {children}
    </section>
  );
}

export function HomeInsightPanels() {
  const [enabled, setEnabled] = useState<EnabledMap | null>(null);
  const [data, setData] = useState<InsightsPayload | null>(null);
  const [mapTitle, setMapTitle] = useState("Türkiye Teklif Haritası");
  const [offersEnabled, setOffersEnabled] = useState(true);
  const [tick, setTick] = useState(0);
  const forYouRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/home-insights");
        const json = await res.json();
        if (cancelled) return;
        setEnabled(json.enabled || {});
        setData(json.data || null);
        if (json.mapTitle) setMapTitle(String(json.mapTitle));
        if (typeof json.offersEnabled === "boolean") setOffersEnabled(json.offersEnabled);
      } catch {
        if (!cancelled) {
          setEnabled({});
          setData(null);
        }
      }
    }
    load();
    const id = window.setInterval(load, 60000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  const on = useMemo(() => enabled || {}, [enabled]);
  const anyOn = Object.values(on).some(Boolean);

  if (!enabled || !anyOn || !data) return null;

  function scrollForYou(dir: -1 | 1) {
    const el = forYouRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * 260, behavior: "smooth" });
  }

  const maxMap = Math.max(1, ...data.turkeyMap.map((c) => c.count));

  // city approximate positions on a simple Turkey-ish canvas (normalized %)
  const CITY_POS: Record<string, { x: number; y: number }> = {
    İstanbul: { x: 28, y: 28 },
    Ankara: { x: 48, y: 38 },
    İzmir: { x: 22, y: 48 },
    Antalya: { x: 38, y: 72 },
    Bursa: { x: 32, y: 34 },
    Adana: { x: 58, y: 62 },
    Gaziantep: { x: 68, y: 58 },
    Konya: { x: 48, y: 55 },
    Mersin: { x: 52, y: 68 },
    Trabzon: { x: 72, y: 28 },
  };

  void tick;

  return (
    <div className="hi-wrap page-shell-wide">
      <div className="hi-row-grid">
        {on.ending_soon && (
          <Panel n={2} title="Bitmek Üzere Olan İlanlar" href={MODE_HREF.ending}>
            <div className="hi-list">
              {data.endingSoon.length === 0 && <div className="hi-empty">Yakında biten ilan yok.</div>}
              {data.endingSoon.map((l) => {
                const urgent = l.endsAt && new Date(l.endsAt).getTime() - Date.now() < 3600000;
                return (
                  <div key={l.id} className="hi-row">
                    <Thumb src={l.coverImage} />
                    <div className="hi-row__body">
                      <div className="hi-row__title">{shortTitle(l.title)}</div>
                      <div className="hi-row__loc">{loc(l)}</div>
                      <div className="hi-row__sub">En Yüksek Teklif</div>
                    </div>
                    <div className="hi-row__right">
                      {urgent ? (
                        <div className="hi-countdown">{remainingHms(l.endsAt)}</div>
                      ) : (
                        <div className="hi-price">{l.highestBid ? formatTl(l.highestBid) : "—"}</div>
                      )}
                      <Link href={`/ilan/${l.id}`} className="hi-bid-btn">
                        <Gavel size={13} /> Teklif Ver
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </Panel>
        )}

        {on.most_bids_today && (
          <Panel n={3} title="Bugün En Çok Teklif Alanlar" href={MODE_HREF.mostBids}>
            <div className="hi-list">
              {data.mostBidsToday.length === 0 && <div className="hi-empty">Bugün henüz teklif yok.</div>}
              {data.mostBidsToday.map((l, i) => (
                <Link key={l.id} href={`/ilan/${l.id}`} className="hi-rank-row">
                  <span className="hi-rank">{i + 1}</span>
                  <Thumb src={l.coverImage} />
                  <div className="hi-row__body">
                    <div className="hi-row__title">{shortTitle(l.title)}</div>
                    <div className="hi-row__loc">{loc(l)}</div>
                  </div>
                  <div className="hi-rank-count">{l.bidCount} teklif</div>
                </Link>
              ))}
            </div>
          </Panel>
        )}

        {on.top_profit && (
          <Panel n={4} title="En Çok Kazandıran Satışlar" href={MODE_HREF.profit}>
            <div className="hi-list">
              {data.topProfit.length === 0 && <div className="hi-empty">Henüz kazançlı satış yok.</div>}
              {data.topProfit.map((l) => (
                <Link key={l.id} href={`/ilan/${l.id}`} className="hi-row hi-row--profit">
                  <Thumb src={l.coverImage} />
                  <div className="hi-row__body">
                    <div className="hi-row__title">{shortTitle(l.title)}</div>
                    <div className="hi-row__loc">{loc(l)}</div>
                    <div className="hi-profit-meta">
                      <span>{formatTl(l.askPrice)}</span>
                      <span>
                        Satış <strong>{formatTl(l.finalPrice || l.highestBid)}</strong>
                      </span>
                    </div>
                  </div>
                  <div className="hi-profit">+{formatTl(l.profit || 0)}</div>
                </Link>
              ))}
            </div>
          </Panel>
        )}
      </div>

      <div className="hi-row-grid">
        {on.turkey_map && (
          <Panel n={5} title={mapTitle} href="/ilanlar">
            <div className="hi-map">
              <div className="hi-map__canvas" aria-hidden>
                {data.turkeyMap.map((c) => {
                  const pos = CITY_POS[c.city] || {
                    x: 20 + (c.city.length * 7) % 60,
                    y: 25 + (c.count * 11) % 50,
                  };
                  const size = 10 + (c.count / maxMap) * 28;
                  return (
                    <span
                      key={c.city}
                      className="hi-map__dot"
                      title={`${c.city}: ${c.count}`}
                      style={{
                        left: `${pos.x}%`,
                        top: `${pos.y}%`,
                        width: size,
                        height: size,
                        opacity: 0.35 + (c.count / maxMap) * 0.65,
                      }}
                    />
                  );
                })}
              </div>
              <div className="hi-map__legend">
                <span>Düşük</span>
                <div className="hi-map__bar" />
                <span>Yüksek</span>
              </div>
              <div className="hi-map__cities">
                {data.turkeyMap.slice(0, 6).map((c) => (
                  <span key={c.city}>
                    {c.city} <strong>{c.count}</strong>
                  </span>
                ))}
                {!data.turkeyMap.length && <span>Şehir verisi yok.</span>}
              </div>
            </div>
          </Panel>
        )}

        {on.live_stats && (
          <Panel n={6} title="Canlı Teklif İstatistikleri" href={MODE_HREF.live}>
            <div className="hi-stats">
              <div className="hi-stat">
                <div className="hi-stat__label">Bugün Verilen Teklif</div>
                <div className="hi-stat__val">{formatCompact(data.liveStats.bidsToday)}</div>
                <div className={`hi-stat__chg ${data.liveStats.bidsTodayChangePct >= 0 ? "up" : "down"}`}>
                  {data.liveStats.bidsTodayChangePct >= 0 ? "▲" : "▼"} %{Math.abs(data.liveStats.bidsTodayChangePct)}
                </div>
              </div>
              <div className="hi-stat">
                <div className="hi-stat__label">Bugün Onaylanan</div>
                <div className="hi-stat__val">{formatCompact(data.liveStats.soldLast24h)}</div>
                <div className={`hi-stat__chg ${data.liveStats.soldLast24hChangePct >= 0 ? "up" : "down"}`}>
                  {data.liveStats.soldLast24hChangePct >= 0 ? "▲" : "▼"} %{Math.abs(data.liveStats.soldLast24hChangePct)}
                </div>
              </div>
              <div className="hi-stat">
                <div className="hi-stat__label">Toplam Teklif Hacmi</div>
                <div className="hi-stat__val hi-stat__val--sm">{volumeLabel(data.liveStats.totalBidVolumeTl)}</div>
                <div className={`hi-stat__chg ${data.liveStats.totalBidVolumeChangePct >= 0 ? "up" : "down"}`}>
                  {data.liveStats.totalBidVolumeChangePct >= 0 ? "▲" : "▼"} %{Math.abs(data.liveStats.totalBidVolumeChangePct)}
                </div>
              </div>
              <div className="hi-stat">
                <div className="hi-stat__label">Aktif İlan</div>
                <div className="hi-stat__val">{formatCompact(data.liveStats.activeListings)}</div>
              </div>
              <div className="hi-stat">
                <div className="hi-stat__label">Çevrimiçi (yaklaşık)</div>
                <div className="hi-stat__val">{formatCompact(data.liveStats.onlineUsers)}</div>
              </div>
              <div className="hi-stat">
                <div className="hi-stat__label">En Pahalı Teklif</div>
                {data.liveStats.topBidToday ? (
                  <>
                    <div className="hi-stat__val hi-stat__val--sm">{formatTl(data.liveStats.topBidToday.amount)}</div>
                    <Link href={`/ilan/${data.liveStats.topBidToday.listingId}`} className="hi-stat__link">
                      {shortTitle(data.liveStats.topBidToday.title)}
                    </Link>
                  </>
                ) : (
                  <div className="hi-stat__val hi-stat__val--sm">—</div>
                )}
              </div>
            </div>
          </Panel>
        )}

        {on.for_you && (
          <Panel n={7} title="Size Özel Öneriler" href={MODE_HREF.forYou}>
            <div className="hi-foryou-wrap">
              <button type="button" className="hi-foryou-nav prev" onClick={() => scrollForYou(-1)} aria-label="Önceki">
                <ChevronLeft size={18} />
              </button>
              <div className="hi-foryou-track" ref={forYouRef}>
                {data.forYou.length === 0 && <div className="hi-empty">Öneri bulunamadı.</div>}
                {data.forYou.map((l) => (
                  <Link key={l.id} href={`/ilan/${l.id}`} className="hi-foryou-card">
                    <span className="hi-foryou-badge">{l.badge}</span>
                    <div className="hi-foryou-img">
                      {l.coverImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={l.coverImage} alt="" />
                      ) : (
                        <div className="hi-thumb--ph" style={{ width: "100%", height: "100%" }} />
                      )}
                    </div>
                    <div className="hi-foryou-body">
                      <div className="hi-row__title">{shortTitle(l.title)}</div>
                      <div className="hi-row__loc">{loc(l)}</div>
                      <div className="hi-price">
                        {offersEnabled && l.highestBid
                          ? formatTl(l.highestBid)
                          : formatTl(l.askPrice)}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
              <button type="button" className="hi-foryou-nav next" onClick={() => scrollForYou(1)} aria-label="Sonraki">
                <ChevronRight size={18} />
              </button>
            </div>
          </Panel>
        )}
      </div>
    </div>
  );
}
