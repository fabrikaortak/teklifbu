"use client";

import { useEffect, useState } from "react";

export function AdminSellerOffersPanel() {
  const [offers, setOffers] = useState<
    Array<{
      id: string;
      price: number;
      stockQty: number;
      status: string;
      product?: { name: string };
      variant?: { title: string };
      shop?: { name: string };
      seller?: { name: string | null; phone: string };
    }>
  >([]);

  useEffect(() => {
    fetch("/api/admin/catalog/offers")
      .then((r) => r.json())
      .then((d) => setOffers(d.offers || []));
  }, []);

  return (
    <div className="card" style={{ padding: 16, display: "grid", gap: 10 }}>
      <h2 style={{ margin: 0, fontSize: 18 }}>SellerOffer listesi</h2>
      {offers.length === 0 ? <p style={{ color: "var(--muted)" }}>Teklif yok.</p> : null}
      {offers.map((o) => (
        <div key={o.id} style={{ border: "1px solid var(--line)", borderRadius: 10, padding: 10 }}>
          <strong>
            {o.product?.name} · {o.variant?.title}
          </strong>
          <div style={{ fontSize: 13, color: "var(--muted)" }}>
            {o.shop?.name || o.seller?.name || o.seller?.phone} · {o.status} · ₺
            {o.price.toLocaleString("tr-TR")} · stok {o.stockQty}
          </div>
        </div>
      ))}
    </div>
  );
}
