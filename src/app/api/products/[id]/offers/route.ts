import { NextResponse } from "next/server";
import { listOffersForProduct } from "@/core/services/catalog/catalogCommerceService";
import { minorToTl } from "@/lib/catalogCommerce";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/products/:id/offers?variantId= */
export async function GET(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const variantId = new URL(req.url).searchParams.get("variantId") || undefined;
  const offers = await listOffersForProduct(id, variantId || undefined);
  return NextResponse.json({
    ok: true,
    offers: offers.map((o) => ({
      id: o.id,
      price: minorToTl(o.price),
      discountedPrice: o.discountedPrice != null ? minorToTl(o.discountedPrice) : null,
      effectivePrice: minorToTl(o.discountedPrice != null && o.discountedPrice < o.price ? o.discountedPrice : o.price),
      stockQty: o.stockQty,
      shippingTimeDays: o.shippingTimeDays,
      shippingPrice: o.shippingPrice != null ? minorToTl(o.shippingPrice) : null,
      warrantyType: o.warrantyType,
      warrantyMonths: o.warrantyMonths,
      invoiceAvailable: o.invoiceAvailable,
      condition: o.condition,
      shop: o.shop,
      seller: o.seller,
      variant: o.variant,
      listingId: o.listingId,
    })),
  });
}
