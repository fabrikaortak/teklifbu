"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Shield,
  Clock3,
  Users,
  Lock,
  Search,
} from "lucide-react";
import { ListingCard, ListingCardData } from "@/components/ListingCard";
import { formatCompact, formatTl } from "@/lib/format";
import { getCatIcon, StatIcon } from "@/components/CategoryIcons";
import { EMPTY_SEARCH_FILTERS, SearchFilters, SearchPanel } from "@/components/SearchPanel";
import { ListingViewToggle, useListingView } from "@/components/ListingViewToggle";
import { useTheme } from "@/components/ThemeProvider";
import { HomeV2 } from "@/components/home/HomeV2";
import { RecentSalesStrip } from "@/components/RecentSalesStrip";
import { HomeInsightPanels } from "@/components/HomeInsightPanels";

export default function HomePage() {
  const { theme, ready, offersEnabled } = useTheme();
  const router = useRouter();
  const [data, setData] = useState<{
    listings: ListingCardData[];
    stats: { activeListings: number; totalBids: number; buyers: number; sellers: number };
    categories: Array<{ slug: string; name: string; icon?: string | null; _count: { listings: number } }>;
  } | null>(null);
  const [live, setLive] = useState<
    Array<{
      id: string;
      amount: number;
      createdAt: string;
      listing: {
        id: string;
        title: string;
        city: string;
        district?: string | null;
        coverImage?: string | null;
        askPrice?: number;
      };
    }>
  >([]);
  const [filters, setFilters] = useState<SearchFilters>({ ...EMPTY_SEARCH_FILTERS, category: "konut" });
  const [quickQ, setQuickQ] = useState("");
  const { view: featuredView, changeView: setFeaturedView } = useListingView("teklifbu:home-featured-view", "grid");
  const { view: latestView, changeView: setLatestView } = useListingView("teklifbu:home-latest-view", "grid");

  useEffect(() => {
    fetch("/api/listings?featured=1&home=1")
      .then((r) => r.json())
      .then(setData);
    const sideUrl = offersEnabled ? "/api/listings?live=1" : "/api/listings?limit=8";
    fetch(sideUrl)
      .then((r) => r.json())
      .then((d) => {
        if (offersEnabled) {
          setLive(d.items || []);
          return;
        }
        setLive(
          (d.listings || []).map((l: ListingCardData) => ({
            id: l.id,
            amount: Number(l.askPrice) || 0,
            createdAt: String(l.createdAt || new Date().toISOString()),
            listing: {
              id: l.id,
              title: l.title,
              city: l.city,
              district: l.district,
              coverImage: l.coverImage,
              askPrice: l.askPrice,
            },
          }))
        );
      });
  }, [offersEnabled]);

  const featured = useMemo(() => data?.listings || [], [data]);
  const latest = useMemo(() => data?.listings || [], [data]);

  function submitQuickSearch(e: FormEvent) {
    e.preventDefault();
    const q = quickQ.trim();
    router.push(q ? `/ilanlar?q=${encodeURIComponent(q)}` : "/ilanlar");
  }

  if (!ready) {
    return <div style={{ padding: 48, textAlign: "center", color: "var(--muted)" }}>Yükleniyor…</div>;
  }

  if (theme === "v2") {
    return <HomeV2 />;
  }

  return (
    <div>
      {/* HERO: sol metin+istatistik, sağ arama */}
      <section style={{ background: "linear-gradient(180deg, #eef2f7 0%, #f8fafc 100%)", padding: "42px 0 28px" }}>
        <div
          className="page-shell-wide hero-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "1.12fr minmax(420px, 1.08fr)",
            gap: 22,
            alignItems: "stretch",
          }}
        >
          <div className="hero-left">
            <div>
              <h1
                className="hero-title"
                style={{
                  fontSize: "clamp(32px, 4.2vw, 48px)",
                  lineHeight: 1.18,
                  fontWeight: 800,
                  margin: 0,
                  letterSpacing: "-0.03em",
                  color: "#0b1220",
                }}
              >
                <span style={{ display: "block", color: "#0b1220" }}>Gerçek satıcılar,</span>
                <span style={{ display: "block", color: "var(--orange)" }}>gerçek alıcılarla buluşur.</span>
              </h1>
              <p style={{ marginTop: 16, color: "#0b1220", maxWidth: 440, fontSize: 17, lineHeight: 1.5, fontWeight: 600, letterSpacing: "-0.01em" }}>
                Teklifleri gör, piyasayı keşfet,
                <br />
                en doğru fiyatı birlikte belirleyelim.
              </p>
            </div>

            <div style={{ marginTop: "auto", display: "grid", gap: 10 }}>
              <form className="hero-quick-search" onSubmit={submitQuickSearch}>
                <Search size={18} strokeWidth={2.25} aria-hidden />
                <input
                  type="search"
                  value={quickQ}
                  onChange={(e) => setQuickQ(e.target.value)}
                  placeholder="Başlık veya 12 haneli ilan no ile ara..."
                  aria-label="İlan ara"
                />
                <button type="submit" className="btn-orange">
                  Ara
                </button>
              </form>

              <div
                className="hero-stats"
                style={{
                  display: "grid",
                  gridTemplateColumns: offersEnabled ? "repeat(4, minmax(0, 1fr))" : "repeat(3, minmax(0, 1fr))",
                  gap: 10,
                }}
              >
                {(
                  [
                    { icon: <StatIcon.listings size={26} />, label: "Aktif İlan", value: data?.stats.activeListings ?? 0 },
                    ...(offersEnabled
                      ? [{ icon: <StatIcon.bids size={26} />, label: "Toplam Teklif", value: data?.stats.totalBids ?? 0 }]
                      : []),
                    { icon: <StatIcon.buyers size={26} />, label: "Mutlu Alıcı", value: data?.stats.buyers ?? 0 },
                    { icon: <StatIcon.sellers size={26} />, label: "Mutlu Satıcı", value: data?.stats.sellers ?? 0 },
                  ]
                ).map((s) => (
                  <div key={s.label} className="card" style={{ padding: "12px 10px", display: "flex", gap: 8, alignItems: "center" }}>
                    <div style={{ flexShrink: 0, display: "grid", placeItems: "center" }}>{s.icon}</div>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 18 }}>{formatCompact(s.value)}</div>
                      <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>{s.label}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <SearchPanel value={filters} onChange={setFilters} categories={data?.categories || []} variant="hero" showCategoryTabs />
        </div>
      </section>

      <section className="page-shell-wide" style={{ paddingTop: 8, paddingBottom: 28 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 12 }}>
          {(data?.categories || []).map((c) => (
            <Link key={c.slug} href={`/ilanlar?category=${c.slug}`} className="card" style={{ padding: 14, textAlign: "center", display: "grid", gap: 8, placeItems: "center" }}>
              {getCatIcon(c.slug, 36)}
              <div style={{ fontWeight: 700, fontSize: 13 }}>{c.name}</div>
              <div style={{ fontSize: 12, color: "var(--muted)" }}>{c._count.listings} ilan</div>
            </Link>
          ))}
        </div>
      </section>

      <section className="page-shell-wide" style={{ paddingBottom: 40 }}>
        <div className="home-main-grid" style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 20 }}>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>Öne çıkan ilanlar</h2>
              <ListingViewToggle view={featuredView} onChange={setFeaturedView} />
            </div>
            <div
              className={`${featuredView === "grid" ? "listings-grid-4 home-featured-grid" : "listings-stack"} featured-vitrin`}
              style={featuredView === "list" ? { display: "grid", gap: 10 } : undefined}
            >
              {featured.map((l) => (
                <ListingCard
                  key={l.id}
                  listing={l}
                  variant={featuredView === "list" ? "row" : "grid"}
                  homeMode
                  featuredSection
                />
              ))}
            </div>
          </div>
          <aside>
            <div className="card home-live" style={{ padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>
                  {offersEnabled ? "Canlı teklifler" : "Son eklenen ilanlar"}
                </h3>
                <Link
                  href={offersEnabled ? "/ilanlar?live=1" : "/ilanlar"}
                  style={{ fontSize: 12, fontWeight: 700, color: "var(--orange)" }}
                >
                  Tümünü Gör ›
                </Link>
              </div>
              <div className="home-live-list" style={{ display: "grid", gap: 8 }}>
                {live.slice(0, 6).map((b) => (
                  <Link key={b.id} href={`/ilan/${b.listing.id}`} style={{ display: "grid", gridTemplateColumns: "48px 1fr", gap: 8 }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={b.listing.coverImage || ""} alt="" style={{ width: 48, height: 48, objectFit: "cover", borderRadius: 8 }} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>{b.listing.title}</div>
                      <div style={{ color: "var(--green)", fontWeight: 800, fontSize: 13 }}>
                        {formatTl(offersEnabled ? b.amount : Number(b.listing.askPrice || b.amount || 0))}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
            {offersEnabled ? (
            <div className="card home-token" style={{ marginTop: 12, padding: 16, background: "var(--navy)", color: "#fff" }}>
              <h3 style={{ margin: "0 0 8px", fontSize: 15 }}>Jeton paketleri</h3>
              <p style={{ margin: "0 0 12px", fontSize: 13, opacity: 0.85 }}>Teklif vermek için jeton alın.</p>
              <Link href="/jeton" className="btn-orange" style={{ display: "inline-block", padding: "10px 14px" }}>
                Paketleri İncele
              </Link>
            </div>
            ) : null}
          </aside>
        </div>
      </section>

      {offersEnabled ? <RecentSalesStrip placement="home" /> : null}
      <HomeInsightPanels />

      <section className="page-shell-wide" style={{ paddingBottom: 48 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }} className="hide-mobile">
          {(offersEnabled
            ? [
                { icon: <Shield size={22} />, t: "Güvenli teklif" },
                { icon: <Clock3 size={22} />, t: "Şeffaf süre" },
                { icon: <Users size={22} />, t: "Gerçek kullanıcılar" },
                { icon: <Lock size={22} />, t: "Kişisel veri koruması" },
              ]
            : [
                { icon: <Shield size={22} />, t: "Güvenli ilan" },
                { icon: <Users size={22} />, t: "Gerçek kullanıcılar" },
                { icon: <Lock size={22} />, t: "Kişisel veri koruması" },
                { icon: <Clock3 size={22} />, t: "Güncel vitrin" },
              ]
          ).map((x) => (
            <div key={x.t} className="card" style={{ padding: 16, display: "flex", gap: 10, alignItems: "center" }}>
              <span style={{ color: "var(--orange)" }}>{x.icon}</span>
              <strong style={{ fontSize: 14 }}>{x.t}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="page-shell-wide" style={{ paddingBottom: 56 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>Son ilanlar</h2>
          <ListingViewToggle view={latestView} onChange={setLatestView} />
        </div>
        <div className={latestView === "grid" ? "listings-grid-4" : "listings-stack"} style={latestView === "list" ? { display: "grid", gap: 10 } : undefined}>
          {latest.map((l) => (
            <ListingCard key={l.id} listing={l} variant={latestView === "list" ? "row" : "grid"} homeMode />
          ))}
        </div>
      </section>
    </div>
  );
}
