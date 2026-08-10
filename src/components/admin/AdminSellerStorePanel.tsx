"use client";

import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import { formatTl } from "@/lib/format";
import { AdminToast } from "@/components/admin/AdminToast";
import { AdminSettingsPanel } from "@/components/admin/AdminPanels";
import { AdminListingQuotaPanel } from "@/components/admin/AdminListingQuotaPanel";

/* ─── shared styles ─── */
const card: CSSProperties = {
  background: "#fff",
  border: "1px solid #e2e8f0",
  borderRadius: 16,
  padding: 16,
  boxShadow: "0 1px 2px rgba(15,23,42,.04)",
};

function Kpi({
  label,
  value,
  href,
  tone,
}: {
  label: string;
  value: number;
  href?: string;
  tone?: "ok" | "warn" | "danger" | "neutral";
}) {
  const bg =
    tone === "ok"
      ? "#ecfdf5"
      : tone === "warn"
        ? "#fffbeb"
        : tone === "danger"
          ? "#fef2f2"
          : "#f8fafc";
  const border =
    tone === "ok"
      ? "#a7f3d0"
      : tone === "warn"
        ? "#fde68a"
        : tone === "danger"
          ? "#fecaca"
          : "#e2e8f0";
  const inner = (
    <div style={{ ...card, background: bg, borderColor: border, padding: 14 }}>
      <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: "-0.03em" }}>{value}</div>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: "#64748b", marginTop: 2 }}>{label}</div>
    </div>
  );
  if (href) {
    return (
      <Link href={href} style={{ textDecoration: "none", color: "inherit" }}>
        {inner}
      </Link>
    );
  }
  return inner;
}

function Pill({ children, tone }: { children: ReactNode; tone?: string }) {
  const map: Record<string, { bg: string; color: string }> = {
    ok: { bg: "#dcfce7", color: "#166534" },
    warn: { bg: "#fef3c7", color: "#92400e" },
    danger: { bg: "#fee2e2", color: "#991b1b" },
    info: { bg: "#dbeafe", color: "#1e40af" },
    neutral: { bg: "#f1f5f9", color: "#475569" },
  };
  const s = map[tone || "neutral"] || map.neutral;
  return (
    <span
      style={{
        display: "inline-flex",
        padding: "3px 8px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 800,
        background: s.bg,
        color: s.color,
      }}
    >
      {children}
    </span>
  );
}

const STATUS_TR: Record<string, { label: string; tone: string }> = {
  AWAITING_PAYMENT: { label: "Ödeme bekliyor", tone: "neutral" },
  FUNDED: { label: "Ödendi", tone: "warn" },
  AWAITING_SHIPMENT: { label: "Kargo bekliyor", tone: "warn" },
  SHIPPED: { label: "Yolda", tone: "info" },
  BUYER_REVIEW: { label: "Alıcı incelemesi", tone: "info" },
  RELEASED: { label: "Tamamlandı", tone: "ok" },
  REFUNDED: { label: "İade", tone: "danger" },
  DISPUTED: { label: "Anlaşmazlık", tone: "danger" },
  CANCELLED: { label: "İptal", tone: "neutral" },
  EXPIRED: { label: "Süresi doldu", tone: "neutral" },
};

/* ─── Overview ─── */
export function AdminSellerPanelOverview() {
  const [data, setData] = useState<{
    panelEnabled: boolean;
    commissionPct: number;
    qaSlaHours: number;
    kpis: Record<string, number>;
  } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin?view=seller-panel-overview")
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Yüklenemedi");
        setData(d);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Hata"));
  }, []);

  if (error) return <div className="adm-card" style={{ color: "#b91c1c" }}>{error}</div>;
  if (!data) return <div className="adm-card">Yükleniyor…</div>;
  const k = data.kpis;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ ...card, display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 850 }}>Satıcı / Mağaza paneli durumu</div>
          <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>
            Panel {data.panelEnabled ? "açık" : "kapalı"} · Güvenli Öde komisyon %{data.commissionPct} · Soru SLA{" "}
            {data.qaSlaHours}s
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link href="/admin/satici-paneli/ayarlar" className="btn-orange" style={{ padding: "10px 14px", textDecoration: "none" }}>
            Ayarlar
          </Link>
          <Link href="/admin/satici-paneli/siparisler" className="btn-outline" style={{ padding: "10px 14px", textDecoration: "none" }}>
            Siparişler
          </Link>
        </div>
      </div>

      <div>
        <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8, color: "#475569" }}>Sipariş & kargo</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(140px,1fr))", gap: 10 }}>
          <Kpi label="Kargo bekleyen" value={k.awaitShip || 0} tone={k.awaitShip ? "warn" : "ok"} href="/admin/satici-paneli/siparisler?t=ship" />
          <Kpi label="Yolda / inceleme" value={k.inTransit || 0} href="/admin/satici-paneli/siparisler?t=transit" />
          <Kpi label="Anlaşmazlık" value={k.disputed || 0} tone={k.disputed ? "danger" : "neutral"} href="/admin/satici-paneli/siparisler?t=dispute" />
          <Kpi label="Tamamlanan" value={k.completed || 0} tone="ok" href="/admin/satici-paneli/siparisler?t=done" />
          <Kpi label="İade" value={k.refunded || 0} href="/admin/satici-paneli/siparisler?t=refund" />
        </div>
      </div>

      <div>
        <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8, color: "#475569" }}>Soru–cevap</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(140px,1fr))", gap: 10 }}>
          <Kpi label="Açık soru" value={k.openQuestions || 0} tone={k.openQuestions ? "warn" : "ok"} href="/admin/satici-paneli/sorular?f=open" />
          <Kpi label="SLA aşan" value={k.overdueQuestions || 0} tone={k.overdueQuestions ? "danger" : "neutral"} href="/admin/satici-paneli/sorular?f=overdue" />
          <Kpi label="Yanıtlanan" value={k.answeredQuestions || 0} href="/admin/satici-paneli/sorular?f=answered" />
        </div>
      </div>

      <div>
        <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8, color: "#475569" }}>Mağazalar</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(140px,1fr))", gap: 10 }}>
          <Kpi label="Onaylı kurumsal" value={k.activeShops || 0} />
          <Kpi label="Alışveriş odağı" value={k.alisverisFocusShops || 0} />
        </div>
      </div>
    </div>
  );
}

/* ─── Orders ─── */
export function AdminSellerPanelOrders({ initialTab = "ship" }: { initialTab?: string }) {
  const [tab, setTab] = useState(initialTab);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState("");
  const [note, setNote] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    const q = tab === "all" ? "" : `&status=${encodeURIComponent(tab)}`;
    fetch(`/api/admin?view=seller-panel-orders${q}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Yüklenemedi");
        setRows(d.orders || []);
      })
      .catch((e) => setMsg(e instanceof Error ? e.message : "Hata"))
      .finally(() => setLoading(false));
  }, [tab]);

  useEffect(() => {
    load();
  }, [load]);

  async function adminAction(action: string, dealId: string) {
    setBusy(dealId + action);
    setMsg("");
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, dealId, note: note || undefined }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(d.error || "İşlem başarısız");
        return;
      }
      setMsg("Güncellendi");
      load();
    } finally {
      setBusy("");
    }
  }

  const tabs = [
    ["ship", "Kargo bekleyen"],
    ["transit", "Yolda"],
    ["dispute", "Anlaşmazlık"],
    ["done", "Tamamlanan"],
    ["refund", "İade"],
    ["all", "Tümü"],
  ] as const;

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <AdminToast message={msg || null} tone={/başarısız|Hata|hata/i.test(msg) ? "err" : "ok"} onClose={() => setMsg("")} />
      <div style={card}>
        <div style={{ fontSize: 15, fontWeight: 850, marginBottom: 4 }}>Mağaza sipariş & kargo</div>
        <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>
          Güvenli Öde siparişleri. Anlaşmazlıkta serbest bırak / iade admin işlemleridir.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
          {tabs.map(([k, label]) => (
            <button
              key={k}
              type="button"
              className={tab === k ? "btn-orange" : "btn-outline"}
              style={{ padding: "7px 12px", fontSize: 12.5 }}
              onClick={() => setTab(k)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div style={card}>
        {loading ? <div>Yükleniyor…</div> : null}
        {!loading && !rows.length ? (
          <div style={{ color: "#64748b", fontWeight: 600, textAlign: "center", padding: 24 }}>Kayıt yok</div>
        ) : null}
        {rows.map((o) => {
          const st = STATUS_TR[o.status] || { label: o.status, tone: "neutral" };
          return (
            <div
              key={o.id}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr auto",
                gap: 12,
                padding: "12px 0",
                borderTop: "1px solid #f1f5f9",
              }}
            >
              <div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                  <Pill tone={st.tone}>{st.label}</Pill>
                  <strong style={{ fontSize: 14 }}>{formatTl(o.amountTl)}</strong>
                </div>
                <div style={{ fontWeight: 800, fontSize: 14 }}>{o.listing?.title || "İlan"}</div>
                <div style={{ fontSize: 12.5, color: "#64748b", marginTop: 2 }}>
                  Satıcı: {o.seller?.name || "—"} · Alıcı: {o.buyer?.name || "—"}
                  {o.cargoTrackingNo ? ` · ${o.cargoCarrier || "Kargo"} ${o.cargoTrackingNo}` : ""}
                </div>
              </div>
              <div style={{ display: "grid", gap: 6, justifyContent: "start" }}>
                {o.listing?.id ? (
                  <Link href={`/ilan/${o.listing.id}`} className="btn-outline" style={{ padding: "6px 10px", fontSize: 12, textDecoration: "none" }}>
                    İlan
                  </Link>
                ) : null}
                {o.status === "DISPUTED" ? (
                  <>
                    <button
                      type="button"
                      className="btn-orange"
                      style={{ padding: "6px 10px", fontSize: 12 }}
                      disabled={!!busy}
                      onClick={() => void adminAction("escrow-release", o.id)}
                    >
                      Satıcıya öde
                    </button>
                    <button
                      type="button"
                      className="btn-outline"
                      style={{ padding: "6px 10px", fontSize: 12 }}
                      disabled={!!busy}
                      onClick={() => void adminAction("escrow-refund", o.id)}
                    >
                      Alıcıya iade
                    </button>
                  </>
                ) : null}
              </div>
            </div>
          );
        })}
        {rows.some((r) => r.status === "DISPUTED") ? (
          <div style={{ marginTop: 12 }}>
            <input
              className="input"
              placeholder="Admin notu (opsiyonel)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* ─── Questions ─── */
export function AdminSellerPanelQuestions({ initialFilter = "open" }: { initialFilter?: string }) {
  const [filter, setFilter] = useState(initialFilter);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/admin?view=seller-panel-questions&filter=${encodeURIComponent(filter)}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Yüklenemedi");
        setRows(d.questions || []);
        setError("");
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Hata"))
      .finally(() => setLoading(false));
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={card}>
        <div style={{ fontSize: 15, fontWeight: 850 }}>Soru–cevap izleme</div>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: "#64748b" }}>
          Satıcıların yanıtlaması gereken ürün soruları. SLA aşanlar kırmızı.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
          {(
            [
              ["open", "Açık"],
              ["overdue", "SLA aşan"],
              ["answered", "Yanıtlanan"],
              ["all", "Tümü"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              className={filter === k ? "btn-orange" : "btn-outline"}
              style={{ padding: "7px 12px", fontSize: 12.5 }}
              onClick={() => setFilter(k)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div style={card}>
        {error ? <div style={{ color: "#b91c1c", fontWeight: 700 }}>{error}</div> : null}
        {loading ? <div>Yükleniyor…</div> : null}
        {!loading && !rows.length ? (
          <div style={{ color: "#64748b", fontWeight: 600, textAlign: "center", padding: 24 }}>Soru yok</div>
        ) : null}
        {rows.map((q) => (
          <div key={q.id} style={{ padding: "12px 0", borderTop: "1px solid #f1f5f9" }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
              {q.answeredAt ? <Pill tone="ok">Yanıtlandı</Pill> : q.overdue ? <Pill tone="danger">SLA aştı</Pill> : <Pill tone="warn">Bekliyor</Pill>}
              <span style={{ fontSize: 12.5, color: "#64748b" }}>
                Satıcı: {q.listing?.sellerName} · {new Date(q.createdAt).toLocaleString("tr-TR")}
              </span>
            </div>
            <div style={{ fontWeight: 700, fontSize: 13.5 }}>
              {q.askerName}: {q.body}
            </div>
            <div style={{ fontSize: 12.5, color: "#ea580c", marginTop: 4 }}>
              <Link href={`/ilan/${q.listing?.id}`}>{q.listing?.title}</Link>
            </div>
            {q.answerBody ? (
              <div style={{ marginTop: 8, padding: 10, borderRadius: 10, background: "#ecfdf5", fontSize: 13 }}>
                <strong>Yanıt:</strong> {q.answerBody}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Settings hub ─── */
export function AdminSellerPanelSettings() {
  return (
    <div style={{ display: "grid", gap: 20 }}>
      <div style={card}>
        <div style={{ fontSize: 15, fontWeight: 850, marginBottom: 6 }}>Panel & izinler</div>
        <p style={{ margin: "0 0 12px", fontSize: 13, color: "#64748b", lineHeight: 1.5 }}>
          Satıcı panelinin aç/kapa durumu, Alışveriş odağı zorunluluğu, modüller ve SLA süreleri.
          Bu ayarlar yalnızca Alışveriş mağazaları içindir; Emlak–Vasıta ilan soruları Emlak & Vasıta →
          Ayarlar menüsündedir.
        </p>
        <AdminSettingsPanel
          onlyKeys={[
            "seller_panel_enabled",
            "seller_panel_button_label",
            "seller_panel_require_alisveris_focus",
            "seller_panel_module_listings",
            "seller_panel_module_questions",
            "seller_panel_module_orders",
            "seller_panel_qa_sla_hours",
            "seller_panel_ship_reminder_hours",
          ]}
        />
      </div>

      <div style={card}>
        <div style={{ fontSize: 15, fontWeight: 850, marginBottom: 6 }}>
          Alışveriş — ilan detayı & giriş formu
        </div>
        <p style={{ margin: "0 0 12px", fontSize: 13, color: "#64748b", lineHeight: 1.5 }}>
          Bu şablonlar yalnızca Alışveriş kategorisi için geçerlidir. İlan detayı / formu ayrı seçilir.
          «Teklif kabulü» genel site teklifli olsa bile alışveriş ürün sayfasında teklifi kapatmanızı sağlar.
          «Sepet yeri» sepet ikonunu üst kuşakta veya kategori menü satırının sağında gösterir.
          «Hemen Al» rengi ürün detay butonunu boyar.
        </p>
        <AdminSettingsPanel
          onlyKeys={[
            "shopping_listing_detail_template",
            "shopping_listing_form_template",
            "shopping_offers_enabled",
            "shopping_cart_placement",
            "shopping_buy_button_color",
          ]}
        />
        <p style={{ margin: "10px 0 0", fontSize: 12.5, color: "#64748b", lineHeight: 1.45 }}>
          Form şablonunda <strong>Modern Tema</strong> seçilirse alışveriş ilanı Hesabım → İlan Ekle
          içinde adımlı formda açılır.
        </p>
      </div>

      <div style={card}>
        <div style={{ fontSize: 15, fontWeight: 850, marginBottom: 6 }}>
          Premium Mağaza — bilgilendirme popup
        </div>
        <p style={{ margin: "0 0 12px", fontSize: 13, color: "#64748b", lineHeight: 1.5 }}>
          Ürün detayındaki Premium Mağaza amblemine tıklanınca açılan popup. Aç/kapa, metin içeriği ve
          «Başvur» butonunu buradan yönetin.
        </p>
        <AdminSettingsPanel
          onlyKeys={[
            "premium_store_popup_enabled",
            "premium_store_popup_title",
            "premium_store_popup_body",
            "premium_store_popup_apply_enabled",
            "premium_store_popup_apply_label",
            "premium_store_popup_apply_url",
          ]}
        />
      </div>

      <div style={card}>
        <div style={{ fontSize: 15, fontWeight: 850, marginBottom: 6 }}>Komisyon & Güvenli Öde</div>
        <p style={{ margin: "0 0 12px", fontSize: 13, color: "#64748b", lineHeight: 1.5 }}>
          Mağaza siparişlerinde (escrow) kesilen komisyon ve kargo süreleri.
        </p>
        <AdminSettingsPanel
          onlyKeys={[
            "escrow_enabled",
            "escrow_commission_percent",
            "escrow_default_ship_days",
            "escrow_buyer_confirm_days",
            "escrow_ship_days_options",
            "escrow_min_amount_tl",
            "escrow_max_amount_tl",
            "escrow_button_label",
          ]}
        />
        <div style={{ marginTop: 12 }}>
          <Link href="/admin/guvenli-ode" style={{ fontWeight: 700, fontSize: 13 }}>
            Güvenli Öde / GET Havuzu →
          </Link>
        </div>
      </div>

      <div>
        <div style={{ ...card, marginBottom: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 850 }}>İlan ücretleri & ücretsiz kota</div>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#64748b" }}>
            Bireysel / kurumsal ücretsiz ilan hakkı ve kota sonrası ücret.
          </p>
        </div>
        <AdminListingQuotaPanel />
      </div>

      <div style={card}>
        <div style={{ fontSize: 15, fontWeight: 850, marginBottom: 6 }}>Mağaza paketleri</div>
        <p style={{ margin: "0 0 12px", fontSize: 13, color: "#64748b", lineHeight: 1.5 }}>
          Paket satış popup’ları ve jetonla ödeme. Paket fiyat / ilan limiti tanımları paket listesinde.
        </p>
        <AdminSettingsPanel
          onlyKeys={[
            "shop_package_buy_popup_bireysel",
            "shop_package_buy_popup_ticari",
            "shop_package_pay_with_tokens_enabled",
          ]}
        />
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 12 }}>
          <Link href="/admin/alisveris/magaza-paketleri" style={{ fontWeight: 700, fontSize: 13 }}>
            Mağaza paket fiyatları →
          </Link>
          <Link href="/admin/alisveris/abonelikler" style={{ fontWeight: 700, fontSize: 13 }}>
            Abonelikler →
          </Link>
          <Link href="/admin/kurumsal" style={{ fontWeight: 700, fontSize: 13 }}>
            Kurumsal paketler →
          </Link>
        </div>
      </div>
    </div>
  );
}
