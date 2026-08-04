"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, XCircle, Clock3 } from "lucide-react";
import { formatTl } from "@/lib/format";
import { dealTypeLabel } from "@/lib/dealType";
import { listingStatusLabel } from "@/lib/listingStatus";
import type { AdminVertical } from "@/lib/adminVertical";

type ExtensionRequest = {
  id: string;
  days: number;
  status: string;
  rejectionReason?: string | null;
  createdAt: string;
  reviewedAt?: string | null;
  listing: {
    id: string;
    listingNo?: string | null;
    title: string;
    city: string;
    district?: string | null;
    dealType: string;
    status: string;
    endsAt?: string | null;
    askPrice: number;
    coverImage?: string | null;
    category?: { name: string } | null;
    seller?: {
      id: string;
      name?: string | null;
      phone?: string | null;
      email?: string | null;
    } | null;
  };
};

type TabKey = "pending" | "approved" | "rejected";

function formatShortDate(value?: string | Date | null) {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ExtensionDetailModal({
  r,
  mode,
  busy,
  reason,
  msg,
  onReasonChange,
  onClose,
  onApprove,
  onReject,
}: {
  r: ExtensionRequest;
  mode: TabKey;
  busy: boolean;
  reason: string;
  msg: string;
  onReasonChange: (v: string) => void;
  onClose: () => void;
  onApprove: () => void;
  onReject: () => void;
}) {
  const ends = r.listing.endsAt ? new Date(r.listing.endsAt) : null;
  const projected =
    ends && Number.isFinite(r.days)
      ? new Date(ends.getTime() + r.days * 24 * 60 * 60 * 1000)
      : null;

  return (
    <div className="tb-dialog-backdrop" onClick={onClose}>
      <div
        className="tb-dialog"
        style={{ textAlign: "left", width: "min(640px, 100%)", maxHeight: "90vh", overflow: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="tb-dialog-close" onClick={onClose} aria-label="Kapat">
          ×
        </button>
        <h3 className="tb-dialog-title" style={{ textAlign: "left", paddingRight: 28 }}>
          Ek süre talebi detayı
        </h3>

        <div style={{ display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 14 }}>
          {r.listing.coverImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={r.listing.coverImage}
              alt=""
              style={{ width: 96, height: 72, objectFit: "cover", borderRadius: 10, flexShrink: 0 }}
            />
          ) : (
            <div
              style={{
                width: 96,
                height: 72,
                borderRadius: 10,
                background: "#e2e8f0",
                flexShrink: 0,
              }}
            />
          )}
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 16, lineHeight: 1.3 }}>{r.listing.title}</div>
            <div style={{ fontSize: 12.5, color: "#64748b", marginTop: 4 }}>
              {r.listing.listingNo ? `#${r.listing.listingNo} · ` : ""}
              {[r.listing.city, r.listing.district].filter(Boolean).join(" / ")} ·{" "}
              {dealTypeLabel(r.listing.dealType)} · {r.listing.category?.name || "—"}
            </div>
            <div style={{ fontSize: 12.5, marginTop: 6, color: "#64748b" }}>
              Satıcı: {r.listing.seller?.name || "—"} · {r.listing.seller?.phone || "—"}
            </div>
            <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>
              Talep: {formatShortDate(r.createdAt)}
              {r.reviewedAt ? ` · İşlem: ${formatShortDate(r.reviewedAt)}` : ""}
            </div>
            <Link
              href={`/ilan/${r.listing.id}`}
              target="_blank"
              style={{ fontSize: 12, fontWeight: 700, display: "inline-block", marginTop: 6 }}
            >
              İlanı aç ↗
            </Link>
          </div>
          <div
            style={{
              textAlign: "right",
              fontWeight: 900,
              fontSize: 22,
              color: mode === "rejected" ? "#b91c1c" : "#0f766e",
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            +{r.days} gün
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 10,
            marginBottom: 14,
          }}
        >
          <div
            style={{
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: 10,
              padding: "10px 12px",
            }}
          >
            <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700 }}>İlan fiyatı</div>
            <div style={{ fontSize: 15, fontWeight: 800, marginTop: 2 }}>{formatTl(r.listing.askPrice)}</div>
          </div>
          <div
            style={{
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: 10,
              padding: "10px 12px",
            }}
          >
            <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700 }}>İlan durumu</div>
            <div style={{ fontSize: 15, fontWeight: 800, marginTop: 2 }}>
              {listingStatusLabel(r.listing.status)}
            </div>
          </div>
          <div
            style={{
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: 10,
              padding: "10px 12px",
            }}
          >
            <div
              style={{
                fontSize: 11,
                color: "#64748b",
                fontWeight: 700,
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <Clock3 size={12} /> Mevcut bitiş
            </div>
            <div style={{ fontSize: 14, fontWeight: 750, marginTop: 2 }}>
              {ends ? formatShortDate(ends) : "—"}
            </div>
          </div>
          <div
            style={{
              background: "#fff7ed",
              border: "1px solid #fed7aa",
              borderRadius: 10,
              padding: "10px 12px",
            }}
          >
            <div style={{ fontSize: 11, color: "#9a3412", fontWeight: 700 }}>Onay sonrası bitiş</div>
            <div style={{ fontSize: 14, fontWeight: 800, marginTop: 2, color: "#c2410c" }}>
              {projected ? formatShortDate(projected) : "—"}
            </div>
          </div>
        </div>

        {mode === "rejected" && r.rejectionReason ? (
          <div style={{ fontSize: 13, color: "#b91c1c", fontWeight: 600, marginBottom: 12 }}>
            Red sebebi: {r.rejectionReason}
          </div>
        ) : null}

        {mode === "approved" ? (
          <div style={{ fontSize: 13, color: "#0f766e", fontWeight: 700, marginBottom: 12 }}>
            Kabul edildi — süre uzatıldı
          </div>
        ) : null}

        {mode === "pending" ? (
          <>
            <label style={{ display: "grid", gap: 4, fontSize: 12, fontWeight: 700, marginBottom: 12 }}>
              Red sebebi
              <textarea
                className="input"
                rows={2}
                placeholder="Reddetmek için sebep yazın…"
                value={reason}
                onChange={(e) => onReasonChange(e.target.value)}
                style={{ fontWeight: 500 }}
              />
            </label>
            {msg ? (
              <div
                style={{
                  fontSize: 12.5,
                  fontWeight: 600,
                  marginBottom: 10,
                  color: msg.includes("başarısız") || msg.includes("yazın") ? "#b91c1c" : "#059669",
                }}
              >
                {msg}
              </div>
            ) : null}
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                className="btn-outline"
                disabled={busy}
                onClick={onReject}
                style={{
                  padding: "8px 14px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  color: "#b91c1c",
                  borderColor: "#fecaca",
                }}
              >
                <XCircle size={15} /> Reddet
              </button>
              <button
                type="button"
                className="btn-orange"
                disabled={busy}
                onClick={onApprove}
                style={{
                  padding: "8px 16px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  fontWeight: 800,
                }}
              >
                <CheckCircle2 size={15} /> Onayla (+{r.days} gün)
              </button>
            </div>
          </>
        ) : (
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button type="button" className="btn-outline" onClick={onClose} style={{ padding: "8px 14px" }}>
              Kapat
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function AdminExtensionPanel({ vertical }: { vertical?: AdminVertical } = {}) {
  const [pending, setPending] = useState<ExtensionRequest[]>([]);
  const [approved, setApproved] = useState<ExtensionRequest[]>([]);
  const [rejected, setRejected] = useState<ExtensionRequest[]>([]);
  const [tab, setTab] = useState<TabKey>("pending");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const qs = new URLSearchParams({ view: "pending-extensions" });
    if (vertical) qs.set("vertical", vertical);
    const res = await fetch(`/api/admin?${qs}`);
    if (res.ok) {
      const d = await res.json();
      const p = d.pending || d.requests || [];
      const a = d.approved || [];
      const rj = d.rejected || [];
      setPending(p);
      setApproved(a);
      setRejected(rj);
      setSelectedId((prev) => {
        if (!prev) return null;
        const all = [...p, ...a, ...rj];
        return all.some((x) => x.id === prev) ? prev : null;
      });
    }
    setLoading(false);
  }, [vertical]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setReason("");
    setMsg("");
  }, [selectedId]);

  const rows = tab === "pending" ? pending : tab === "approved" ? approved : rejected;

  const selected = useMemo(() => {
    if (!selectedId) return null;
    return [...pending, ...approved, ...rejected].find((r) => r.id === selectedId) || null;
  }, [selectedId, pending, approved, rejected]);

  const selectedMode: TabKey = useMemo(() => {
    if (!selected) return tab;
    if (pending.some((x) => x.id === selected.id)) return "pending";
    if (approved.some((x) => x.id === selected.id)) return "approved";
    return "rejected";
  }, [selected, pending, approved, rejected, tab]);

  async function approve(id: string) {
    setBusy(true);
    setMsg("");
    const res = await fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "approve-extension", requestId: id }),
    });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setMsg(d.error || "Onay başarısız");
      return;
    }
    setSelectedId(null);
    await load();
  }

  async function reject(id: string) {
    if (!reason.trim()) {
      setMsg("Red sebebi yazın.");
      return;
    }
    setBusy(true);
    setMsg("");
    const res = await fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "reject-extension",
        requestId: id,
        reason: reason.trim(),
      }),
    });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setMsg(d.error || "Red başarısız");
      return;
    }
    setSelectedId(null);
    setReason("");
    await load();
  }

  if (loading) return <div className="adm-card">Ek süre talepleri yükleniyor...</div>;

  const tabs: Array<{ key: TabKey; label: string; count: number; color: string }> = [
    { key: "pending", label: "Bekleyen", count: pending.length, color: "#c2410c" },
    { key: "approved", label: "Onaylanan", count: approved.length, color: "#0f766e" },
    { key: "rejected", label: "Reddedilen", count: rejected.length, color: "#b91c1c" },
  ];

  return (
    <div className="adm-card" style={{ padding: 0, overflow: "hidden" }}>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 8,
          padding: "10px 12px",
          borderBottom: "1px solid #e5e7eb",
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
                border: active ? `1px solid ${t.color}` : "1px solid #e2e8f0",
                background: active ? `${t.color}14` : "#fff",
                color: active ? t.color : "#64748b",
                borderRadius: 99,
                padding: "5px 12px",
                fontSize: 12.5,
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              {t.label} ({t.count})
            </button>
          );
        })}
        <span style={{ marginLeft: "auto", fontSize: 12, color: "#64748b", fontWeight: 600 }}>
          Satıra tıklayarak detayı açın
        </span>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table className="adm-table adm-table--compact adm-listings-table">
          <thead>
            <tr>
              <th>Kapak</th>
              <th>İlan</th>
              <th>Kategori</th>
              <th>Satıcı</th>
              <th>Ek süre</th>
              <th>Bitiş</th>
              <th>Talep</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} style={{ color: "var(--adm-muted)", padding: 18 }}>
                  {tab === "pending"
                    ? "Bekleyen ek süre talebi yok."
                    : tab === "approved"
                      ? "Onaylanmış ek süre talebi yok."
                      : "Reddedilmiş ek süre talebi yok."}
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr
                key={r.id}
                className="adm-listings-row"
                onClick={() => setSelectedId(r.id)}
                title="Detay için tıklayın"
                style={{ cursor: "pointer" }}
              >
                <td>
                  {r.listing.coverImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={r.listing.coverImage}
                      alt=""
                      style={{ width: 48, height: 36, objectFit: "cover", borderRadius: 6, display: "block" }}
                    />
                  ) : (
                    <div style={{ width: 48, height: 36, borderRadius: 6, background: "#e2e8f0" }} />
                  )}
                </td>
                <td>
                  <div style={{ fontWeight: 700, fontSize: 13, lineHeight: 1.3 }}>{r.listing.title}</div>
                  <div style={{ fontSize: 11, color: "#64748b" }}>
                    {r.listing.listingNo ? `#${r.listing.listingNo}` : r.listing.id.slice(0, 8)}
                  </div>
                </td>
                <td style={{ fontSize: 12.5 }}>
                  {r.listing.category?.name || "—"}
                  <div style={{ fontSize: 11, color: "#64748b" }}>{dealTypeLabel(r.listing.dealType)}</div>
                </td>
                <td style={{ fontSize: 12.5 }}>
                  {r.listing.seller?.name || "—"}
                  <div style={{ fontSize: 11, color: "#64748b" }}>{r.listing.seller?.phone || ""}</div>
                </td>
                <td style={{ fontSize: 13, fontWeight: 800, color: "#0f766e", whiteSpace: "nowrap" }}>
                  +{r.days} gün
                </td>
                <td style={{ fontSize: 12, color: "#64748b", whiteSpace: "nowrap" }}>
                  {formatShortDate(r.listing.endsAt)}
                </td>
                <td style={{ fontSize: 12, color: "#64748b", whiteSpace: "nowrap" }}>
                  {formatShortDate(r.createdAt)}
                </td>
                <td style={{ fontSize: 12, whiteSpace: "nowrap" }}>
                  {tab === "pending" ? (
                    <span style={{ color: "#c2410c", fontWeight: 700 }}>Bekliyor</span>
                  ) : (
                    <span style={{ color: "#64748b" }}>{formatShortDate(r.reviewedAt)}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected ? (
        <ExtensionDetailModal
          r={selected}
          mode={selectedMode}
          busy={busy}
          reason={reason}
          msg={msg}
          onReasonChange={setReason}
          onClose={() => setSelectedId(null)}
          onApprove={() => approve(selected.id)}
          onReject={() => reject(selected.id)}
        />
      ) : null}
    </div>
  );
}
