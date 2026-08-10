"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { AdminVertical } from "@/lib/adminVertical";
import { ADMIN_VERTICAL_META } from "@/lib/adminVertical";
import {
  AdminBidsPanel,
  AdminContentPanel,
  AdminListingsPanel,
  AdminSettingsPanel,
  AdminShopsManagePanel,
  AdminShopsPanel,
} from "@/components/admin/AdminPanels";
import { AdminCategoryTreePanel } from "@/components/admin/AdminCategoryTreePanel";
import { AdminListingApprovalPanel } from "@/components/admin/AdminListingApprovalPanel";
import { AdminEditRequestPanel } from "@/components/admin/AdminEditRequestPanel";
import { AdminBulkListingUpdatePanel } from "@/components/admin/AdminBulkListingUpdatePanel";
import { AdminExtensionPanel } from "@/components/admin/AdminExtensionPanel";
import { AdminDemoListingsPanel } from "@/components/admin/AdminDemoListingsPanel";
import { AdminAdsPanel } from "@/components/admin/AdminAdsPanel";
import {
  AdmGlassCard,
  AdmHero,
  AdmKpiGrid,
  AdmQuickLink,
  type AdmKpiItem,
} from "@/components/admin/AdminOverviewUI";
import { formatCompact, formatTl } from "@/lib/format";
import {
  BadgeCheck,
  Building2,
  Car,
  Clock3,
  FileText,
  Hotel,
  PencilLine,
  ShoppingBag,
  Sparkles,
  Tags,
  TrendingUp,
} from "lucide-react";

function Head({ title, description }: { title: string; description: string }) {
  return (
    <div className="adm-page-head">
      <div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
    </div>
  );
}

type VerticalOverviewData = {
  vertical: AdminVertical;
  kpis: {
    totalListings: number;
    activeListings: number;
    pendingReview: number;
    pendingEdit: number;
    pendingExtension: number;
    totalBids: number;
    trends: { listings: number; bids: number };
  };
  topCategories: Array<{ slug: string; name: string; count: number }>;
  recentListings: Array<{
    id: string;
    title: string;
    status: string;
    city: string | null;
    coverImage: string | null;
    askPrice: number;
    updatedAt: string;
    categoryName: string;
  }>;
};

const VERTICAL_UI: Record<
  AdminVertical,
  {
    accent: "orange" | "blue" | "violet" | "emerald";
    eyebrow: string;
    blurb: string;
    Icon: typeof Car;
  }
> = {
  "emlak-vasita": {
    accent: "orange",
    eyebrow: "Vasıta & Emlak",
    blurb: "Konut, araç ve makine ilanları — onay, teklif ve kategori yönetimi.",
    Icon: Car,
  },
  alisveris: {
    accent: "blue",
    eyebrow: "Alışveriş",
    blurb: "İkinci el / sıfır ürün. Siparişler, mağaza paketleri ve abonelikler alt menüde.",
    Icon: ShoppingBag,
  },
  premium: {
    accent: "violet",
    eyebrow: "Premium",
    blurb: "Otel, lojistik ve yolculuk dikeyleri. Kapalı dikeyler vitrinde gizlenir.",
    Icon: Hotel,
  },
};

const CAT_COLORS = ["#f97316", "#3b82f6", "#22c55e", "#a855f7", "#eab308", "#06b6d4", "#ec4899", "#94a3b8"];

export function VerticalOverviewPage({ vertical }: { vertical: AdminVertical }) {
  const meta = ADMIN_VERTICAL_META[vertical];
  const ui = VERTICAL_UI[vertical];
  const base = meta.basePath;
  const [data, setData] = useState<VerticalOverviewData | null>(null);

  useEffect(() => {
    fetch(`/api/admin?view=vertical-overview&vertical=${encodeURIComponent(vertical)}`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData(null));
  }, [vertical]);

  const kpis: AdmKpiItem[] = useMemo(() => {
    if (!data?.kpis) return [];
    const k = data.kpis;
    return [
      {
        label: "Toplam ilan",
        value: formatCompact(k.totalListings),
        hint: "Bu dikeyde",
        trend: k.trends.listings,
        icon: FileText,
        tone: "orange",
        href: `${base}/ilanlar`,
      },
      {
        label: "Aktif ilan",
        value: formatCompact(k.activeListings),
        icon: BadgeCheck,
        tone: "emerald",
        href: `${base}/ilanlar`,
      },
      {
        label: "Onay bekleyen",
        value: formatCompact(k.pendingReview),
        hint: k.pendingReview ? "İnceleme gerekli" : "Temiz",
        icon: Clock3,
        tone: k.pendingReview ? "rose" : "slate",
        href: `${base}/ilan-onay`,
      },
      {
        label: "Düzenleme",
        value: formatCompact(k.pendingEdit),
        icon: PencilLine,
        tone: k.pendingEdit ? "violet" : "slate",
        href: `${base}/duzenleme-onay`,
      },
      {
        label: "Ek süre",
        value: formatCompact(k.pendingExtension),
        icon: Clock3,
        tone: k.pendingExtension ? "blue" : "slate",
        href: `${base}/ek-sure`,
      },
      {
        label: "Teklifler",
        value: formatCompact(k.totalBids),
        trend: k.trends.bids,
        icon: TrendingUp,
        tone: "blue",
        href: `${base}/teklifler`,
      },
    ];
  }, [data, base]);

  const quickLinks = useMemo(() => {
    const links: Array<{ href: string; label: string; description?: string; badge?: number }> = [
      { href: `${base}/ilanlar`, label: "İlanlar", description: "Dikeydeki tüm ilanlar" },
      {
        href: `${base}/ilan-onay`,
        label: "İlan onayları",
        description: "Yayına gönderilenler",
        badge: data?.kpis.pendingReview,
      },
      {
        href: `${base}/duzenleme-onay`,
        label: "Düzenleme talepleri",
        badge: data?.kpis.pendingEdit,
      },
      { href: `${base}/teklifler`, label: "Teklifler", description: "Bu dikeydeki teklifler" },
      { href: `${base}/kategoriler`, label: "Kategoriler", description: "Menü ağacı ve görünürlük" },
      { href: `${base}/ayarlar`, label: "Ayarlar", description: "Dikey kuralları" },
    ];
    if (vertical === "alisveris") {
      links.splice(1, 0, {
        href: `${base}/siparisler`,
        label: "Siparişler",
        description: "Tüm Güvenli Öde siparişleri",
      });
      links.splice(6, 0, {
        href: `${base}/magaza-paketleri`,
        label: "Mağaza paketleri",
        description: "Paket tanımları",
      });
    }
    return links;
  }, [base, data, vertical]);

  const Icon = ui.Icon;
  const catTotal = data?.topCategories.reduce((a, c) => a + c.count, 0) || 1;

  return (
    <div>
      <AdmHero
        accent={ui.accent}
        eyebrow={ui.eyebrow}
        title={
          <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
            <Icon size={28} strokeWidth={2.2} />
            {meta.label} özeti
          </span>
        }
        subtitle={ui.blurb}
        actions={
          <>
            <Link
              href={`${base}/ilan-onay`}
              style={{
                border: "none",
                borderRadius: 999,
                padding: "7px 12px",
                background: "#fff",
                color: "#0f172a",
                fontWeight: 800,
                fontSize: 12.5,
                textDecoration: "none",
              }}
            >
              Onaylara git
            </Link>
            <Link
              href={`${base}/kategoriler`}
              style={{
                border: "none",
                borderRadius: 999,
                padding: "7px 12px",
                background: "rgba(255,255,255,0.14)",
                color: "#fff",
                fontWeight: 700,
                fontSize: 12.5,
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Tags size={13} /> Kategoriler
            </Link>
          </>
        }
      />

      {!data ? (
        <AdmGlassCard style={{ padding: 20, color: "#64748b", fontWeight: 600 }}>Özet yükleniyor…</AdmGlassCard>
      ) : (
        <>
          <AdmKpiGrid items={kpis} />

          <div className="adm-overview-split">
            <AdmGlassCard style={{ padding: 14 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 12,
                }}
              >
                <h3 style={{ margin: 0, fontSize: 14.5, fontWeight: 800 }}>Son ilanlar</h3>
                <Link href={`${base}/ilanlar`} style={{ fontSize: 12, fontWeight: 700, color: "#ea580c" }}>
                  Tümü
                </Link>
              </div>
              <div style={{ display: "grid", gap: 8 }}>
                {data.recentListings.length === 0 ? (
                  <div style={{ color: "#94a3b8", fontSize: 13, padding: "12px 0" }}>Henüz ilan yok.</div>
                ) : (
                  data.recentListings.map((l) => (
                    <Link
                      key={l.id}
                      href={`/ilan/${l.id}`}
                      style={{
                        display: "flex",
                        gap: 10,
                        alignItems: "center",
                        textDecoration: "none",
                        color: "inherit",
                        padding: "6px 4px",
                        borderRadius: 10,
                      }}
                    >
                      <div
                        style={{
                          width: 42,
                          height: 42,
                          borderRadius: 10,
                          overflow: "hidden",
                          background: "#f1f5f9",
                          flexShrink: 0,
                        }}
                      >
                        {l.coverImage ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={l.coverImage}
                            alt=""
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          />
                        ) : null}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontWeight: 750,
                            fontSize: 13,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {l.title}
                        </div>
                        <div style={{ fontSize: 11.5, color: "#94a3b8", marginTop: 2 }}>
                          {l.categoryName}
                          {l.city ? ` · ${l.city}` : ""} · {l.status}
                        </div>
                      </div>
                      <div style={{ fontWeight: 800, fontSize: 12.5, color: "#0f172a", whiteSpace: "nowrap" }}>
                        {formatTl(l.askPrice)}
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </AdmGlassCard>

            <div style={{ display: "grid", gap: 12 }}>
              <AdmGlassCard style={{ padding: 14 }}>
                <h3 style={{ margin: "0 0 12px", fontSize: 14.5, fontWeight: 800 }}>Kategori dağılımı</h3>
                {data.topCategories.length === 0 ? (
                  <div style={{ color: "#94a3b8", fontSize: 13 }}>Kategori yok.</div>
                ) : (
                  <div style={{ display: "grid", gap: 8 }}>
                    {data.topCategories.map((c, i) => {
                      const pct = Math.round((c.count / catTotal) * 100);
                      return (
                        <div key={c.slug}>
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              fontSize: 12,
                              marginBottom: 4,
                            }}
                          >
                            <span style={{ fontWeight: 700, color: "#334155" }}>{c.name}</span>
                            <span style={{ color: "#94a3b8", fontWeight: 700 }}>
                              {formatCompact(c.count)} · %{pct}
                            </span>
                          </div>
                          <div style={{ height: 6, borderRadius: 99, background: "#f1f5f9", overflow: "hidden" }}>
                            <div
                              style={{
                                width: `${Math.max(4, pct)}%`,
                                height: "100%",
                                borderRadius: 99,
                                background: CAT_COLORS[i % CAT_COLORS.length],
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </AdmGlassCard>

              <AdmGlassCard style={{ padding: 14 }}>
                <h3 style={{ margin: "0 0 10px", fontSize: 14.5, fontWeight: 800 }}>Hızlı erişim</h3>
                <div style={{ display: "grid", gap: 7 }}>
                  {quickLinks.map((q) => (
                    <AdmQuickLink key={q.href + q.label} {...q} />
                  ))}
                </div>
              </AdmGlassCard>
            </div>
          </div>

          {vertical === "premium" ? (
            <AdmGlassCard style={{ padding: 14, marginTop: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <Sparkles size={15} color="#7c3aed" />
                <strong style={{ fontSize: 13.5 }}>Premium akış</strong>
              </div>
              <ol style={{ margin: 0, paddingLeft: 18, color: "#475569", fontSize: 13.5, lineHeight: 1.55 }}>
                <li>
                  Dikey açık → ana sayfa sidebar’da «Premium» görünür; tıklanınca <code>/premium</code>.
                </li>
                <li>Premium sayfada kategoriler üstte, klasik menü altta.</li>
                <li>
                  Kart adedi ve dikey aç/kapa için <strong>Ayarlar</strong>.
                </li>
              </ol>
            </AdmGlassCard>
          ) : null}

          {vertical === "emlak-vasita" ? (
            <AdmGlassCard
              style={{
                padding: 12,
                marginTop: 12,
                display: "flex",
                gap: 10,
                alignItems: "center",
                color: "#64748b",
                fontSize: 13,
              }}
            >
              <Building2 size={16} />
              İş / tarım / sanayi makineleri bu dikeyededir; alışveriş menüsünde değil.
            </AdmGlassCard>
          ) : null}
        </>
      )}
    </div>
  );
}

export function VerticalSettingsPage({ vertical }: { vertical: AdminVertical }) {
  const meta = ADMIN_VERTICAL_META[vertical];

  if (vertical === "premium") {
    return (
      <div>
        <Head
          title="Premium — Ayarlar"
          description="Dikey aç/kapa, vitrin kartı adetleri ve premium özellik jeton fiyatları."
        />
        <div style={{ display: "grid", gap: 20 }}>
          <AdminSettingsPanel onlyGroups={["premium"]} />
          <AdminSettingsPanel
            onlyKeys={[
              "premium_pay_with_tokens_enabled",
              "premium_title_bold_tl",
              "premium_title_large_tl",
              "premium_colored_tl",
              "premium_feature_3d_tl",
              "premium_feature_7d_tl",
              "premium_title_bold_tokens",
              "premium_title_large_tokens",
              "premium_colored_tokens",
              "premium_feature_3d_tokens",
              "premium_feature_7d_tokens",
              "premium_badge_rule",
            ]}
          />
        </div>
      </div>
    );
  }

  if (vertical === "alisveris") {
    return (
      <div>
        <Head
          title={`${meta.label} — Ayarlar`}
          description="Mağaza paketi satış kuralları. Paket tanımları Mağaza paketleri / Abonelikler menüsündedir."
        />
        <div style={{ display: "grid", gap: 20 }}>
          <AdminSettingsPanel
            onlyKeys={[
              "shop_package_buy_popup_bireysel",
              "shop_package_buy_popup_ticari",
              "shop_package_pay_with_tokens_enabled",
              "shopping_listing_form_template",
              "shopping_listing_detail_template",
              "shopping_offers_enabled",
            ]}
          />
          <div className="adm-card" style={{ padding: 16, lineHeight: 1.55 }}>
            <p style={{ margin: 0, color: "#475569", fontSize: 14 }}>
              <strong>İlan giriş formu:</strong> Modern Tema seçilirse alışveriş ilanı Hesabım içinde adımlı
              (Temel Bilgiler → … → Yayınla) formda açılır. Detay şablonu ürün sayfası görünümünü belirler.
              Ticari üyelik onayı için Platform → Kullanıcılar → Ticari Üyeler.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Head
        title={`${meta.label} — Ayarlar`}
        description="Kart favorisi, ilan süreleri ve yaşam döngüsü."
      />
      <div style={{ display: "grid", gap: 20 }}>
        <div className="adm-card" style={{ padding: 16 }}>
          <h2 style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 800 }}>Vitrin & liste</h2>
          <p style={{ margin: "0 0 14px", fontSize: 13, color: "#64748b", lineHeight: 1.45 }}>
            Ana sayfa / vitrin / ilan listesi kartlarındaki kalp butonu. Kapalıysa favori yalnızca ilan
            detayındaki «Favorilere Ekle» ile yapılır.
          </p>
          <AdminSettingsPanel onlyKeys={["listing_card_favorites_enabled"]} />
        </div>
        <div className="adm-card" style={{ padding: 16 }}>
          <h2 style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 800 }}>Yeniden yayınlama</h2>
          <p style={{ margin: "0 0 14px", fontSize: 13, color: "#64748b", lineHeight: 1.45 }}>
            Metni yarın/öbür gün buradan değiştirebilirsiniz. İlan adı yazmaya gerek yok.
            Yer tutucu: {"{{reason}}"}.
          </p>
          <AdminSettingsPanel
            onlyKeys={[
              "listing_republish_reasons",
              "listing_republish_winner_notify_title",
              "listing_republish_winner_notify_body",
            ]}
          />
        </div>
        <AdminSettingsPanel
          onlyGroups={["listing"]}
          excludeKeys={[
            "listing_card_favorites_enabled",
            "listing_republish_reasons",
            "listing_republish_winner_notify_title",
            "listing_republish_winner_notify_body",
            "listing_fee_mode",
            "listing_free_quota",
            "listing_free_quota_by_account_type",
            "listing_fee_tl",
            "listing_fee_by_account_type",
            "listing_fee_vat_percent",
            "listing_fee_prices_include_vat",
            "premium_pay_with_tokens_enabled",
            "premium_title_bold_tl",
            "premium_title_large_tl",
            "premium_colored_tl",
            "premium_feature_3d_tl",
            "premium_feature_7d_tl",
            "premium_title_bold_tokens",
            "premium_title_large_tokens",
            "premium_colored_tokens",
            "premium_feature_3d_tokens",
            "premium_feature_7d_tokens",
            "premium_badge_rule",
            "browse_nav_config",
          ]}
        />
        <div className="adm-card" style={{ padding: 14, lineHeight: 1.5, fontSize: 13, color: "#64748b" }}>
          İlan hakkı / ücretsiz kota / üyelik tipine göre ücretler Platform →{" "}
          <strong>Kullanıcı ayarları</strong> içindedir. Süre dolunca ayarları{" "}
          <strong>Sistem ayarları</strong> içindedir.
        </div>
      </div>
    </div>
  );
}

export function VerticalListingsPage({ vertical }: { vertical: AdminVertical }) {
  const meta = ADMIN_VERTICAL_META[vertical];
  return (
    <div>
      <Head title="İlanlar" description={`${meta.label} dikeyindeki ilanlar.`} />
      <AdminListingsPanel vertical={vertical} />
    </div>
  );
}

export function VerticalApprovalPage({ vertical }: { vertical: AdminVertical }) {
  const meta = ADMIN_VERTICAL_META[vertical];
  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900 }}>İlan Onayları</h1>
        <p style={{ margin: "6px 0 0", color: "#64748b", fontSize: 14 }}>
          {meta.label} — yayına gönderilen ilanları inceleyin.
        </p>
      </div>
      <AdminListingApprovalPanel vertical={vertical} />
    </div>
  );
}

export function VerticalEditRequestPage({ vertical }: { vertical: AdminVertical }) {
  const meta = ADMIN_VERTICAL_META[vertical];
  return (
    <div style={{ display: "grid", gap: 28 }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 22 }}>Düzenleme Talepleri</h1>
        <p style={{ margin: "6px 0 0", color: "var(--muted)", fontSize: 14 }}>
          {meta.label} — tekil düzenleme istekleri
          {vertical === "alisveris" ? " ve toplu güncellemeler" : ""}.
        </p>
      </div>
      {vertical === "alisveris" || vertical === "emlak-vasita" ? (
        <div>
          <h2 style={{ margin: "0 0 12px", fontSize: 18 }}>Toplu ilan güncelleme</h2>
          <p style={{ margin: "0 0 10px", fontSize: 13, color: "var(--muted)" }}>
            Toplu talepler satıcı bazlıdır; dikey filtresi uygulanmaz.
          </p>
          <AdminBulkListingUpdatePanel />
        </div>
      ) : null}
      <div>
        <h2 style={{ margin: "0 0 12px", fontSize: 18 }}>Tekil düzenleme talepleri</h2>
        <AdminEditRequestPanel vertical={vertical} />
      </div>
    </div>
  );
}

export function VerticalExtensionPage({ vertical }: { vertical: AdminVertical }) {
  const meta = ADMIN_VERTICAL_META[vertical];
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 22 }}>Ek Süre Talepleri</h1>
        <p style={{ margin: "6px 0 0", color: "var(--muted)", fontSize: 14 }}>
          {meta.label} — ek süre isteklerini onaylayın veya reddedin.
        </p>
      </div>
      <AdminExtensionPanel vertical={vertical} />
    </div>
  );
}

export function VerticalBidsPage({ vertical }: { vertical: AdminVertical }) {
  const meta = ADMIN_VERTICAL_META[vertical];
  return (
    <div>
      <Head title="Teklifler" description={`${meta.label} ilanlarına verilen teklifler (bid/offer).`} />
      <AdminBidsPanel vertical={vertical} />
    </div>
  );
}

export function VerticalCategoriesPage({ vertical }: { vertical: AdminVertical }) {
  const meta = ADMIN_VERTICAL_META[vertical];
  return (
    <div>
      <Head title="Kategoriler" description={`${meta.label} kategorileri.`} />
      <AdminCategoryTreePanel vertical={vertical} />
    </div>
  );
}

export function VerticalDemoPage({ vertical }: { vertical: AdminVertical }) {
  const meta = ADMIN_VERTICAL_META[vertical];
  return (
    <div>
      <h1 style={{ marginTop: 0, fontSize: 22, fontWeight: 800 }}>Demo İlanlar — {meta.shortLabel}</h1>
      <AdminDemoListingsPanel vertical={vertical} />
    </div>
  );
}

export function VerticalContentPage({ vertical }: { vertical: AdminVertical }) {
  const meta = ADMIN_VERTICAL_META[vertical];
  return (
    <div>
      <Head
        title="İçerik"
        description={`${meta.label} yardım / SSS içeriği. Slug öneki: ${meta.contentSlugPrefix}`}
      />
      <AdminContentPanel vertical={vertical} />
    </div>
  );
}

export function VerticalAdsPage({ vertical }: { vertical: AdminVertical }) {
  const meta = ADMIN_VERTICAL_META[vertical];
  return (
    <div>
      <Head
        title="Reklam Alanları"
        description={`${meta.label} reklam slaytları. Site-geneli kuşaklar Platform → Reklam’da.`}
      />
      <AdminAdsPanel vertical={vertical} />
    </div>
  );
}

export function VerticalShopPackagesPage() {
  return (
    <div>
      <Head title="Mağaza Paketleri" description="Alışveriş dikeyi — ilan / mağaza paket tanımları." />
      <AdminShopsPanel />
    </div>
  );
}

export function VerticalSubscriptionsPage() {
  return (
    <div>
      <Head title="Abonelikler" description="Mağazalara paket atayın ve abonelikleri yönetin." />
      <AdminShopsManagePanel />
    </div>
  );
}
