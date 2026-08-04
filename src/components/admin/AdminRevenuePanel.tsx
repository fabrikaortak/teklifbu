"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Building2,
  Coins,
  FileText,
  Percent,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  Wallet,
} from "lucide-react";
import { formatTl, paymentPurposeLabel, paymentStatusLabel } from "@/lib/format";
import { paymentMetaDetails } from "@/lib/paymentDetails";
import { useDialog } from "@/components/ui/ConfirmDialog";
import {
  EXPENSE_CATEGORIES,
  expenseCategoryLabel,
  type RevenueExpense,
} from "@/lib/revenueFinance";
import { calcVatBreakdown } from "@/lib/vat";

type PaymentRow = {
  id: string;
  amountTl: number;
  purpose: string;
  group: string;
  status: string;
  createdAt: string;
  meta?: unknown;
  vatTl?: number;
  user: { name?: string | null; phone?: string | null; accountType?: string };
};

type RevenueData = {
  days: number;
  period: {
    totalTl: number;
    listing_fee: { amountTl: number; count: number };
    token: { amountTl: number; count: number };
    shop_subscription: { amountTl: number; count: number };
    other: { amountTl: number; count: number };
  };
  allTime: { totalTl: number };
  mrrEstimateTl: number;
  activeSubscriptionCount: number;
  series: Array<{
    date: string;
    listingFees: number;
    tokens: number;
    shop: number;
    other: number;
    total: number;
  }>;
  payments: PaymentRow[];
  recent: PaymentRow[];
  activeSubscriptions: Array<{
    id: string;
    packageName: string;
    monthlyPrice: number;
    accountType: string;
    endsAt: string;
    user: { name?: string | null; phone?: string | null };
    shopName?: string | null;
  }>;
  expenses: RevenueExpense[];
  expensesTotalTl: number;
  vatCollectedTl: number;
  vatOutgoingTl: number;
  vatNetTl: number;
  vatTotalTl?: number;
  posFeesTl?: number;
  netTl: number;
};

const GROUP_LABEL: Record<string, string> = {
  listing_fee: "İlan ücreti",
  token: "Jeton",
  shop_subscription: "Kurumsal paket",
  other: "Diğer",
};

type ChartGranularity = "day" | "week" | "month" | "year";

const CHART_TABS: Array<{ id: ChartGranularity; label: string; days: number }> = [
  { id: "day", label: "Günlük", days: 30 },
  { id: "week", label: "Haftalık", days: 84 },
  { id: "month", label: "Aylık", days: 365 },
  { id: "year", label: "Yıllık", days: 365 },
];

type SeriesPoint = RevenueData["series"][number];

function weekKey(isoDate: string) {
  const d = new Date(`${isoDate}T12:00:00`);
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  return d.toISOString().slice(0, 10);
}

function aggregateSeries(series: SeriesPoint[], g: ChartGranularity): SeriesPoint[] {
  if (g === "day") return series;
  const map = new Map<string, SeriesPoint>();
  for (const s of series) {
    const key =
      g === "week" ? weekKey(s.date) : g === "month" ? s.date.slice(0, 7) : s.date.slice(0, 4);
    const prev = map.get(key);
    if (!prev) {
      map.set(key, { ...s, date: key });
    } else {
      prev.listingFees += s.listingFees;
      prev.tokens += s.tokens;
      prev.shop += s.shop;
      prev.other += s.other;
      prev.total += s.total;
    }
  }
  return Array.from(map.values());
}

function Chart({ series }: { series: SeriesPoint[] }) {
  const max = Math.max(1, ...series.map((s) => s.total));
  const w = 640;
  const h = 72;
  const pad = 6;
  const pts = series.map((s, i) => {
    const x = pad + (i / Math.max(1, series.length - 1)) * (w - pad * 2);
    const y = h - pad - (s.total / max) * (h - pad * 2);
    return `${x},${y}`;
  });
  const area = `${pad},${h - pad} ${pts.join(" ")} ${w - pad},${h - pad}`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: 72, display: "block" }}>
      <defs>
        <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fb923c" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#fb923c" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill="url(#revFill)" />
      <polyline
        points={pts.join(" ")}
        fill="none"
        stroke="#ea580c"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

function GlassCard({
  children,
  style,
}: {
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.88)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        border: "1px solid rgba(255,255,255,0.65)",
        borderRadius: 14,
        boxShadow: "0 8px 24px rgba(15,23,42,0.06)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function AdminRevenuePanel() {
  const { alert, confirm } = useDialog();
  const [days, setDays] = useState(30);
  const [chartGranularity, setChartGranularity] = useState<ChartGranularity>("day");
  const [data, setData] = useState<RevenueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPayment, setSelectedPayment] = useState<PaymentRow | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [expenseForm, setExpenseForm] = useState({
    title: "",
    amountTl: "",
    amountIncludesVat: true,
    vatPercent: "20",
    category: "OFIS",
    note: "",
  });
  const [expenseBusy, setExpenseBusy] = useState(false);
  const [payQ, setPayQ] = useState("");
  const [payStatus, setPayStatus] = useState("");
  const [payPurpose, setPayPurpose] = useState("");

  const expenseVatPreview = useMemo(() => {
    return calcVatBreakdown(
      Number(expenseForm.amountTl) || 0,
      Number(expenseForm.vatPercent) || 0,
      expenseForm.amountIncludesVat
    );
  }, [expenseForm.amountTl, expenseForm.vatPercent, expenseForm.amountIncludesVat]);

  async function load(d = days) {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin?view=revenue&days=${d}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load(days);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days]);

  const filteredPayments = useMemo(() => {
    const rows = data?.payments || data?.recent || [];
    const q = payQ.trim().toLowerCase();
    return rows.filter((p) => {
      if (payStatus && p.status !== payStatus) return false;
      if (payPurpose) {
        const pur = p.purpose.toLowerCase();
        if (payPurpose === "listing_fee" && pur !== "listing_fee") return false;
        if (payPurpose === "token" && !pur.includes("token")) return false;
        if (
          payPurpose === "shop_subscription" &&
          !(pur === "shop_subscription" || pur.includes("shop") || pur.includes("subscription"))
        )
          return false;
        if (payPurpose === "manual" && !pur.includes("manual")) return false;
      }
      if (!q) return true;
      const hay = `${p.user?.name || ""} ${p.user?.phone || ""} ${p.purpose} ${paymentPurposeLabel(p.purpose)}`.toLowerCase();
      return hay.includes(q);
    });
  }, [data, payQ, payStatus, payPurpose]);

  const share = useMemo(() => {
    if (!data) return [];
    const items = [
      { key: "listing_fee", label: "İlan", ...data.period.listing_fee, color: "#ea580c" },
      { key: "token", label: "Jeton", ...data.period.token, color: "#2563eb" },
      { key: "shop_subscription", label: "Kurumsal", ...data.period.shop_subscription, color: "#059669" },
      { key: "other", label: "Diğer", ...data.period.other, color: "#94a3b8" },
    ];
    const total = Math.max(1, data.period.totalTl);
    return items.map((x) => ({ ...x, pct: Math.round((x.amountTl / total) * 1000) / 10 }));
  }, [data]);

  const chartSeries = useMemo(
    () => (data ? aggregateSeries(data.series, chartGranularity) : []),
    [data, chartGranularity]
  );

  function selectChartTab(tab: (typeof CHART_TABS)[number]) {
    setChartGranularity(tab.id);
    if (days !== tab.days) setDays(tab.days);
  }

  async function addExpense() {
    const title = expenseForm.title.trim();
    const amountTl = Number(expenseForm.amountTl);
    if (!title || !Number.isFinite(amountTl) || amountTl < 0) {
      await alert({ title: "Eksik", message: "Masraf adı ve tutar gerekli.", tone: "warning" });
      return;
    }
    setExpenseBusy(true);
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add-revenue-expense",
          title,
          amountTl,
          amountIncludesVat: expenseForm.amountIncludesVat,
          vatPercent: Number(expenseForm.vatPercent) || 0,
          category: expenseForm.category,
          note: expenseForm.note,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        await alert({ title: "Eklenemedi", message: j.error || "Masraf eklenemedi.", tone: "danger" });
        return;
      }
      setExpenseForm({
        title: "",
        amountTl: "",
        amountIncludesVat: true,
        vatPercent: "20",
        category: "OFIS",
        note: "",
      });
      await load();
    } finally {
      setExpenseBusy(false);
    }
  }

  async function deleteExpense(id: string) {
    const ok = await confirm({
      title: "Masrafı sil",
      message: "Bu masraf kaydı silinsin mi?",
      tone: "danger",
      confirmLabel: "Sil",
    });
    if (!ok) return;
    await fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete-revenue-expense", id }),
    });
    await load();
  }

  async function deleteSelectedPayment() {
    if (!selectedPayment?.id || deleteBusy) return;
    setDeleteBusy(true);
    try {
      const previewRes = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "preview-payment-delete", paymentId: selectedPayment.id }),
      });
      const preview = await previewRes.json().catch(() => ({}));
      if (!previewRes.ok) {
        await alert({
          title: "Silinemedi",
          message: preview.error || "Ödeme önizlemesi alınamadı.",
          tone: "danger",
        });
        return;
      }
      const effectLines = Array.isArray(preview.effects)
        ? preview.effects.map((e: { label?: string }) => `• ${e.label || ""}`).join("\n")
        : "";
      const ok = await confirm({
        title: "Ödemeyi sil",
        message: `Ödeme kaydı silinsin mi?\n\n${effectLines}`,
        confirmLabel: "Sil",
        tone: "danger",
      });
      if (!ok) return;
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete-payment", paymentId: selectedPayment.id }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        await alert({ title: "Silinemedi", message: j.error || "Ödeme silinemedi.", tone: "danger" });
        return;
      }
      setSelectedPayment(null);
      await load();
    } finally {
      setDeleteBusy(false);
    }
  }

  if (loading && !data) {
    return (
      <div style={{ padding: 48, textAlign: "center", color: "#64748b", fontWeight: 650 }}>
        Gelirler yükleniyor…
      </div>
    );
  }
  if (!data) {
    return <div className="adm-card">Veri alınamadı.</div>;
  }

  const vatCollected = data.vatCollectedTl ?? data.vatTotalTl ?? 0;
  const vatOutgoing = data.vatOutgoingTl ?? 0;
  const vatNet = data.vatNetTl ?? vatCollected - vatOutgoing;

  return (
    <div
      style={{
        display: "grid",
        gap: 12,
        margin: "-4px -4px 0",
        padding: "4px 4px 16px",
      }}
    >
      {/* Hero */}
      <div
        style={{
          position: "relative",
          overflow: "hidden",
          borderRadius: 18,
          padding: "16px 18px 14px",
          background:
            "radial-gradient(ellipse at 12% 0%, rgba(251,146,60,0.45), transparent 50%), radial-gradient(ellipse at 90% 20%, rgba(37,99,235,0.28), transparent 45%), linear-gradient(135deg, #0f172a 0%, #1e293b 55%, #0f172a 100%)",
          color: "#fff",
          boxShadow: "0 14px 40px rgba(15,23,42,0.22)",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)",
            backgroundSize: "18px 18px",
            opacity: 0.45,
            pointerEvents: "none",
          }}
        />
        <div style={{ position: "relative", display: "grid", gap: 12 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <div>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: "rgba(255,255,255,0.55)",
                  marginBottom: 4,
                }}
              >
                <Sparkles size={12} /> Finans özeti
              </div>
              <h1
                style={{
                  margin: 0,
                  fontSize: "clamp(22px, 3vw, 30px)",
                  fontWeight: 900,
                  letterSpacing: "-0.04em",
                  lineHeight: 1.1,
                }}
              >
                {formatTl(data.period.totalTl)}
              </h1>
              <p style={{ margin: "4px 0 0", fontSize: 12.5, color: "rgba(255,255,255,0.65)" }}>
                Son {days} gün brüt · Net{" "}
                <strong style={{ color: "#fdba74" }}>{formatTl(data.netTl)}</strong>
                {" · "}Tüm zamanlar {formatTl(data.allTime.totalTl)}
              </p>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {[7, 30, 90, 365].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => {
                    setDays(d);
                    setChartGranularity(d <= 30 ? "day" : d <= 90 ? "week" : d >= 365 ? "year" : "month");
                  }}
                  style={{
                    border: "none",
                    borderRadius: 999,
                    padding: "5px 10px",
                    fontWeight: 800,
                    fontSize: 12,
                    cursor: "pointer",
                    background: days === d ? "#fff" : "rgba(255,255,255,0.12)",
                    color: days === d ? "#0f172a" : "#fff",
                  }}
                >
                  {d === 365 ? "1y" : `${d}g`}
                </button>
              ))}
              <button
                type="button"
                onClick={() => void load()}
                style={{
                  border: "none",
                  borderRadius: 999,
                  padding: "5px 10px",
                  background: "rgba(255,255,255,0.12)",
                  color: "#fff",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  fontWeight: 700,
                }}
              >
                <RefreshCw size={13} />
              </button>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))",
              gap: 8,
            }}
          >
            {[
              {
                label: "Toplanan KDV",
                value: formatTl(vatCollected),
                icon: <Percent size={13} />,
                tone: "rgba(255,255,255,0.1)",
              },
              {
                label: "Çıkan KDV",
                value: formatTl(vatOutgoing),
                icon: <ArrowDownRight size={13} />,
                tone: "rgba(248,113,113,0.18)",
              },
              {
                label: "Net KDV",
                value: formatTl(vatNet),
                icon: <Percent size={13} />,
                tone: "rgba(96,165,250,0.2)",
              },
              {
                label: "Masraflar",
                value: formatTl(data.expensesTotalTl),
                icon: <ArrowDownRight size={13} />,
                tone: "rgba(251,146,60,0.2)",
              },
              {
                label: "Net",
                value: formatTl(data.netTl),
                icon: <ArrowUpRight size={13} />,
                tone: "rgba(52,211,153,0.2)",
              },
            ].map((x) => (
              <div
                key={x.label}
                style={{
                  background: x.tone,
                  borderRadius: 12,
                  padding: "8px 10px",
                  border: "1px solid rgba(255,255,255,0.1)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    fontSize: 10,
                    fontWeight: 700,
                    color: "rgba(255,255,255,0.6)",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                  }}
                >
                  {x.icon} {x.label}
                </div>
                <div style={{ marginTop: 4, fontSize: 15, fontWeight: 900, letterSpacing: "-0.03em" }}>
                  {x.value}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* KPI + chart */}
      <div
        className="rev-split"
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1fr)",
          gap: 12,
        }}
      >
        <GlassCard style={{ padding: 14 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 10,
              marginBottom: 6,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a" }}>Trend</div>
              <div
                style={{
                  display: "inline-flex",
                  gap: 2,
                  padding: 2,
                  borderRadius: 999,
                  background: "#f1f5f9",
                }}
              >
                {CHART_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => selectChartTab(tab)}
                    style={{
                      border: "none",
                      borderRadius: 999,
                      padding: "5px 10px",
                      fontSize: 11.5,
                      fontWeight: 800,
                      cursor: "pointer",
                      background: chartGranularity === tab.id ? "#fff" : "transparent",
                      color: chartGranularity === tab.id ? "#0f172a" : "#64748b",
                      boxShadow:
                        chartGranularity === tab.id ? "0 1px 4px rgba(15,23,42,0.1)" : "none",
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
            <TrendingHint mrr={data.mrrEstimateTl} subs={data.activeSubscriptionCount} />
          </div>
          <Chart series={chartSeries} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, marginTop: 8 }}>
            {share.map((s) => (
              <div key={s.key} style={{ padding: "6px 8px", borderRadius: 10, background: "#f8fafc" }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: "#64748b" }}>{s.label}</div>
                <div style={{ fontSize: 12.5, fontWeight: 800, color: s.color, marginTop: 1 }}>
                  {formatTl(s.amountTl)}
                </div>
                <div style={{ fontSize: 10, color: "#94a3b8" }}>
                  {s.pct}% · {s.count}
                </div>
              </div>
            ))}
          </div>
        </GlassCard>

        <GlassCard style={{ padding: 14, display: "grid", gap: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a" }}>Kalem kırılımı</div>
          {[
            {
              label: "İlan ücretleri",
              icon: <FileText size={14} />,
              amount: data.period.listing_fee.amountTl,
              count: data.period.listing_fee.count,
              color: "#ea580c",
            },
            {
              label: "Jeton satışları",
              icon: <Coins size={14} />,
              amount: data.period.token.amountTl,
              count: data.period.token.count,
              color: "#2563eb",
            },
            {
              label: "Kurumsal paket",
              icon: <Building2 size={14} />,
              amount: data.period.shop_subscription.amountTl,
              count: data.period.shop_subscription.count,
              color: "#059669",
            },
            {
              label: "Diğer",
              icon: <Wallet size={14} />,
              amount: data.period.other.amountTl,
              count: data.period.other.count,
              color: "#64748b",
            },
          ].map((row) => {
            const pct = Math.round((row.amount / Math.max(1, data.period.totalTl)) * 100);
            return (
              <div key={row.label}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: 12,
                      fontWeight: 700,
                      color: "#334155",
                    }}
                  >
                    <span style={{ color: row.color }}>{row.icon}</span>
                    {row.label}
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 800 }}>{formatTl(row.amount)}</span>
                </div>
                <div
                  style={{
                    height: 5,
                    borderRadius: 99,
                    background: "#f1f5f9",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${pct}%`,
                      height: "100%",
                      borderRadius: 99,
                      background: row.color,
                    }}
                  />
                </div>
                <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>
                  {row.count} işlem · %{pct}
                </div>
              </div>
            );
          })}
        </GlassCard>
      </div>

      {/* Expenses */}
      <div
        className="rev-split"
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.15fr)",
          gap: 12,
        }}
      >
        <GlassCard style={{ padding: 14, display: "grid", gap: 10, alignContent: "start" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                width: 32,
                height: 32,
                borderRadius: 10,
                background: "linear-gradient(145deg, #fff7ed, #ffedd5)",
                color: "#ea580c",
                display: "grid",
                placeItems: "center",
              }}
            >
              <Plus size={15} />
            </span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a" }}>Hızlı masraf ekle</div>
              <div style={{ fontSize: 11, color: "#94a3b8" }}>İşletme gideri</div>
            </div>
          </div>
          <div style={{ display: "grid", gap: 6 }}>
            <input
              className="input"
              placeholder="Masraf adı (örn. Ofis kirası)"
              value={expenseForm.title}
              onChange={(e) => setExpenseForm((f) => ({ ...f, title: e.target.value }))}
            />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              <input
                className="input"
                type="number"
                min={0}
                step="0.01"
                placeholder="Tutar TL"
                value={expenseForm.amountTl}
                onChange={(e) => setExpenseForm((f) => ({ ...f, amountTl: e.target.value }))}
              />
              <select
                className="select"
                value={expenseForm.category}
                onChange={(e) => setExpenseForm((f) => ({ ...f, category: e.target.value }))}
              >
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={expenseForm.amountIncludesVat}
                onChange={(e) =>
                  setExpenseForm((f) => ({ ...f, amountIncludesVat: e.target.checked }))
                }
              />
              Tutar KDV dahil mi?
            </label>
            <label style={{ display: "grid", gap: 4, fontSize: 12, fontWeight: 700 }}>
              KDV oranı (%)
              <input
                className="input"
                type="number"
                min={0}
                max={40}
                step="0.01"
                value={expenseForm.vatPercent}
                onChange={(e) => setExpenseForm((f) => ({ ...f, vatPercent: e.target.value }))}
              />
            </label>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                gap: 6,
                padding: 8,
                borderRadius: 10,
                background: "#f8fafc",
                fontSize: 11,
              }}
            >
              <div>
                <div style={{ color: "#94a3b8", fontWeight: 700 }}>KDV hariç</div>
                <div style={{ fontWeight: 800 }}>{formatTl(expenseVatPreview.netTl)}</div>
              </div>
              <div>
                <div style={{ color: "#94a3b8", fontWeight: 700 }}>KDV</div>
                <div style={{ fontWeight: 800 }}>{formatTl(expenseVatPreview.vatTl)}</div>
              </div>
              <div>
                <div style={{ color: "#94a3b8", fontWeight: 700 }}>KDV dahil</div>
                <div style={{ fontWeight: 800 }}>{formatTl(expenseVatPreview.grossTl)}</div>
              </div>
            </div>
            <input
              className="input"
              placeholder="Not (opsiyonel)"
              value={expenseForm.note}
              onChange={(e) => setExpenseForm((f) => ({ ...f, note: e.target.value }))}
            />
            <button
              type="button"
              className="btn-orange"
              style={{ padding: "8px 12px", fontWeight: 800, fontSize: 13 }}
              disabled={expenseBusy}
              onClick={() => void addExpense()}
            >
              {expenseBusy ? "Ekleniyor…" : "Masrafı kaydet"}
            </button>
          </div>
        </GlassCard>

        <GlassCard style={{ padding: 14, display: "grid", gap: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a" }}>Masraflar</div>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#ea580c" }}>
              {formatTl(data.expensesTotalTl)}
            </div>
          </div>
          <div style={{ display: "grid", gap: 6, maxHeight: 240, overflow: "auto" }}>
            {(data.expenses || []).length === 0 && (
              <div
                style={{
                  padding: 16,
                  textAlign: "center",
                  color: "#94a3b8",
                  fontSize: 12,
                  borderRadius: 10,
                  background: "#f8fafc",
                }}
              >
                Bu dönemde masraf yok
              </div>
            )}
            {(data.expenses || []).map((e) => (
              <div
                key={e.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto auto",
                  gap: 8,
                  alignItems: "center",
                  padding: "7px 10px",
                  borderRadius: 10,
                  border: "1px solid #eef2f7",
                  background: "#fff",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 12.5,
                      fontWeight: 800,
                      color: "#0f172a",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {e.title}
                  </div>
                  <div style={{ fontSize: 10.5, color: "#94a3b8", marginTop: 1 }}>
                    {expenseCategoryLabel(e.category)} ·{" "}
                    {new Date(e.spentAt).toLocaleDateString("tr-TR")}
                    {e.vatTl > 0
                      ? ` · KDV ${formatTl(e.vatTl)} (%${e.vatPercent})`
                      : ""}
                    {e.note ? ` · ${e.note}` : ""}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 12.5, fontWeight: 800, color: "#b91c1c" }}>
                    −{formatTl(e.grossTl ?? e.amountTl)}
                  </div>
                  {e.vatTl > 0 ? (
                    <div style={{ fontSize: 10, color: "#64748b", fontWeight: 700 }}>
                      KDV {formatTl(e.vatTl)}
                    </div>
                  ) : null}
                </div>
                <button
                  type="button"
                  className="btn-outline"
                  style={{ padding: 6, color: "#b91c1c", borderColor: "#fecaca" }}
                  onClick={() => void deleteExpense(e.id)}
                  aria-label="Sil"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>

      {/* Payments */}
      <GlassCard style={{ padding: 14, display: "grid", gap: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a" }}>Ham ödeme kayıtları</div>
            <div style={{ fontSize: 11.5, color: "#94a3b8", marginTop: 1 }}>
              Dönem içi ödemeler — filtreleyin, satıra tıklayın
            </div>
          </div>
          <Link
            href="/admin/odemeler"
            style={{ fontSize: 12, fontWeight: 750, color: "#ea580c", alignSelf: "center" }}
          >
            Tüm ödemeler →
          </Link>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          <input
            className="input"
            style={{ minWidth: 180, flex: 1 }}
            placeholder="Kullanıcı veya amaç ara…"
            value={payQ}
            onChange={(e) => setPayQ(e.target.value)}
          />
          <select className="select" value={payStatus} onChange={(e) => setPayStatus(e.target.value)}>
            <option value="">Tüm durumlar</option>
            <option value="PENDING">Bekliyor</option>
            <option value="PAID">Ödendi</option>
            <option value="SIMULATED">Simüle</option>
            <option value="FAILED">Başarısız</option>
            <option value="CANCELLED">İptal</option>
          </select>
          <select className="select" value={payPurpose} onChange={(e) => setPayPurpose(e.target.value)}>
            <option value="">Tüm amaçlar</option>
            <option value="listing_fee">İlan ücreti</option>
            <option value="token">Jeton</option>
            <option value="shop_subscription">Kurumsal paket</option>
            <option value="manual">Manuel</option>
          </select>
        </div>
        <div style={{ overflow: "auto", borderRadius: 12, border: "1px solid #eef2f7", maxHeight: 320 }}>
          <table className="adm-table" style={{ margin: 0 }}>
            <thead>
              <tr>
                <th>Kullanıcı</th>
                <th>Amaç</th>
                <th>Tutar</th>
                <th>KDV</th>
                <th>Durum</th>
                <th>Tarih</th>
              </tr>
            </thead>
            <tbody>
              {filteredPayments.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ color: "#94a3b8" }}>
                    Kayıt yok
                  </td>
                </tr>
              )}
              {filteredPayments.map((p) => (
                <tr
                  key={p.id}
                  onClick={() => setSelectedPayment(p)}
                  style={{ cursor: "pointer" }}
                  title="Detay"
                >
                  <td style={{ fontWeight: 700 }}>{p.user?.name || p.user?.phone || "—"}</td>
                  <td>
                    {paymentPurposeLabel(p.purpose)}
                    <span style={{ display: "block", fontSize: 11, color: "#94a3b8" }}>
                      {GROUP_LABEL[p.group] || p.group}
                    </span>
                  </td>
                  <td style={{ fontWeight: 800 }}>{formatTl(p.amountTl)}</td>
                  <td style={{ fontWeight: 700, color: "#0369a1" }}>
                    {formatTl(Number(p.vatTl || 0))}
                  </td>
                  <td>{paymentStatusLabel(p.status)}</td>
                  <td style={{ fontSize: 12, color: "#64748b" }}>
                    {new Date(p.createdAt).toLocaleString("tr-TR")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ fontSize: 11, color: "#94a3b8" }}>{filteredPayments.length} kayıt</div>
      </GlassCard>

      {selectedPayment && (
        <div className="modal-backdrop" onClick={() => setSelectedPayment(null)}>
          <div
            className="modal"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 520, width: "min(520px, 94vw)", display: "grid", gap: 12 }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900 }}>Ödeme detayı</h3>
              <button
                type="button"
                className="btn-outline"
                style={{ padding: "6px 10px" }}
                onClick={() => setSelectedPayment(null)}
              >
                Kapat
              </button>
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              {paymentMetaDetails(selectedPayment).map((row) => (
                <div
                  key={row.label}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "140px 1fr",
                    gap: 10,
                    fontSize: 13,
                    paddingBottom: 8,
                    borderBottom: "1px solid #eef2f7",
                  }}
                >
                  <span style={{ color: "#64748b", fontWeight: 700 }}>{row.label}</span>
                  {row.href ? (
                    <Link href={row.href} target="_blank" style={{ fontWeight: 700, wordBreak: "break-all" }}>
                      {row.value} ↗
                    </Link>
                  ) : (
                    <span style={{ fontWeight: 700, wordBreak: "break-word" }}>{row.value}</span>
                  )}
                </div>
              ))}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                className="btn-outline"
                style={{ padding: "8px 14px", color: "#b91c1c", borderColor: "#fecaca", fontWeight: 800 }}
                disabled={deleteBusy}
                onClick={() => void deleteSelectedPayment()}
              >
                {deleteBusy ? "…" : "Ödemeyi sil"}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @media (max-width: 960px) {
          .rev-split {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}

function TrendingHint({ mrr, subs }: { mrr: number; subs: number }) {
  return (
    <div style={{ textAlign: "right", fontSize: 12, color: "#64748b" }}>
      <div style={{ fontWeight: 800, color: "#0f172a" }}>MRR ~ {formatTl(mrr)}</div>
      <div>{subs} aktif abonelik</div>
    </div>
  );
}
