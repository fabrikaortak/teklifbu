"use client";

import { useCallback, useEffect, useState } from "react";

type RequestRow = {
  id: string;
  proposedName: string;
  status: string;
  barcode: string | null;
  categoryId: string;
  brandId: string | null;
  createdAt: string;
  requester?: { name: string | null; phone: string };
  rejectionReason?: string | null;
  mergedProductId?: string | null;
};

export function AdminProductRequestsPanel() {
  const [rows, setRows] = useState<RequestRow[]>([]);
  const [status, setStatus] = useState("PENDING");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState("");

  const load = useCallback(() => {
    fetch(`/api/admin/catalog/product-requests?status=${encodeURIComponent(status)}`)
      .then((r) => r.json())
      .then((d) => setRows(d.requests || []));
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

  async function act(id: string, action: string, extra?: Record<string, unknown>) {
    setBusy(id + action);
    setMsg("");
    const res = await fetch(`/api/admin/catalog/product-requests/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...extra }),
    });
    const d = await res.json().catch(() => ({}));
    setBusy("");
    if (!res.ok) {
      setMsg(d.error || "İşlem başarısız");
      return;
    }
    setMsg(action === "approve" ? "Ürün oluşturuldu" : action === "merge" ? "Birleştirildi" : "Reddedildi");
    load();
  }

  return (
    <div className="card" style={{ padding: 16, display: "grid", gap: 12 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>Yeni ürün talepleri</h2>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="msf-select">
          {["PENDING", "APPROVED", "REJECTED", "MERGED", "DRAFT"].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <button type="button" className="btn-orange" onClick={load}>
          Yenile
        </button>
      </div>
      {msg ? <p style={{ margin: 0, color: "var(--muted)" }}>{msg}</p> : null}
      <div style={{ display: "grid", gap: 8 }}>
        {rows.length === 0 ? <p style={{ color: "var(--muted)" }}>Kayıt yok.</p> : null}
        {rows.map((r) => (
          <div
            key={r.id}
            style={{
              border: "1px solid var(--line)",
              borderRadius: 10,
              padding: 12,
              display: "grid",
              gap: 8,
            }}
          >
            <strong>{r.proposedName}</strong>
            <span style={{ fontSize: 13, color: "var(--muted)" }}>
              {r.requester?.name || r.requester?.phone || "—"} · {r.status}
              {r.barcode ? ` · barkod ${r.barcode}` : ""}
            </span>
            {r.status === "PENDING" ? (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  type="button"
                  className="btn-orange"
                  disabled={Boolean(busy)}
                  onClick={() => act(r.id, "approve")}
                >
                  Onayla → Product
                </button>
                <button
                  type="button"
                  disabled={Boolean(busy)}
                  onClick={() => {
                    const productId = window.prompt("Birleştirilecek Product id:");
                    if (productId) void act(r.id, "merge", { productId });
                  }}
                >
                  Mevcut ürünle birleştir
                </button>
                <button
                  type="button"
                  disabled={Boolean(busy)}
                  onClick={() => {
                    const reason = window.prompt("Red nedeni:") || "Reddedildi";
                    void act(r.id, "reject", { reason });
                  }}
                >
                  Reddet
                </button>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
