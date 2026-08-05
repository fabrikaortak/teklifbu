"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Hit = {
  id: string;
  name: string;
  brand?: { id: string; name: string } | null;
  model?: { id: string; name: string } | null;
  categoryPath?: string;
  variantCount?: number;
  mainImage?: string | null;
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

/**
 * Satıcı: katalog ara → varyant seç → SellerOffer.
 * Klasik Listing akışına paralel; mevcut formu bozmaz.
 */
export function CatalogOfferWizard({
  categoryId,
  brandId,
  modelId,
  city,
  district,
}: {
  categoryId?: string;
  brandId?: string;
  modelId?: string;
  city?: string;
  district?: string;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [productId, setProductId] = useState("");
  const [variants, setVariants] = useState<Variant[]>([]);
  const [variantId, setVariantId] = useState("");
  const [priceTl, setPriceTl] = useState("");
  const [stockQty, setStockQty] = useState("1");
  const [shippingTimeDays, setShippingTimeDays] = useState("3");
  const [shippingPriceTl, setShippingPriceTl] = useState("0");
  const [warrantyType, setWarrantyType] = useState("Distribütör");
  const [warrantyMonths, setWarrantyMonths] = useState("24");
  const [invoiceAvailable, setInvoiceAvailable] = useState(true);
  const [condition, setCondition] = useState("Sıfır");
  const [sellerSku, setSellerSku] = useState("");
  const [sellerNote, setSellerNote] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [requestName, setRequestName] = useState("");
  const [similar, setSimilar] = useState<Array<{ id: string; name: string; score: number }>>([]);

  const selected = useMemo(() => hits.find((h) => h.id === productId), [hits, productId]);

  async function search() {
    setMsg("");
    const qs = new URLSearchParams();
    if (q) qs.set("q", q);
    if (categoryId) qs.set("categoryId", categoryId);
    if (brandId) qs.set("brandId", brandId);
    if (modelId) qs.set("modelId", modelId);
    const res = await fetch(`/api/catalog/products/search?${qs}`);
    const d = await res.json();
    setHits(d.products || []);
    if (!(d.products || []).length) setMsg("Katalogda ürün bulunamadı — talep açabilirsiniz.");
  }

  useEffect(() => {
    if (!productId) {
      setVariants([]);
      setVariantId("");
      return;
    }
    fetch(`/api/catalog/products/${productId}/variants`)
      .then((r) => r.json())
      .then((d) => {
        setVariants(d.variants || []);
        setVariantId("");
      });
  }, [productId]);

  async function submitOffer() {
    setBusy(true);
    setMsg("");
    const res = await fetch("/api/seller/offers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productId,
        variantId,
        priceTl: Number(priceTl),
        stockQty: Number(stockQty),
        shippingTimeDays: Number(shippingTimeDays) || null,
        shippingPriceTl: Number(shippingPriceTl) || 0,
        warrantyType,
        warrantyMonths: Number(warrantyMonths) || null,
        invoiceAvailable,
        condition,
        sellerSku,
        sellerNote,
        city,
        district,
      }),
    });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.status === 409 && d.code === "ACTIVE_OFFER_EXISTS") {
      setMsg("Bu varyant için aktif teklifiniz var — ürün sayfasına yönlendiriliyorsunuz.");
      if (productId) router.push(`/urun/${productId}`);
      else router.push("/hesabim?s=alisveris");
      return;
    }
    if (!res.ok) {
      setMsg(d.error || "Teklif oluşturulamadı");
      return;
    }
    setMsg("SellerOffer oluşturuldu");
    // Mirror yoksa /urun; legacy mirror varsa da katalog ürün sayfası tercih edilir
    if (productId) router.push(`/urun/${productId}`);
    else if (d.offer?.listingId) router.push(`/ilan/${d.offer.listingId}`);
  }

  async function submitRequest(force = false) {
    setBusy(true);
    setMsg("");
    const res = await fetch("/api/catalog/product-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        proposedName: requestName || q,
        categoryId,
        brandId,
        modelId,
        description: sellerNote,
        force,
      }),
    });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.status === 409 && d.code === "SIMILAR_PRODUCTS") {
      setSimilar(d.similar || []);
      setMsg("Bu ürün katalogda olabilir — listeden seçin veya zorla talep gönderin.");
      return;
    }
    if (!res.ok) {
      setMsg(d.error || "Talep açılamadı");
      return;
    }
    setMsg("Ürün talebi admin onayına gönderildi.");
    setSimilar([]);
  }

  return (
    <div className="card" style={{ padding: 16, display: "grid", gap: 12 }}>
      <h2 style={{ margin: 0, fontSize: 17 }}>Katalogdan satış (SellerOffer)</h2>
      <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>
        Mevcut Listing ilanı ayrı kalır. Burada ortak ürüne teklif bağlarsınız; yeni ürünü doğrudan
        oluşturamazsınız.
      </p>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input
          className="msf-input"
          style={{ flex: 1, minWidth: 180 }}
          placeholder="Ürün / marka / model / barkod ara"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button type="button" className="btn-orange" onClick={search}>
          Katalogda ara
        </button>
      </div>

      {hits.length ? (
        <div style={{ display: "grid", gap: 6, maxHeight: 220, overflow: "auto" }}>
          {hits.map((h) => (
            <button
              key={h.id}
              type="button"
              onClick={() => setProductId(h.id)}
              style={{
                textAlign: "left",
                border: productId === h.id ? "2px solid var(--orange)" : "1px solid var(--line)",
                borderRadius: 10,
                padding: 10,
                background: "#fff",
                cursor: "pointer",
              }}
            >
              <strong>{h.name}</strong>
              <div style={{ fontSize: 12, color: "var(--muted)" }}>
                {[h.brand?.name, h.model?.name, h.categoryPath, `${h.variantCount || 0} varyant`]
                  .filter(Boolean)
                  .join(" · ")}
              </div>
            </button>
          ))}
        </div>
      ) : null}

      {selected ? (
        <>
          <label style={{ display: "grid", gap: 4 }}>
            <span>Varyant</span>
            <select
              className="msf-select"
              value={variantId}
              onChange={(e) => setVariantId(e.target.value)}
            >
              <option value="">Seçin</option>
              {variants.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.title}
                </option>
              ))}
            </select>
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <label>
              Satış fiyatı (TL)
              <input className="msf-input" value={priceTl} onChange={(e) => setPriceTl(e.target.value)} />
            </label>
            <label>
              Stok
              <input className="msf-input" value={stockQty} onChange={(e) => setStockQty(e.target.value)} />
            </label>
            <label>
              Kargo süresi (gün)
              <input
                className="msf-input"
                value={shippingTimeDays}
                onChange={(e) => setShippingTimeDays(e.target.value)}
              />
            </label>
            <label>
              Kargo ücreti (TL)
              <input
                className="msf-input"
                value={shippingPriceTl}
                onChange={(e) => setShippingPriceTl(e.target.value)}
              />
            </label>
            <label>
              Garanti tipi
              <input
                className="msf-input"
                value={warrantyType}
                onChange={(e) => setWarrantyType(e.target.value)}
              />
            </label>
            <label>
              Garanti (ay)
              <input
                className="msf-input"
                value={warrantyMonths}
                onChange={(e) => setWarrantyMonths(e.target.value)}
              />
            </label>
          </div>
          <label>
            Durum
            <select className="msf-select" value={condition} onChange={(e) => setCondition(e.target.value)}>
              {["Sıfır", "İkinci El", "Yenilenmiş"].map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label>
            <input
              type="checkbox"
              checked={invoiceAvailable}
              onChange={(e) => setInvoiceAvailable(e.target.checked)}
            />{" "}
            Fatura kesilir
          </label>
          <input
            className="msf-input"
            placeholder="Satıcı ürün kodu (SKU)"
            value={sellerSku}
            onChange={(e) => setSellerSku(e.target.value)}
          />
          <textarea
            className="msf-textarea"
            rows={3}
            placeholder="Mağazaya özel kısa açıklama (katalog başlığı değil)"
            value={sellerNote}
            onChange={(e) => setSellerNote(e.target.value)}
          />
          <button
            type="button"
            className="btn-orange"
            disabled={busy || !variantId || !priceTl}
            onClick={submitOffer}
          >
            SellerOffer oluştur
          </button>
        </>
      ) : null}

      <div style={{ borderTop: "1px solid var(--line)", paddingTop: 12, display: "grid", gap: 8 }}>
        <strong>Katalogda yok mu?</strong>
        <input
          className="msf-input"
          placeholder="Önerilen kanonik ad"
          value={requestName}
          onChange={(e) => setRequestName(e.target.value)}
        />
        {similar.length ? (
          <div style={{ fontSize: 13 }}>
            Benzer ürünler:
            <ul>
              {similar.map((s) => (
                <li key={s.id}>
                  <button type="button" onClick={() => setProductId(s.id)}>
                    {s.name}
                  </button>
                </li>
              ))}
            </ul>
            <button type="button" disabled={busy} onClick={() => submitRequest(true)}>
              Yine de talep gönder
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled={busy || !(requestName || q) || !categoryId}
            onClick={() => submitRequest(false)}
          >
            Yeni ürün talebi aç (admin onayı)
          </button>
        )}
      </div>

      {msg ? <p style={{ margin: 0, color: "var(--muted)", fontSize: 13 }}>{msg}</p> : null}
    </div>
  );
}
