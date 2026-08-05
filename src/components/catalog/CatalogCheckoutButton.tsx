"use client";

import { useState } from "react";

/** /urun — SellerOfferId ile doğrudan katalog checkout */
export function CatalogCheckoutButton({
  sellerOfferId,
  expectedPriceTl,
  shipDays = 7,
  label = "Hemen Al",
}: {
  sellerOfferId: string;
  expectedPriceTl?: number;
  shipDays?: number;
  label?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onBuy() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/catalog/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sellerOfferId,
          quantity: 1,
          shipDays,
          expectedPriceTl,
          idempotencyKey: `urun-${sellerOfferId}-${Date.now()}`,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || data.code || "Checkout başarısız");
        return;
      }
      if (data.payUrl) {
        window.location.assign(data.payUrl);
        return;
      }
      setError("Ödeme bağlantısı alınamadı");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Hata");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 6 }}>
      <button
        type="button"
        className="btn-orange"
        style={{ width: "fit-content", marginTop: 4, opacity: busy ? 0.7 : 1 }}
        disabled={busy}
        onClick={onBuy}
      >
        {busy ? "İşleniyor…" : label}
      </button>
      {error ? <span style={{ fontSize: 12, color: "#b91c1c" }}>{error}</span> : null}
    </div>
  );
}
