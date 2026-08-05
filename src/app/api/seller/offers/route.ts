import { getSession } from "@/lib/auth";
import { createSellerOffer, findActiveOffer } from "@/core/services/catalog/catalogCommerceService";
import { prisma } from "@/lib/db";
import { minorToTl } from "@/lib/catalogCommerce";
import { NextResponse } from "next/server";

/** POST /api/seller/offers */
export async function POST(req: Request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Giriş gerekli" }, { status: 401 });
  const body = await req.json().catch(() => ({}));

  const shopId = String(body.shopId || "").trim();
  const shop = shopId
    ? await prisma.shop.findFirst({ where: { id: shopId, ownerId: user.id } })
    : await prisma.shop.findFirst({ where: { ownerId: user.id } });
  if (!shop) return NextResponse.json({ error: "Mağaza gerekli" }, { status: 400 });

  const variantId = String(body.variantId || "");
  const existing = await findActiveOffer(shop.id, variantId);
  if (existing) {
    return NextResponse.json(
      {
        error: "Bu varyant için aktif teklifiniz var",
        code: "ACTIVE_OFFER_EXISTS",
        offerId: existing.id,
      },
      { status: 409 }
    );
  }

  try {
    const offer = await createSellerOffer({
      sellerId: user.id,
      shopId: shop.id,
      productId: String(body.productId || ""),
      variantId,
      priceTl: Number(body.priceTl ?? body.price),
      discountedPriceTl: body.discountedPriceTl ?? body.discountedPrice ?? null,
      stockQty: Number(body.stockQty ?? 0),
      shippingTimeDays: body.shippingTimeDays ?? null,
      shippingPriceTl: body.shippingPriceTl ?? body.shippingPrice ?? null,
      warrantyType: body.warrantyType ?? null,
      warrantyMonths: body.warrantyMonths ?? null,
      invoiceAvailable: Boolean(body.invoiceAvailable),
      condition: body.condition ?? null,
      sellerSku: body.sellerSku ?? null,
      sellerNote: body.sellerNote ?? body.description ?? null,
      city: body.city,
      district: body.district,
      // Aşama 4: default OFF — mirror yalnız açıkça true ise
      createListingMirror: body.createListingMirror === true,
    });
    return NextResponse.json({
      ok: true,
      offer: {
        id: offer.id,
        listingId: offer.listingId,
        status: offer.status,
        price: minorToTl(offer.price),
        stockQty: offer.stockQty,
      },
    });
  } catch (e) {
    const { VerticalAccessError } = await import("@/core/guards/verticalAccessGuard");
    if (e instanceof VerticalAccessError) {
      return NextResponse.json(e.toJSON(), { status: e.status });
    }
    const err = e as Error & { offerId?: string; code?: string; status?: number };
    if (err.message === "ACTIVE_OFFER_EXISTS") {
      return NextResponse.json(
        { error: "Aktif teklif var", code: "ACTIVE_OFFER_EXISTS", offerId: err.offerId },
        { status: 409 }
      );
    }
    if (err.code && (err.status === 403 || String(err.code).includes("PACKAGE") || String(err.code).includes("LIMIT"))) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.status || 403 });
    }
    return NextResponse.json({ error: err.message || "Teklif oluşturulamadı" }, { status: 400 });
  }
}

/** GET /api/seller/offers — kendi tekliflerim */
export async function GET() {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Giriş gerekli" }, { status: 401 });
  const offers = await prisma.sellerOffer.findMany({
    where: { sellerId: user.id, deletedAt: null },
    orderBy: { updatedAt: "desc" },
    take: 100,
    include: {
      product: { select: { id: true, name: true } },
      variant: { select: { id: true, title: true } },
      shop: { select: { id: true, name: true } },
    },
  });
  return NextResponse.json({
    ok: true,
    offers: offers.map((o) => ({
      ...o,
      price: minorToTl(o.price),
      discountedPrice: o.discountedPrice != null ? minorToTl(o.discountedPrice) : null,
      shippingPrice: o.shippingPrice != null ? minorToTl(o.shippingPrice) : null,
    })),
  });
}
