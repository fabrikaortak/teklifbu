"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  accountTypeLabelTr,
  commercialSubtypeLabelTr,
  isCorporateAccount,
} from "@/lib/accountTypes";
import { commercialStatusLabel, commercialToShopFocus } from "@/data/commercialProfile";
import {
  COMMERCIAL_FIELD_LABELS,
  COMPANY_TYPE_OPTIONS,
  EMPTY_COMMERCIAL_PROFILE,
  type CommercialProfile,
} from "@/data/commercialProfile";
import { formatShopFocusLine } from "@/data/shopFocus";
import {
  formatPhoneTr,
  formatTl,
  normalizePhoneTr,
  paymentPurposeLabel,
  paymentStatusLabel,
} from "@/lib/format";
import { bidStatusLabel, listingStatusLabel } from "@/lib/listingStatus";
import { X, Store, MessageSquare, Gavel, ShoppingBag, Megaphone, Clock, ExternalLink } from "lucide-react";
import { useDialog } from "@/components/ui/ConfirmDialog";
import { CommercialSubtypePicker } from "@/components/CommercialSubtypePicker";
import { CommercialBusinessForm } from "@/components/CommercialBusinessForm";

type DetailPayload = {
  user: {
    id: string;
    phone: string;
    phoneVerified?: boolean;
    name: string | null;
    email: string | null;
    accountType: string;
    commercialSubtypes: string[];
    commercialStatus: string | null;
    role: string;
    tokenBalance: number;
    avatarUrl: string | null;
    logoUrl: string | null;
    isPremiumSeller?: boolean;
    isActive: boolean;
    memberSince: string;
    createdAt: string;
    updatedAt: string;
  };
  companyName?: string | null;
  commercialProfile?: CommercialProfile | null;
  shop: {
    id: string | null;
    name: string;
    displayName?: string | null;
    companyName?: string | null;
    city: string | null;
    phone: string | null;
    isActive: boolean;
  } | null;
  subscription: {
    isActive: boolean;
    endsAt: string;
    startsAt: string;
    packageName: string | null;
  } | null;
  stats: {
    paymentsTotalTl: number;
    paymentsCount: number;
    bidsCount: number;
    listingsCount: number;
    messagesSent: number;
    messagesReceived: number;
    messagesTotal: number;
  };
  recentPayments: Array<{
    id: string;
    amountTl: number;
    purpose: string;
    status: string;
    createdAt: string;
  }>;
  recentBids: Array<{
    id: string;
    amount: number;
    status: string;
    createdAt: string;
    listing: { id: string; title: string; listingNo: string | null } | null;
  }>;
  recentListings: Array<{
    id: string;
    title: string;
    listingNo: string | null;
    status: string;
    askPrice: number;
    createdAt: string;
    coverImage?: string | null;
    city?: string | null;
    category?: { name: string } | null;
  }>;
  lastActivityAt: string;
  lastActivitySource: string;
};

type TabKey = "ozet" | "ticari" | "alisveris" | "teklifler" | "ilanlar";

function formatDateTime(raw?: string | null) {
  if (!raw) return "—";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(raw?: string | null) {
  if (!raw) return "—";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function relativeTime(raw?: string | null) {
  if (!raw) return "—";
  const t = new Date(raw).getTime();
  if (!Number.isFinite(t)) return "—";
  const diff = Date.now() - t;
  if (diff < 60_000) return "Az önce";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} dk önce`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} sa önce`;
  if (diff < 30 * 86_400_000) return `${Math.floor(diff / 86_400_000)} gün önce`;
  return formatDate(raw);
}

function initials(name?: string | null, phone?: string) {
  const n = String(name || "").trim();
  if (n) {
    const parts = n.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return n.slice(0, 2).toUpperCase();
  }
  return String(phone || "?").slice(-2);
}

function StatCard({
  icon,
  label,
  value,
  hint,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  hint?: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      style={{
        background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
        border: "1px solid #e8eef5",
        borderRadius: 14,
        padding: "14px 14px 12px",
        display: "grid",
        gap: 8,
        minWidth: 0,
        textAlign: "left",
        cursor: onClick ? "pointer" : "default",
        transition: "border-color 0.15s, box-shadow 0.15s",
      }}
      onMouseEnter={(e) => {
        if (!onClick) return;
        e.currentTarget.style.borderColor = "#fdba74";
        e.currentTarget.style.boxShadow = "0 0 0 3px rgba(255,106,0,0.08)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "#e8eef5";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#64748b" }}>
        <span
          style={{
            width: 28,
            height: 28,
            borderRadius: 9,
            background: "rgba(255,106,0,0.1)",
            color: "#ea580c",
            display: "grid",
            placeItems: "center",
            flexShrink: 0,
          }}
        >
          {icon}
        </span>
        <span style={{ fontSize: 12, fontWeight: 650 }}>{label}</span>
      </div>
      <div style={{ fontSize: 18, fontWeight: 850, color: "#0f172a", letterSpacing: "-0.02em" }}>
        {value}
      </div>
      {hint ? <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600 }}>{hint}</div> : null}
    </button>
  );
}

function TimelineRow({
  title,
  meta,
  right,
}: {
  title: string;
  meta: string;
  right?: string;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr auto",
        gap: 10,
        padding: "11px 12px",
        borderBottom: "1px solid #f1f5f9",
        alignItems: "start",
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: "#0f172a",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {title}
        </div>
        <div style={{ fontSize: 11.5, color: "#94a3b8", marginTop: 3 }}>{meta}</div>
      </div>
      {right ? (
        <div style={{ fontSize: 13, fontWeight: 800, color: "#334155", whiteSpace: "nowrap" }}>
          {right}
        </div>
      ) : null}
    </div>
  );
}

export function AdminUserDetailModal({
  userId,
  onClose,
  onToggled,
  onDeleted,
}: {
  userId: string;
  onClose: () => void;
  onToggled?: () => void;
  onDeleted?: () => void;
}) {
  const { confirm } = useDialog();
  const [data, setData] = useState<DetailPayload | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>("ozet");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    accountType: "BIREYSEL_TICARI",
    commercialSubtypes: [] as string[],
    commercialStatus: "",
    role: "USER",
    tokenBalance: 0,
    isActive: true,
  });
  const [commercialDraft, setCommercialDraft] = useState<CommercialProfile>({
    ...EMPTY_COMMERCIAL_PROFILE,
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin?view=user-detail&userId=${encodeURIComponent(userId)}`);
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Yüklenemedi");
        setData(null);
        return;
      }
      setData(json);
      const u = json.user;
      setForm({
        name: u.name || "",
        phone: formatPhoneTr(u.phone || ""),
        email: u.email || "",
        accountType: isCorporateAccount(u.accountType) ? "TICARI" : "BIREYSEL_TICARI",
        commercialSubtypes: Array.isArray(u.commercialSubtypes) ? u.commercialSubtypes : [],
        commercialStatus: u.commercialStatus || "",
        role: u.role || "USER",
        tokenBalance: Number(u.tokenBalance) || 0,
        isActive: Boolean(u.isActive),
      });
      setCommercialDraft({ ...EMPTY_COMMERCIAL_PROFILE, ...(json.commercialProfile || {}) });
    } catch {
      setError("Bağlantı hatası");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (editing) setEditing(false);
        else onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, editing]);

  async function toggleActive() {
    if (!data) return;
    setBusy(true);
    try {
      await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "toggle-user",
          userId: data.user.id,
          isActive: !data.user.isActive,
        }),
      });
      await load();
      onToggled?.();
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit() {
    if (!data) return;
    setSaveError("");
    setBusy(true);
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update-user",
          userId: data.user.id,
          name: form.name,
          phone: normalizePhoneTr(form.phone),
          email: form.email,
          accountType: form.accountType,
          commercialSubtypes: form.accountType === "TICARI" ? form.commercialSubtypes : [],
          commercialStatus:
            form.accountType === "TICARI" ? form.commercialStatus || null : null,
          commercialProfile: form.accountType === "TICARI" ? commercialDraft : undefined,
          role: form.role,
          tokenBalance: form.tokenBalance,
          isActive: form.isActive,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setSaveError(json.error || "Kayıt başarısız");
        return;
      }
      setEditing(false);
      await load();
      onToggled?.();
    } finally {
      setBusy(false);
    }
  }

  async function deleteUser() {
    if (!data) return;
    const ok = await confirm({
      title: "Kullanıcıyı sil",
      message: `"${data.user.name || data.user.phone}" kalıcı olarak silinsin mi? İlan, teklif ve ödeme kayıtları da etkilenebilir. Bu işlem geri alınamaz.`,
      confirmLabel: "Sil",
      cancelLabel: "Vazgeç",
      tone: "danger",
    });
    if (!ok) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete-user", userId: data.user.id }),
      });
      const json = await res.json();
      if (!res.ok) {
        setSaveError(json.error || "Silinemedi");
        return;
      }
      onDeleted?.();
      onToggled?.();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  function startEdit() {
    if (!data) return;
    const u = data.user;
    const corporate = isCorporateAccount(u.accountType);
    setForm({
      name: u.name || "",
      phone: formatPhoneTr(u.phone || ""),
      email: u.email || "",
      accountType: corporate ? "TICARI" : "BIREYSEL_TICARI",
      commercialSubtypes: Array.isArray(u.commercialSubtypes) ? [...u.commercialSubtypes] : [],
      commercialStatus: u.commercialStatus || "",
      role: u.role || "USER",
      tokenBalance: Number(u.tokenBalance) || 0,
      isActive: Boolean(u.isActive),
    });
    setCommercialDraft({ ...EMPTY_COMMERCIAL_PROFILE, ...(data.commercialProfile || {}) });
    setSaveError("");
    setEditing(true);
    if (corporate) setTab("ticari");
  }

  const u = data?.user;
  const avatar = u?.avatarUrl || u?.logoUrl || null;
  const subs = u?.commercialSubtypes || [];
  const companyName =
    data?.companyName ||
    data?.shop?.companyName ||
    data?.shop?.displayName ||
    data?.shop?.name ||
    null;

  const showTicariTab =
    isCorporateAccount(u?.accountType) || (editing && form.accountType === "TICARI");

  const tabs: Array<{ key: TabKey; label: string; count?: number }> = [
    { key: "ozet", label: "Özet" },
    ...(showTicariTab ? [{ key: "ticari" as const, label: "Ticari bilgiler" }] : []),
    {
      key: "alisveris",
      label: "Alışveriş",
      count: data?.stats.paymentsCount,
    },
    { key: "teklifler", label: "Teklifler", count: data?.stats.bidsCount },
    { key: "ilanlar", label: "İlanlar", count: data?.stats.listingsCount },
  ];

  return (
    <div className="tb-dialog-backdrop" onClick={onClose} role="presentation">
      <div
        className="tb-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Kullanıcı detayı"
        style={{
          textAlign: "left",
          width: "min(820px, 100%)",
          maxHeight: "92vh",
          overflow: "hidden",
          padding: 0,
          display: "flex",
          flexDirection: "column",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="tb-dialog-close" onClick={onClose} aria-label="Kapat">
          <X size={16} />
        </button>

        {loading && (
          <div style={{ padding: 48, textAlign: "center", color: "#64748b", fontWeight: 650 }}>
            Yükleniyor…
          </div>
        )}

        {!loading && error && (
          <div style={{ padding: 32, display: "grid", gap: 12, placeItems: "center" }}>
            <div style={{ color: "#b91c1c", fontWeight: 750 }}>{error}</div>
            <button type="button" className="btn-orange" style={{ padding: "10px 16px" }} onClick={() => void load()}>
              Tekrar dene
            </button>
          </div>
        )}

        {!loading && u && data && (
          <>
            {/* Header */}
            <div
              style={{
                background:
                  "linear-gradient(135deg, #0f172a 0%, #1e293b 55%, #334155 100%)",
                color: "#fff",
                padding: "22px 48px 20px 22px",
                flexShrink: 0,
              }}
            >
              <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                <div
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: 20,
                    overflow: "hidden",
                    background: "rgba(255,255,255,0.1)",
                    border: "2px solid rgba(255,255,255,0.18)",
                    flexShrink: 0,
                    display: "grid",
                    placeItems: "center",
                    fontWeight: 850,
                    fontSize: 22,
                    letterSpacing: "-0.03em",
                  }}
                >
                  {avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={avatar}
                      alt=""
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  ) : (
                    initials(u.name, u.phone)
                  )}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                    <h2
                      style={{
                        margin: 0,
                        fontSize: 22,
                        fontWeight: 850,
                        letterSpacing: "-0.03em",
                        lineHeight: 1.2,
                      }}
                    >
                      {u.name || "İsimsiz üye"}
                    </h2>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 800,
                        padding: "4px 9px",
                        borderRadius: 999,
                        background: u.isActive ? "rgba(16,185,129,0.2)" : "rgba(248,113,113,0.2)",
                        color: u.isActive ? "#6ee7b7" : "#fecaca",
                      }}
                    >
                      {u.isActive ? "Aktif" : "Pasif"}
                    </span>
                    {u.isPremiumSeller ? (
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 800,
                          padding: "4px 9px",
                          borderRadius: 999,
                          background: "rgba(251,146,60,0.25)",
                          color: "#fdba74",
                        }}
                      >
                        Premium
                      </span>
                    ) : null}
                  </div>
                  <div style={{ marginTop: 6, fontSize: 13, color: "rgba(255,255,255,0.72)" }}>
                    {formatPhoneTr(u.phone)}
                    {u.email ? ` · ${u.email}` : ""}
                    {u.phoneVerified ? " · Telefon doğrulandı" : ""}
                  </div>
                  <div
                    style={{
                      marginTop: 10,
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 8,
                      fontSize: 12,
                      color: "rgba(255,255,255,0.78)",
                    }}
                  >
                    <span
                      style={{
                        background: "rgba(255,255,255,0.1)",
                        padding: "4px 10px",
                        borderRadius: 8,
                        fontWeight: 700,
                      }}
                    >
                      {accountTypeLabelTr(u.accountType)}
                      {isCorporateAccount(u.accountType) && subs.length
                        ? ` · ${subs.map((s) => commercialSubtypeLabelTr(s)).join(", ")}`
                        : ""}
                    </span>
                    <span
                      style={{
                        background: "rgba(255,255,255,0.1)",
                        padding: "4px 10px",
                        borderRadius: 8,
                        fontWeight: 700,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 5,
                      }}
                    >
                      <Clock size={12} />
                      Üyelik: {formatDate(u.memberSince || u.createdAt)}
                    </span>
                    {companyName ? (
                      <span
                        style={{
                          background: "rgba(255,255,255,0.1)",
                          padding: "4px 10px",
                          borderRadius: 8,
                          fontWeight: 700,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 5,
                        }}
                      >
                        <Store size={12} />
                        {companyName}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                gap: 10,
                padding: "14px 18px",
                borderBottom: "1px solid #eef2f7",
                background: "#fbfdff",
                flexShrink: 0,
              }}
            >
              <StatCard
                icon={<ShoppingBag size={14} />}
                label="Alışveriş"
                value={formatTl(data.stats.paymentsTotalTl, { fractionDigits: 0 })}
                hint={`${data.stats.paymentsCount} işlem`}
                onClick={() => setTab("alisveris")}
              />
              <StatCard
                icon={<Gavel size={14} />}
                label="Teklifler"
                value={String(data.stats.bidsCount)}
                hint={
                  data.recentBids[0]
                    ? `Son: ${relativeTime(data.recentBids[0].createdAt)}`
                    : "Henüz teklif yok"
                }
                onClick={() => setTab("teklifler")}
              />
              <StatCard
                icon={<MessageSquare size={14} />}
                label="Mesajlar"
                value={String(data.stats.messagesTotal)}
                hint={`${data.stats.messagesSent} giden · ${data.stats.messagesReceived} gelen`}
              />
              <StatCard
                icon={<Megaphone size={14} />}
                label="İlanlar"
                value={String(data.stats.listingsCount)}
                hint={data.stats.listingsCount ? "İlanları gör →" : `Jeton: ${u.tokenBalance}`}
                onClick={() => setTab("ilanlar")}
              />
            </div>

            {/* Tabs */}
            <div
              style={{
                display: "flex",
                gap: 2,
                padding: "0 14px",
                borderBottom: "1px solid #eef2f7",
                flexShrink: 0,
              }}
            >
              {tabs.map((t) => {
                const active = tab === t.key;
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setTab(t.key)}
                    style={{
                      border: "none",
                      background: "transparent",
                      padding: "11px 14px",
                      fontSize: 13,
                      fontWeight: 750,
                      color: active ? "#ea580c" : "#64748b",
                      borderBottom: active ? "2px solid #ea580c" : "2px solid transparent",
                      cursor: "pointer",
                      marginBottom: -1,
                    }}
                  >
                    {t.label}
                    {t.count != null ? (
                      <span style={{ marginLeft: 6, opacity: 0.7 }}>{t.count}</span>
                    ) : null}
                  </button>
                );
              })}
            </div>

            {/* Body */}
            <div style={{ flex: 1, overflow: "auto", padding: "16px 18px", minHeight: 180 }}>
              {tab === "ozet" && (
                <div style={{ display: "grid", gap: 14 }}>
                  {editing ? (
                    <div style={{ display: "grid", gap: 12 }}>
                      <h3 style={{ margin: 0, fontSize: 14, fontWeight: 850, color: "#0f172a" }}>
                        Kullanıcı bilgilerini düzenle
                      </h3>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                        <label style={{ display: "grid", gap: 4, fontSize: 12, fontWeight: 700 }}>
                          Ad soyad
                          <input
                            className="input"
                            value={form.name}
                            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                          />
                        </label>
                        <label style={{ display: "grid", gap: 4, fontSize: 12, fontWeight: 700 }}>
                          Telefon
                          <input
                            className="input"
                            value={form.phone}
                            onChange={(e) => setForm((f) => ({ ...f, phone: formatPhoneTr(e.target.value) }))}
                          />
                        </label>
                        <label style={{ display: "grid", gap: 4, fontSize: 12, fontWeight: 700 }}>
                          E-posta
                          <input
                            className="input"
                            value={form.email}
                            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                          />
                        </label>
                        <label style={{ display: "grid", gap: 4, fontSize: 12, fontWeight: 700 }}>
                          Jeton bakiyesi
                          <input
                            className="input"
                            type="number"
                            min={0}
                            value={form.tokenBalance}
                            onChange={(e) =>
                              setForm((f) => ({ ...f, tokenBalance: Number(e.target.value) || 0 }))
                            }
                          />
                        </label>
                        <label style={{ display: "grid", gap: 4, fontSize: 12, fontWeight: 700 }}>
                          Üyelik tipi
                          <select
                            className="select"
                            value={form.accountType}
                            onChange={(e) => {
                              const next = e.target.value;
                              setForm((f) => ({ ...f, accountType: next }));
                              if (next === "TICARI") setTab("ticari");
                              else if (tab === "ticari") setTab("ozet");
                            }}
                          >
                            <option value="BIREYSEL_TICARI">Bireysel</option>
                            <option value="TICARI">Kurumsal</option>
                          </select>
                        </label>
                        <label style={{ display: "grid", gap: 4, fontSize: 12, fontWeight: 700 }}>
                          Rol
                          <select
                            className="select"
                            value={form.role}
                            onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                          >
                            <option value="USER">Üye</option>
                            <option value="ADMIN">Yönetici</option>
                          </select>
                        </label>
                        <label style={{ display: "grid", gap: 4, fontSize: 12, fontWeight: 700 }}>
                          Durum
                          <select
                            className="select"
                            value={form.isActive ? "1" : "0"}
                            onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.value === "1" }))}
                          >
                            <option value="1">Aktif</option>
                            <option value="0">Pasif</option>
                          </select>
                        </label>
                        {form.accountType === "TICARI" && (
                          <label style={{ display: "grid", gap: 4, fontSize: 12, fontWeight: 700 }}>
                            Kurumsal durum
                            <select
                              className="select"
                              value={form.commercialStatus}
                              onChange={(e) => setForm((f) => ({ ...f, commercialStatus: e.target.value }))}
                            >
                              <option value="">—</option>
                              <option value="PENDING">Onay bekliyor</option>
                              <option value="APPROVED">Onaylandı</option>
                              <option value="REJECTED">Reddedildi</option>
                            </select>
                          </label>
                        )}
                      </div>
                      {form.accountType === "TICARI" ? (
                        <div
                          style={{
                            fontSize: 12.5,
                            color: "#9a3412",
                            background: "#fff7ed",
                            border: "1px solid #fed7aa",
                            borderRadius: 10,
                            padding: "10px 12px",
                            fontWeight: 650,
                          }}
                        >
                          Ticari unvan, vergi ve adres bilgileri için{" "}
                          <button
                            type="button"
                            onClick={() => setTab("ticari")}
                            style={{
                              border: "none",
                              background: "none",
                              color: "#ea580c",
                              fontWeight: 850,
                              cursor: "pointer",
                              padding: 0,
                              textDecoration: "underline",
                            }}
                          >
                            Ticari bilgiler
                          </button>{" "}
                          sekmesini kullanın.
                        </div>
                      ) : null}
                      {saveError ? (
                        <div style={{ color: "#b91c1c", fontSize: 13, fontWeight: 700 }}>{saveError}</div>
                      ) : null}
                    </div>
                  ) : (
                    <>
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                          gap: 10,
                        }}
                      >
                        <InfoTile label="Son aktiflik" value={relativeTime(data.lastActivityAt)}>
                          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
                            {formatDateTime(data.lastActivityAt)} · {data.lastActivitySource}
                          </div>
                        </InfoTile>
                        <InfoTile label="Rol" value={u.role === "ADMIN" ? "Yönetici" : "Üye"} />
                        <InfoTile
                          label="Kurumsal durum"
                          value={
                            isCorporateAccount(u.accountType)
                              ? commercialStatusLabel(u.commercialStatus)
                              : "—"
                          }
                        />
                        <InfoTile
                          label="Paket"
                          value={
                            data.subscription?.packageName
                              ? `${data.subscription.packageName}${
                                  data.subscription.isActive ? "" : " (pasif)"
                                }`
                              : "—"
                          }
                        >
                          {data.subscription?.endsAt ? (
                            <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
                              Bitiş: {formatDate(data.subscription.endsAt)}
                            </div>
                          ) : null}
                        </InfoTile>
                      </div>

                      {companyName && (
                        <div
                          style={{
                            border: "1px solid #e2e8f0",
                            borderRadius: 14,
                            padding: "14px 16px",
                            background: "#fff",
                            display: "flex",
                            gap: 12,
                            alignItems: "center",
                          }}
                        >
                          <span
                            style={{
                              width: 40,
                              height: 40,
                              borderRadius: 12,
                              background: "#fff7ed",
                              color: "#ea580c",
                              display: "grid",
                              placeItems: "center",
                            }}
                          >
                            <Store size={18} />
                          </span>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 12, color: "#64748b", fontWeight: 650 }}>Şirket adı</div>
                            <div style={{ fontSize: 15, fontWeight: 800, color: "#0f172a" }}>
                              {companyName}
                            </div>
                            <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
                              {[data.shop?.city, data.shop?.isActive === false ? "Pasif" : data.shop ? "Aktif" : null]
                                .filter(Boolean)
                                .join(" · ") || "—"}
                            </div>
                          </div>
                        </div>
                      )}

                      <div>
                        <h3 style={{ margin: "4px 0 8px", fontSize: 13, fontWeight: 800, color: "#334155" }}>
                          Son işlemler
                        </h3>
                        <div
                          style={{
                            border: "1px solid #e2e8f0",
                            borderRadius: 14,
                            overflow: "hidden",
                            background: "#fff",
                          }}
                        >
                          {data.recentPayments[0] && (
                            <TimelineRow
                              title={paymentPurposeLabel(data.recentPayments[0].purpose)}
                              meta={`Ödeme · ${formatDateTime(data.recentPayments[0].createdAt)} · ${paymentStatusLabel(data.recentPayments[0].status)}`}
                              right={formatTl(data.recentPayments[0].amountTl, { fractionDigits: 0 })}
                            />
                          )}
                          {data.recentBids[0] && (
                            <TimelineRow
                              title={data.recentBids[0].listing?.title || "Teklif"}
                              meta={`Teklif · ${formatDateTime(data.recentBids[0].createdAt)} · ${bidStatusLabel(data.recentBids[0].status)}`}
                              right={formatTl(data.recentBids[0].amount, { fractionDigits: 0 })}
                            />
                          )}
                          {data.recentListings[0] && (
                            <TimelineRow
                              title={data.recentListings[0].title}
                              meta={`İlan · ${formatDateTime(data.recentListings[0].createdAt)} · ${listingStatusLabel(data.recentListings[0].status)}`}
                              right={formatTl(data.recentListings[0].askPrice, { fractionDigits: 0 })}
                            />
                          )}
                          {!data.recentPayments[0] && !data.recentBids[0] && !data.recentListings[0] && (
                            <div style={{ padding: 18, color: "#94a3b8", fontSize: 13, textAlign: "center" }}>
                              Henüz işlem yok
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {tab === "ticari" && showTicariTab && (
                <div style={{ display: "grid", gap: 14 }}>
                  {editing ? (
                    <>
                      <CommercialSubtypePicker
                        value={form.commercialSubtypes}
                        onChange={(next) => setForm((f) => ({ ...f, commercialSubtypes: next }))}
                      />
                      <CommercialBusinessForm
                        value={commercialDraft}
                        onChange={setCommercialDraft}
                        wide
                        hideIntro={false}
                      />
                      {saveError ? (
                        <div style={{ color: "#b91c1c", fontSize: 13, fontWeight: 700 }}>{saveError}</div>
                      ) : null}
                    </>
                  ) : (
                    <CommercialProfileReadonly
                      profile={data.commercialProfile || commercialDraft}
                      subtypes={subs}
                      status={u.commercialStatus}
                    />
                  )}
                </div>
              )}

              {tab === "alisveris" && (
                <ActivityList
                  empty="Alışveriş / ödeme kaydı yok"
                  rows={data.recentPayments.map((p) => ({
                    id: p.id,
                    title: paymentPurposeLabel(p.purpose),
                    meta: `${formatDateTime(p.createdAt)} · ${paymentStatusLabel(p.status)}`,
                    right: formatTl(p.amountTl, { fractionDigits: 0 }),
                  }))}
                />
              )}

              {tab === "teklifler" && (
                <ActivityList
                  empty="Teklif yok"
                  rows={data.recentBids.map((b) => ({
                    id: b.id,
                    title: b.listing?.title || "Teklif",
                    meta: `${formatDateTime(b.createdAt)} · ${bidStatusLabel(b.status)}${
                      b.listing?.listingNo ? ` · #${b.listing.listingNo}` : ""
                    }`,
                    right: formatTl(b.amount, { fractionDigits: 0 }),
                  }))}
                />
              )}

              {tab === "ilanlar" && (
                <ListingsPanel listings={data.recentListings} />
              )}
            </div>

            {/* Footer */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 10,
                padding: "12px 18px",
                borderTop: "1px solid #eef2f7",
                background: "#fff",
                flexShrink: 0,
                flexWrap: "wrap",
              }}
            >
              {editing ? (
                <>
                  <button
                    type="button"
                    className="btn-outline"
                    style={{ padding: "10px 14px" }}
                    disabled={busy}
                    onClick={() => {
                      setEditing(false);
                      setSaveError("");
                    }}
                  >
                    İptal
                  </button>
                  <button
                    type="button"
                    className="btn-orange"
                    style={{ padding: "10px 16px" }}
                    disabled={busy}
                    onClick={() => void saveEdit()}
                  >
                    {busy ? "Kaydediliyor…" : "Kaydet"}
                  </button>
                </>
              ) : (
                <>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      className="btn-outline"
                      style={{ padding: "10px 14px", color: "#b91c1c", borderColor: "#fecaca" }}
                      disabled={busy}
                      onClick={() => void deleteUser()}
                    >
                      Sil
                    </button>
                    <button
                      type="button"
                      className="btn-outline"
                      style={{ padding: "10px 14px" }}
                      disabled={busy}
                      onClick={startEdit}
                    >
                      Düzenle
                    </button>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginLeft: "auto" }}>
                    <button type="button" className="btn-outline" style={{ padding: "10px 14px" }} onClick={onClose}>
                      Kapat
                    </button>
                    <button
                      type="button"
                      className={u.isActive ? "btn-outline" : "btn-orange"}
                      style={{
                        padding: "10px 16px",
                        ...(u.isActive ? { color: "#b91c1c", borderColor: "#fecaca" } : {}),
                      }}
                      disabled={busy}
                      onClick={() => void toggleActive()}
                    >
                      {busy ? "…" : u.isActive ? "Pasifleştir" : "Aktifleştir"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function InfoTile({
  label,
  value,
  children,
}: {
  label: string;
  value: string;
  children?: ReactNode;
}) {
  return (
    <div
      style={{
        border: "1px solid #e8eef5",
        borderRadius: 14,
        padding: "12px 14px",
        background: "#fff",
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.04em" }}>
        {label}
      </div>
      <div style={{ fontSize: 14, fontWeight: 800, color: "#0f172a", marginTop: 4 }}>{value}</div>
      {children}
    </div>
  );
}

function CommercialProfileReadonly({
  profile,
  subtypes,
  status,
}: {
  profile: CommercialProfile;
  subtypes: string[];
  status?: string | null;
}) {
  const companyType =
    COMPANY_TYPE_OPTIONS.find((o) => o.value === profile.companyType)?.label ||
    profile.companyType ||
    "—";
  const rows: Array<{ label: string; value: string }> = [
    { label: "Durum", value: commercialStatusLabel(status) },
    {
      label: "Faaliyet",
      value: subtypes.length
        ? subtypes.map((s) => commercialSubtypeLabelTr(s)).join(", ")
        : "—",
    },
    {
      label: "Mağaza odağı",
      value: formatShopFocusLine(commercialToShopFocus(profile)),
    },
    { label: COMMERCIAL_FIELD_LABELS.commercialTitle, value: profile.commercialTitle || "—" },
    { label: COMMERCIAL_FIELD_LABELS.companyType, value: companyType },
    { label: COMMERCIAL_FIELD_LABELS.taxNumber, value: profile.taxNumber || "—" },
    { label: COMMERCIAL_FIELD_LABELS.taxOffice, value: profile.taxOffice || "—" },
    { label: COMMERCIAL_FIELD_LABELS.tradeRegistryNo, value: profile.tradeRegistryNo || "—" },
    { label: COMMERCIAL_FIELD_LABELS.mersisNo, value: profile.mersisNo || "—" },
    { label: COMMERCIAL_FIELD_LABELS.yetkiBelgeNo, value: profile.yetkiBelgeNo || "—" },
    {
      label: "Adres",
      value:
        [profile.businessDistrict, profile.businessCity].filter(Boolean).join(", ") ||
        profile.businessCity ||
        "—",
    },
    { label: COMMERCIAL_FIELD_LABELS.businessAddress, value: profile.businessAddress || "—" },
    {
      label: "Yetkili",
      value: [profile.authorizedTitle, profile.authorizedPhone].filter(Boolean).join(" · ") || "—",
    },
    { label: COMMERCIAL_FIELD_LABELS.naceCode, value: profile.naceCode || "—" },
  ];

  return (
    <div
      style={{
        border: "1px solid #e2e8f0",
        borderRadius: 14,
        overflow: "hidden",
        background: "#fff",
      }}
    >
      {rows.map((row, i) => (
        <div
          key={row.label}
          style={{
            display: "grid",
            gridTemplateColumns: "160px 1fr",
            gap: 12,
            padding: "10px 14px",
            borderTop: i === 0 ? "none" : "1px solid #f1f5f9",
            background: i % 2 === 0 ? "#fff" : "#fafbfc",
            fontSize: 13,
          }}
        >
          <div style={{ color: "#64748b", fontWeight: 650 }}>{row.label}</div>
          <div style={{ fontWeight: 700, color: "#0f172a" }}>{row.value}</div>
        </div>
      ))}
    </div>
  );
}

function ActivityList({
  rows,
  empty,
}: {
  empty: string;
  rows: Array<{ id: string; title: string; meta: string; right?: string }>;
}) {
  if (!rows.length) {
    return (
      <div style={{ padding: 28, textAlign: "center", color: "#94a3b8", fontSize: 13, fontWeight: 650 }}>
        {empty}
      </div>
    );
  }
  return (
    <div
      style={{
        border: "1px solid #e2e8f0",
        borderRadius: 14,
        overflow: "hidden",
        background: "#fff",
      }}
    >
      {rows.map((r) => (
        <TimelineRow key={r.id} title={r.title} meta={r.meta} right={r.right} />
      ))}
    </div>
  );
}

function ListingsPanel({
  listings,
}: {
  listings: DetailPayload["recentListings"];
}) {
  if (!listings.length) {
    return (
      <div style={{ padding: 28, textAlign: "center", color: "#94a3b8", fontSize: 13, fontWeight: 650 }}>
        İlan yok
      </div>
    );
  }
  return (
    <div style={{ display: "grid", gap: 8 }}>
      {listings.map((l) => (
        <Link
          key={l.id}
          href={`/ilan/${l.id}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "grid",
            gridTemplateColumns: "64px 1fr auto",
            gap: 12,
            alignItems: "center",
            padding: "10px 12px",
            border: "1px solid #e8eef5",
            borderRadius: 14,
            background: "#fff",
            textDecoration: "none",
            color: "inherit",
            transition: "border-color 0.15s, background 0.15s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "#fdba74";
            e.currentTarget.style.background = "#fff7ed";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "#e8eef5";
            e.currentTarget.style.background = "#fff";
          }}
        >
          <div
            style={{
              width: 64,
              height: 48,
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
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
              />
            ) : (
              <div
                style={{
                  height: "100%",
                  display: "grid",
                  placeItems: "center",
                  color: "#cbd5e1",
                  fontSize: 11,
                }}
              >
                —
              </div>
            )}
          </div>
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: 13.5,
                fontWeight: 800,
                color: "#0f172a",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {l.title}
            </div>
            <div style={{ fontSize: 11.5, color: "#94a3b8", marginTop: 3 }}>
              {[
                l.listingNo ? `#${l.listingNo}` : null,
                l.category?.name,
                l.city,
                listingStatusLabel(l.status),
                formatDateTime(l.createdAt),
              ]
                .filter(Boolean)
                .join(" · ")}
            </div>
          </div>
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 850, color: "#334155" }}>
              {formatTl(l.askPrice, { fractionDigits: 0 })}
            </div>
            <div
              style={{
                marginTop: 4,
                fontSize: 11,
                color: "#ea580c",
                fontWeight: 700,
                display: "inline-flex",
                alignItems: "center",
                gap: 3,
              }}
            >
              Aç <ExternalLink size={11} />
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
