"use client";

import { Suspense, use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { formatMoneyTr } from "@/lib/format";
import { CatalogCheckoutButton } from "@/components/catalog/CatalogCheckoutButton";

type Offer = {
  id: string;
  price: number;
  discountedPrice: number | null;
  effectivePrice: number;
  stockQty: number;
  shippingTimeDays: number | null;
  shippingPrice: number | null;
  warrantyType: string | null;
  warrantyMonths: number | null;
  invoiceAvailable: boolean;
  condition: string | null;
  shop: { id: string; name: string; slug: string } | null;
  seller: { id: string; name: string | null } | null;
  variant: { id: string; title: string; sku: string } | null;
  listingId: string | null;
};

type Variant = {
  id: string;
  title: string;
  sku: string;
  values?: Array<{
    attribute?: { name: string };
    option?: { label: string } | null;
    textValue?: string | null;
  }>;
};

type Product = {
  id: string;
  name: string;
  description: string | null;
  mainImage: string | null;
  brand?: { name: string } | null;
  model?: { name: string } | null;
  categoryPath?: Array<{ id: string; name: string; slug: string }>;
  variants?: Variant[];
};

function ProductDetailInner({ id }: { id: string }) {
  const [product, setProduct] = useState<Product | null>(null);
  const [variantId, setVariantId] = useState("");
  const [offers, setOffers] = useState<Offer[]>([]);
  const [err, setErr] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/catalog/products/${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (!d.ok || !d.product) {
          setErr(d.error || "Ürün bulunamadı");
          return;
        }
        setProduct(d.product);
        const first = (d.product.variants || [])[0]?.id || "";
        setVariantId(first);
      })
      .catch(() => {
        if (!cancelled) setErr("Ürün yüklenemedi");
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!id || !variantId) {
      setOffers([]);
      return;
    }
    let cancelled = false;
    fetch(`/api/products/${id}/offers?variantId=${encodeURIComponent(variantId)}`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setOffers(d.offers || []);
      })
      .catch(() => {
        if (!cancelled) setOffers([]);
      });
    return () => {
      cancelled = true;
    };
  }, [id, variantId]);

  const best = useMemo(() => offers[0] || null, [offers]);
  const crumbs = product?.categoryPath || [];

  if (err) {
    return (
      <div style={{ maxWidth: 960, margin: "40px auto", padding: 16 }}>
        <p>{err}</p>
        <Link href="/alisveris">Alışverişe dön</Link>
      </div>
    );
  }

  if (!product) {
    return <div style={{ padding: 40 }}>Yükleniyor…</div>;
  }

  return (
    <div style={{ maxWidth: 1100, margin: "24px auto", padding: "0 16px", display: "grid", gap: 20 }}>
      <nav style={{ fontSize: 13, color: "#64748b", display: "flex", flexWrap: "wrap", gap: 6 }}>
        <Link href="/alisveris">Alışveriş</Link>
        {crumbs.map((c) => (
          <span key={c.id}>
            › {c.name}
          </span>
        ))}
      </nav>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(240px, 420px) 1fr",
          gap: 24,
          alignItems: "start",
        }}
      >
        <div
          style={{
            aspectRatio: "1",
            borderRadius: 16,
            background: "#f1f5f9",
            overflow: "hidden",
            border: "1px solid #e2e8f0",
          }}
        >
          {product.mainImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={product.mainImage} alt={product.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <div style={{ display: "grid", placeItems: "center", height: "100%", color: "#94a3b8" }}>Görsel yok</div>
          )}
        </div>

        <div style={{ display: "grid", gap: 14 }}>
          <div>
            <h1 style={{ margin: "0 0 6px", fontSize: 26, lineHeight: 1.25 }}>{product.name}</h1>
            <p style={{ margin: 0, color: "#64748b", fontSize: 14 }}>
              {[product.brand?.name, product.model?.name].filter(Boolean).join(" · ") || "Katalog ürünü"}
            </p>
          </div>

          <label style={{ display: "grid", gap: 6, maxWidth: 360 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>Varyant</span>
            <select
              className="msf-select"
              value={variantId}
              onChange={(e) => setVariantId(e.target.value)}
              style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #cbd5e1" }}
            >
              {(product.variants || []).map((v) => (
                <option key={v.id} value={v.id}>
                  {v.title}
                </option>
              ))}
            </select>
          </label>

          <div
            style={{
              padding: 16,
              borderRadius: 14,
              border: "1px solid #e2e8f0",
              background: "#fff",
              display: "grid",
              gap: 8,
            }}
          >
            {best ? (
              <>
                <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
                  <strong style={{ fontSize: 28 }}>{formatMoneyTr(best.effectivePrice)} TL</strong>
                  {best.discountedPrice != null && best.discountedPrice < best.price ? (
                    <span style={{ textDecoration: "line-through", color: "#94a3b8" }}>
                      {formatMoneyTr(best.price)} TL
                    </span>
                  ) : null}
                </div>
                <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>
                  En iyi teklif · {best.shop?.name || best.seller?.name || "Satıcı"}
                  {best.stockQty > 0 ? ` · Stok: ${best.stockQty}` : ""}
                </p>
                {best ? (
                  <CatalogCheckoutButton
                    sellerOfferId={best.id}
                    expectedPriceTl={best.effectivePrice}
                    label="Hemen Al"
                  />
                ) : null}
                {best?.listingId ? (
                  <Link href={`/ilan/${best.listingId}`} style={{ fontSize: 13, color: "#ea580c", marginTop: 4 }}>
                    Satıcı vitrinine git
                  </Link>
                ) : null}
              </>
            ) : (
              <p style={{ margin: 0, color: "#64748b" }}>
                Bu varyant için aktif ve stoklu satıcı teklifi yok (satın alınamaz).
              </p>
            )}
          </div>

          {product.description ? (
            <div>
              <h2 style={{ fontSize: 16, margin: "8px 0" }}>Ürün açıklaması</h2>
              <p style={{ margin: 0, whiteSpace: "pre-wrap", color: "#334155", fontSize: 14 }}>{product.description}</p>
            </div>
          ) : null}
        </div>
      </div>

      <section style={{ display: "grid", gap: 10 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>Satıcı teklifleri</h2>
        {!offers.length ? (
          <p style={{ color: "#64748b", margin: 0 }}>Listelenecek teklif yok.</p>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {offers.map((o) => (
              <div
                key={o.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto",
                  gap: 12,
                  padding: 14,
                  border: "1px solid #e2e8f0",
                  borderRadius: 12,
                  background: "#fff",
                  alignItems: "center",
                }}
              >
                <div>
                  <strong>{o.shop?.name || o.seller?.name || "Satıcı"}</strong>
                  <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>
                    {[
                      o.condition,
                      o.shippingTimeDays != null ? `${o.shippingTimeDays} gün kargo` : null,
                      o.shippingPrice != null ? `Kargo ${formatMoneyTr(o.shippingPrice)} TL` : null,
                      o.warrantyType,
                      o.invoiceAvailable ? "Fatura" : null,
                      `Stok ${o.stockQty}`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                </div>
                <div style={{ textAlign: "right", display: "grid", gap: 6 }}>
                  <strong>{formatMoneyTr(o.effectivePrice)} TL</strong>
                  <CatalogCheckoutButton
                    sellerOfferId={o.id}
                    expectedPriceTl={o.effectivePrice}
                    label="Al"
                  />
                  {o.listingId ? (
                    <Link href={`/ilan/${o.listingId}`} style={{ fontSize: 13, color: "#ea580c" }}>
                      Vitrin
                    </Link>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default function CatalogProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <Suspense fallback={<div style={{ padding: 40 }}>Yükleniyor…</div>}>
      <ProductDetailInner id={id} />
    </Suspense>
  );
}
