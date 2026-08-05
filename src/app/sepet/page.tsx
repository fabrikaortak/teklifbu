"use client";

import Link from "next/link";
import { Trash2 } from "lucide-react";
import { useCart, useRegisterShoppingSurface } from "@/components/cart/CartProvider";
import { formatTl } from "@/lib/format";

export default function SepetPage() {
  useRegisterShoppingSurface(true);
  const { items, itemCount, totalTl, removeItem, setQty, clear } = useCart();

  return (
    <div className="page-shell" style={{ padding: "24px 16px 48px", maxWidth: 920 }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 6 }}>Sepetim</h1>
      <p style={{ color: "#64748b", marginBottom: 20, fontSize: 14 }}>
        {itemCount} ürün · Toplam {formatTl(totalTl, { fractionDigits: 2 })}
      </p>

      {!items.length ? (
        <div
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 14,
            padding: 28,
            textAlign: "center",
            background: "#fff",
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Sepetiniz boş</div>
          <p style={{ color: "#64748b", fontSize: 14, marginBottom: 16 }}>
            Alışveriş kategorisinden ürün ekleyebilirsiniz.
          </p>
          <Link href="/alisveris" className="btn-orange" style={{ display: "inline-flex", padding: "10px 16px" }}>
            Alışverişe Git
          </Link>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 16 }}>
          <div style={{ display: "grid", gap: 10 }}>
            {items.map((item) => (
              <div
                key={item.listingId}
                style={{
                  display: "grid",
                  gridTemplateColumns: "72px 1fr auto",
                  gap: 12,
                  alignItems: "center",
                  border: "1px solid #e5e7eb",
                  borderRadius: 12,
                  padding: 12,
                  background: "#fff",
                }}
              >
                <Link href={`/ilan/${item.listingId}`} style={{ width: 72, height: 72, borderRadius: 10, overflow: "hidden", background: "#f1f5f9" }}>
                  {item.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : null}
                </Link>
                <div style={{ minWidth: 0 }}>
                  <Link href={`/ilan/${item.listingId}`} style={{ fontWeight: 700, fontSize: 14, color: "#0f172a" }}>
                    {item.title}
                  </Link>
                  <div style={{ marginTop: 6, fontWeight: 800, color: "#0b1f3a" }}>{formatTl(item.price, { fractionDigits: 2 })}</div>
                  <div style={{ marginTop: 8, display: "inline-flex", alignItems: "center", gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => setQty(item.listingId, item.qty - 1)}
                      style={{ width: 28, height: 28, borderRadius: 8, border: "1px solid #e5e7eb", background: "#fff", cursor: "pointer" }}
                    >
                      −
                    </button>
                    <span style={{ minWidth: 20, textAlign: "center", fontWeight: 700 }}>{item.qty}</span>
                    <button
                      type="button"
                      onClick={() => setQty(item.listingId, item.qty + 1)}
                      style={{ width: 28, height: 28, borderRadius: 8, border: "1px solid #e5e7eb", background: "#fff", cursor: "pointer" }}
                    >
                      +
                    </button>
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10 }}>
                  <div style={{ fontWeight: 800 }}>{formatTl(item.price * item.qty, { fractionDigits: 2 })}</div>
                  <button
                    type="button"
                    onClick={() => removeItem(item.listingId)}
                    aria-label="Kaldır"
                    style={{
                      border: "none",
                      background: "transparent",
                      color: "#94a3b8",
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      fontSize: 12,
                    }}
                  >
                    <Trash2 size={14} /> Sil
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 14,
              padding: 16,
              background: "#fff",
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <div>
              <div style={{ fontSize: 13, color: "#64748b" }}>{itemCount} ürün</div>
              <div style={{ fontSize: 20, fontWeight: 800 }}>Toplam {formatTl(totalTl, { fractionDigits: 2 })}</div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="button" className="btn-outline" onClick={clear} style={{ padding: "10px 14px" }}>
                Sepeti Temizle
              </button>
              <Link href="/alisveris" className="btn-outline" style={{ padding: "10px 14px" }}>
                Alışverişe Dön
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
