"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { formatTl } from "@/lib/format";
import type { BulkListingUpdateItem } from "@/core/services/bulkListingUpdateService";

type BulkReq = {
  id: string;
  status: string;
  rejectionReason?: string | null;
  createdAt: string;
  reviewedAt?: string | null;
  items: BulkListingUpdateItem[];
  seller?: {
    id: string;
    name?: string | null;
    phone?: string | null;
    email?: string | null;
  } | null;
};

export function AdminBulkListingUpdatePanel() {
  const [pending, setPending] = useState<BulkReq[]>([]);
  const [approved, setApproved] = useState<BulkReq[]>([]);
  const [rejected, setRejected] = useState<BulkReq[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const res = await fetch("/api/admin?view=bulk-listing-updates");
      const d = await res.json();
      if (!res.ok) {
        setErr(d.error || "Yüklenemedi");
        return;
      }
      setPending(d.pending || []);
      setApproved(d.approved || []);
      setRejected(d.rejected || []);
    } catch {
      setErr("Bağlantı hatası");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(id: string, action: "approve-bulk-listing-update" | "reject-bulk-listing-update") {
    setBusyId(id);
    setErr("");
    setMsg("");
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          requestId: id,
          reason: reasons[id] || "",
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

  function Card({ r, mode }: { r: BulkReq; mode: "pending" | "done" }) {
    return (
      <div className="card" style={{ padding: 16, display: "grid", gap: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontWeight: 900, fontSize: 15 }}>Toplu ilan güncelleme · {r.items?.length || 0} ilan</div>
            <div style={{ fontSize: 13, color: "#64748b" }}>
              {r.seller?.name || "—"} · {r.seller?.phone || ""}
              {r.seller?.email ? ` · ${r.seller.email}` : ""}
            </div>
            <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
              {new Date(r.createdAt).toLocaleString("tr-TR")}
            </div>
          </div>
          <span
            style={{
              fontSize: 12,
              fontWeight: 800,
              padding: "4px 8px",
              borderRadius: 8,
              background: mode === "pending" ? "#fff7ed" : "#f1f5f9",
              color: mode === "pending" ? "#c2410c" : "#475569",
              height: "fit-content",
            }}
          >
            {r.status}
          </span>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: "left", color: "#64748b", borderBottom: "1px solid #e2e8f0" }}>
                <th style={{ padding: "8px 6px" }}>İlan</th>
                <th style={{ padding: "8px 6px" }}>Alan</th>
                <th style={{ padding: "8px 6px" }}>Eski</th>
                <th style={{ padding: "8px 6px" }}>Yeni</th>
              </tr>
            </thead>
            <tbody>
              {(r.items || []).flatMap((item) => {
                const rows: Array<{ field: string; old: string; neu: string }> = [];
                if (item.before.title !== item.after.title) {
                  rows.push({ field: "İlan adı", old: item.before.title, neu: item.after.title });
                }
                if (item.before.askPrice !== item.after.askPrice) {
                  rows.push({
                    field: "Fiyat",
                    old: formatTl(item.before.askPrice),
                    neu: formatTl(item.after.askPrice),
                  });
                }
                if (item.before.durationDays !== item.after.durationDays) {
                  rows.push({
                    field: "Süre (gün)",
                    old: String(item.before.durationDays),
                    neu: String(item.after.durationDays),
                  });
                }
                if (!rows.length) {
                  rows.push({ field: "—", old: "değişiklik yok", neu: "—" });
                }
                return rows.map((row, i) => (
                  <tr key={`${item.listingId}-${row.field}`} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "8px 6px", verticalAlign: "top" }}>
                      {i === 0 ? (
                        <Link href={`/ilan/${item.listingId}`} style={{ fontWeight: 700, color: "var(--orange)" }}>
                          {item.listingNo || item.before.title}
                        </Link>
                      ) : null}
                    </td>
                    <td style={{ padding: "8px 6px", fontWeight: 700, color: "#64748b" }}>{row.field}</td>
                    <td style={{ padding: "8px 6px" }}>{row.old}</td>
                    <td style={{ padding: "8px 6px", fontWeight: 800 }}>{row.neu}</td>
                  </tr>
                ));
              })}
            </tbody>
          </table>
        </div>

        {mode === "pending" ? (
          <div style={{ display: "grid", gap: 8 }}>
            <input
              className="input"
              placeholder="Red sebebi"
              value={reasons[r.id] || ""}
              onChange={(e) => setReasons((s) => ({ ...s, [r.id]: e.target.value }))}
            />
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                className="btn-orange"
                style={{ padding: "8px 14px" }}
                disabled={busyId === r.id}
                onClick={() => void act(r.id, "approve-bulk-listing-update")}
              >
                Onayla
              </button>
              <button
                type="button"
                className="btn-outline"
                style={{ padding: "8px 14px", color: "#b91c1c", borderColor: "#fecaca" }}
                disabled={busyId === r.id}
                onClick={() => void act(r.id, "reject-bulk-listing-update")}
              >
                Reddet
              </button>
            </div>
          </div>
        ) : r.rejectionReason ? (
          <div style={{ fontSize: 13, color: "#b91c1c" }}>Red: {r.rejectionReason}</div>
        ) : null}
      </div>
    );
  }

  if (loading) return <div>Yükleniyor…</div>;

  return (
    <div style={{ display: "grid", gap: 18 }}>
      {msg ? <div style={{ color: "#166534", fontWeight: 700 }}>{msg}</div> : null}
      {err ? <div style={{ color: "#b91c1c", fontWeight: 700 }}>{err}</div> : null}

      <section style={{ display: "grid", gap: 10 }}>
        <h2 style={{ margin: 0, fontSize: 17, color: "#c2410c" }}>
          Onay bekleyen ({pending.length})
        </h2>
        {pending.length ? pending.map((r) => <Card key={r.id} r={r} mode="pending" />) : (
          <div className="card" style={{ padding: 14, color: "#64748b" }}>Bekleyen toplu güncelleme yok.</div>
        )}
      </section>

      <section style={{ display: "grid", gap: 10 }}>
        <h2 style={{ margin: 0, fontSize: 17, color: "#0f766e" }}>Onaylanan ({approved.length})</h2>
        {approved.slice(0, 20).map((r) => (
          <Card key={r.id} r={r} mode="done" />
        ))}
      </section>

      <section style={{ display: "grid", gap: 10 }}>
        <h2 style={{ margin: 0, fontSize: 17, color: "#b91c1c" }}>Reddedilen ({rejected.length})</h2>
        {rejected.slice(0, 20).map((r) => (
          <Card key={r.id} r={r} mode="done" />
        ))}
      </section>
    </div>
  );
}
