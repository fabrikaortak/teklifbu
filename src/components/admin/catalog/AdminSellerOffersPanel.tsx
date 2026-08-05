"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type OfferRow = {
  id: string;
  price: number;
  stockQty: number;
  status: string;
  listingId?: string | null;
  product?: { id: string; name: string };
  variant?: { title: string };
  shop?: { name: string };
  seller?: { name: string | null; phone: string };
};

export function AdminSellerOffersPanel() {
  const [offers, setOffers] = useState<OfferRow[]>([]);
  const [filter, setFilter] = useState("PENDING_REVIEW");
  const [busyId, setBusyId] = useState("");
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    const qs = filter ? `?status=${encodeURIComponent(filter)}` : "";
    const r = await fetch(`/api/admin/catalog/offers${qs}`);
    const d = await r.json().catch(() => ({}));
    setOffers(d.offers || []);
  }, [filter]);

  useEffect(() => {
    load().catch(() => setOffers([]));
  }, [load]);

  async function act(offerId: string, action: "approve" | "reject") {
    setBusyId(offerId + action);
    setMsg("");
    try {
      const res = await fetch("/api/admin/catalog/offers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, offerId }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(d.error || "İşlem başarısız");
        return;
      }
      setMsg(action === "approve" ? "Teklif onaylandı" : "Teklif reddedildi");
      await load();
    } finally {
      setBusyId("");
    }
  }

  return (
    <div className="card" style={{ padding: 16, display: "grid", gap: 10 }}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <h2 style={{ margin: 0, fontSize: 18, flex: 1 }}>SellerOffer listesi</h2>
        <select
          className="input"
          style={{ width: "auto", minWidth: 160 }}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="">Tümü</option>
          <option value="PENDING_REVIEW">Onay bekleyen</option>
          <option value="ACTIVE">Aktif</option>
          <option value="REJECTED">Reddedilen</option>
          <option value="PAUSED">Duraklatılan</option>
          <option value="SOLD_OUT">Tükendi</option>
        </select>
      </div>
      {msg ? <div style={{ fontSize: 13, color: "#166534" }}>{msg}</div> : null}
      {offers.length === 0 ? <p style={{ color: "var(--muted)" }}>Teklif yok.</p> : null}
      {offers.map((o) => (
        <div key={o.id} style={{ border: "1px solid var(--line)", borderRadius: 10, padding: 10 }}>
          <strong>
            {o.product?.name} · {o.variant?.title}
          </strong>
          <div style={{ fontSize: 13, color: "var(--muted)" }}>
            {o.shop?.name || o.seller?.name || o.seller?.phone} · {o.status} · ₺
            {Number(o.price).toLocaleString("tr-TR")} · stok {o.stockQty}
            {o.listingId ? " · mirror var" : " · mirror yok"}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
            {o.product?.id ? (
              <Link href={`/urun/${o.product.id}`} className="btn-outline" style={{ padding: "4px 10px", fontSize: 12 }}>
                Ürün
              </Link>
            ) : null}
            {o.listingId ? (
              <Link href={`/ilan/${o.listingId}`} className="btn-outline" style={{ padding: "4px 10px", fontSize: 12 }}>
                Mirror ilan
              </Link>
            ) : null}
            {o.status === "PENDING_REVIEW" ? (
              <>
                <button
                  type="button"
                  className="btn-orange"
                  style={{ padding: "4px 10px", fontSize: 12 }}
                  disabled={Boolean(busyId)}
                  onClick={() => void act(o.id, "approve")}
                >
                  Onayla
                </button>
                <button
                  type="button"
                  className="btn-outline"
                  style={{ padding: "4px 10px", fontSize: 12 }}
                  disabled={Boolean(busyId)}
                  onClick={() => void act(o.id, "reject")}
                >
                  Reddet
                </button>
              </>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}
