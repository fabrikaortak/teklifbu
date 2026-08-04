"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminSettingsPanel } from "@/components/admin/AdminPanels";
import { formatPhoneTr } from "@/lib/format";

type Row = {
  id: string;
  body: string;
  rating: number | null;
  createdAt: string;
  author: { id: string; name: string | null; phone: string };
  seller: { id: string; name: string | null; phone: string };
  listing: { id: string; title: string; listingNo: string | null } | null;
};

export function AdminSellerReviewsPanel() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reasons, setReasons] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const res = await fetch("/api/admin?view=seller-reviews");
      const d = await res.json();
      if (!res.ok) {
        setErr(d.error || "Yüklenemedi");
        return;
      }
      setRows(d.reviews || []);
    } catch {
      setErr("Bağlantı hatası");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(reviewId: string, approve: boolean) {
    setBusyId(reviewId);
    setMsg("");
    setErr("");
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: approve ? "approve-seller-review" : "reject-seller-review",
          reviewId,
          reason: reasons[reviewId] || "",
        }),
      });
      const d = await res.json();
      if (!res.ok) {
        setErr(d.error || "İşlem başarısız");
        return;
      }
      setMsg(d.message || "Tamam");
      await load();
    } catch {
      setErr("Bağlantı hatası");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <AdminSettingsPanel onlyGroups={["commercial"]} />

      <div className="adm-card" style={{ padding: 16 }}>
        <h2 style={{ margin: "0 0 12px", fontSize: 16 }}>Onay bekleyen yorumlar</h2>
        {msg ? <div style={{ color: "#166534", fontWeight: 700, marginBottom: 8 }}>{msg}</div> : null}
        {err ? <div style={{ color: "#b91c1c", fontWeight: 700, marginBottom: 8 }}>{err}</div> : null}
        {loading ? (
          <div>Yükleniyor…</div>
        ) : !rows.length ? (
          <div style={{ color: "#64748b" }}>Bekleyen yorum yok.</div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {rows.map((r) => (
              <div
                key={r.id}
                style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 14, display: "grid", gap: 8 }}
              >
                <div style={{ fontSize: 13, color: "#64748b" }}>
                  Yazan: {r.author.name || "—"} ({formatPhoneTr(r.author.phone)}) → Satıcı:{" "}
                  {r.seller.name || "—"} ({formatPhoneTr(r.seller.phone)})
                  {r.listing ? ` · İlan: ${r.listing.title}` : ""}
                  {r.rating ? ` · ${r.rating}★` : ""}
                </div>
                <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>{r.body}</p>
                <input
                  className="input"
                  placeholder="Red sebebi (opsiyonel)"
                  value={reasons[r.id] || ""}
                  onChange={(e) => setReasons((s) => ({ ...s, [r.id]: e.target.value }))}
                />
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    className="btn-orange"
                    style={{ padding: "8px 12px" }}
                    disabled={busyId === r.id}
                    onClick={() => void act(r.id, true)}
                  >
                    Onayla
                  </button>
                  <button
                    type="button"
                    className="btn-outline"
                    style={{ padding: "8px 12px" }}
                    disabled={busyId === r.id}
                    onClick={() => void act(r.id, false)}
                  >
                    Reddet
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
