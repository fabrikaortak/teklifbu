"use client";

import { Suspense, use, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ShoppingProductDetail,
  type ShoppingPdpListing,
} from "@/components/shopping/ShoppingProductDetail";
import { catalogCartListingId } from "@/lib/cartItemHref";
import { useCart } from "@/components/cart/CartProvider";

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
  barcode?: string | null;
  brand?: { name: string } | null;
  model?: { name: string } | null;
  categoryPath?: Array<{ id: string; name: string; slug: string }>;
  variants?: Variant[];
};

function buildPdpListing(product: Product, offer: Offer | null): ShoppingPdpListing {
  const askPrice = offer?.effectivePrice ?? 0;
  const listPrice =
    offer && offer.discountedPrice != null && offer.discountedPrice < offer.price
      ? offer.price
      : undefined;
  const shipDays = offer?.shippingTimeDays;
  const freeShip = offer?.shippingPrice === 0 || offer?.shippingPrice == null;
  const warranty =
    offer?.warrantyType ||
    (offer?.warrantyMonths != null ? `${offer.warrantyMonths} ay` : "");

  return {
    id: product.id,
    title: product.name,
    description: product.description || "",
    askPrice,
    coverImage: product.mainImage,
    images: product.mainImage ? [product.mainImage] : [],
    attributes: {
      brand: product.brand?.name || "",
      model: product.model?.name || "",
      condition: offer?.condition || "",
      warranty,
      sku: offer?.variant?.sku || "",
      barcode: product.barcode || "",
      listPrice: listPrice != null ? listPrice : "",
      stockQty: offer?.stockQty ?? 0,
      shippingFree: freeShip ? "Evet" : "Hayır",
      shippingLabel:
        shipDays != null
          ? shipDays <= 1
            ? "Aynı / ertesi gün kargo"
            : `${shipDays} gün içinde kargo`
          : "Hızlı kargo",
      sameDayShipping: shipDays != null && shipDays <= 1 ? "Evet" : "Hayır",
      returnDays: 14,
      highlights: [
        product.brand?.name ? `Marka: ${product.brand.name}` : "",
        offer?.condition ? `Durum: ${offer.condition}` : "",
        warranty ? `Garanti: ${warranty}` : "",
        offer?.invoiceAvailable ? "Fatura kesilir" : "",
      ].filter(Boolean),
    },
    seller: {
      id: offer?.seller?.id || offer?.shop?.id || "catalog",
      name: offer?.seller?.name || null,
      shopId: offer?.shop?.id || null,
      shopName: offer?.shop?.name || null,
      isCommercial: Boolean(offer?.shop),
      avgRating: 4.8,
      reviewCount: 0,
      isPremiumSeller: false,
    },
    escrowAvailable: Boolean(offer),
    escrowSettings: { buttonLabel: "Hemen Al" },
  };
}

function ProductDetailInner({ id }: { id: string }) {
  const router = useRouter();
  const { addItem } = useCart();
  const [product, setProduct] = useState<Product | null>(null);
  const [variantId, setVariantId] = useState("");
  const [offers, setOffers] = useState<Offer[]>([]);
  const [selectedOfferId, setSelectedOfferId] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const [buyBusy, setBuyBusy] = useState(false);
  const [buyError, setBuyError] = useState("");
  const [favorited, setFavorited] = useState(false);

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
      setSelectedOfferId(null);
      return;
    }
    let cancelled = false;
    fetch(`/api/products/${id}/offers?variantId=${encodeURIComponent(variantId)}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        const list: Offer[] = d.offers || [];
        setOffers(list);
        setSelectedOfferId(list[0]?.id || null);
      })
      .catch(() => {
        if (!cancelled) {
          setOffers([]);
          setSelectedOfferId(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [id, variantId]);

  const selected = useMemo(
    () => offers.find((o) => o.id === selectedOfferId) || offers[0] || null,
    [offers, selectedOfferId]
  );

  const listing = useMemo(
    () => (product ? buildPdpListing(product, selected) : null),
    [product, selected]
  );

  const crumbs = useMemo(() => {
    const path = product?.categoryPath || [];
    return [
      { label: "Alışveriş", href: "/alisveris" },
      ...path.map((c) => ({ label: c.name, href: `/alisveris?cat=${encodeURIComponent(c.slug)}` })),
    ];
  }, [product]);

  const specs = useMemo(() => {
    if (!product) return [];
    const rows: Array<{ label: string; value: string }> = [];
    if (product.brand?.name) rows.push({ label: "Marka", value: product.brand.name });
    if (product.model?.name) rows.push({ label: "Model", value: product.model.name });
    const v = (product.variants || []).find((x) => x.id === variantId);
    if (v) {
      rows.push({ label: "Varyant", value: v.title });
      for (const val of v.values || []) {
        const label = val.attribute?.name;
        const value = val.option?.label || val.textValue || "";
        if (label && value) rows.push({ label, value });
      }
      if (v.sku) rows.push({ label: "SKU", value: v.sku });
    }
    if (product.barcode) rows.push({ label: "Barkod", value: product.barcode });
    if (selected?.condition) rows.push({ label: "Durum", value: selected.condition });
    if (selected?.warrantyType || selected?.warrantyMonths != null) {
      rows.push({
        label: "Garanti",
        value:
          selected.warrantyType ||
          (selected.warrantyMonths != null ? `${selected.warrantyMonths} ay` : ""),
      });
    }
    if (selected?.invoiceAvailable) rows.push({ label: "Fatura", value: "Kesilir" });
    return rows;
  }, [product, variantId, selected]);

  const otherSellers = useMemo(
    () =>
      offers
        .filter((o) => o.id !== selected?.id)
        .map((o) => ({
          id: o.id,
          name: o.shop?.name || o.seller?.name || "Satıcı",
          price: o.effectivePrice,
          freeShip: o.shippingPrice === 0 || o.shippingPrice == null,
          score: "9,0",
        })),
    [offers, selected?.id]
  );

  const handleBuy = useCallback(async () => {
    if (!selected) return;
    setBuyBusy(true);
    setBuyError("");
    try {
      const res = await fetch("/api/catalog/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sellerOfferId: selected.id,
          quantity: 1,
          shipDays: selected.shippingTimeDays || 7,
          expectedPriceTl: selected.effectivePrice,
          idempotencyKey: `urun-${selected.id}-${Date.now()}`,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        router.push(`/giris?next=${encodeURIComponent(`/urun/${id}`)}`);
        return;
      }
      if (!res.ok) {
        setBuyError(data.error || data.code || "Checkout başarısız");
        return;
      }
      if (data.payUrl) {
        window.location.assign(data.payUrl);
        return;
      }
      setBuyError("Ödeme bağlantısı alınamadı");
    } catch (e) {
      setBuyError(e instanceof Error ? e.message : "Hata");
    } finally {
      setBuyBusy(false);
    }
  }, [selected, router, id]);

  const handleShare = useCallback(async () => {
    const url = typeof window !== "undefined" ? window.location.href : `/urun/${id}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: product?.name || "Ürün", url });
        return;
      }
      await navigator.clipboard.writeText(url);
    } catch {
      /* ignore */
    }
  }, [id, product?.name]);

  if (err) {
    return (
      <div style={{ maxWidth: 960, margin: "40px auto", padding: 16 }}>
        <p>{err}</p>
        <Link href="/alisveris">Alışverişe dön</Link>
      </div>
    );
  }

  if (!product || !listing) {
    return <div style={{ padding: 40 }}>Yükleniyor…</div>;
  }

  const noOffer = !selected;

  return (
    <ShoppingProductDetail
      listing={listing}
      crumbs={crumbs}
      specs={specs}
      favorited={favorited}
      isSeller={false}
      onFavorite={() => setFavorited((f) => !f)}
      onShare={handleShare}
      onBuy={handleBuy}
      buyDisabled={noOffer || buyBusy || (selected?.stockQty ?? 0) <= 0}
      offerDisabled
      buyLabel={buyBusy ? "Ödemeye yönlendiriliyor…" : noOffer ? "Teklif yok" : "Hemen Al"}
      questionsEnabled={false}
      otherSellersList={otherSellers}
      onSelectOtherSeller={(offerId) => setSelectedOfferId(offerId)}
      onAddCart={() => {
        if (!selected) return;
        addItem({
          listingId: catalogCartListingId(product.id),
          title: product.name,
          price: selected.effectivePrice,
          image: product.mainImage || null,
        });
      }}
      aboveActions={
        (product.variants || []).length > 1 ? (
          <div className="shop-pdp__variant">
            <label className="shop-pdp__variant-label" htmlFor="catalog-variant">
              Varyant
            </label>
            <select
              id="catalog-variant"
              className="msf-select"
              value={variantId}
              onChange={(e) => setVariantId(e.target.value)}
            >
              {(product.variants || []).map((v) => (
                <option key={v.id} value={v.id}>
                  {v.title}
                </option>
              ))}
            </select>
          </div>
        ) : null
      }
      afterActions={
        buyError ? (
          <div style={{ fontSize: 13, color: "#dc2626", marginTop: 8 }}>{buyError}</div>
        ) : noOffer ? (
          <div style={{ fontSize: 13, color: "#64748b", marginTop: 8 }}>
            Bu varyant için aktif ve stoklu satıcı teklifi yok.
          </div>
        ) : null
      }
    />
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
