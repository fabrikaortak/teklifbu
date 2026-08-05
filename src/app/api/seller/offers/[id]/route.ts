import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { updateSellerOffer } from "@/core/services/catalog/catalogCommerceService";
import { minorToTl } from "@/lib/catalogCommerce";

type Ctx = { params: Promise<{ id: string }> };

/** PATCH /api/seller/offers/:id */
export async function PATCH(req: Request, ctx: Ctx) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Giriş gerekli" }, { status: 401 });
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  try {
    const offer = await updateSellerOffer(id, user.id, {
      priceTl: body.priceTl ?? body.price,
      discountedPriceTl: body.discountedPriceTl ?? body.discountedPrice,
      stockQty: body.stockQty,
      shippingTimeDays: body.shippingTimeDays,
      shippingPriceTl: body.shippingPriceTl ?? body.shippingPrice,
      warrantyType: body.warrantyType,
      warrantyMonths: body.warrantyMonths,
      invoiceAvailable: body.invoiceAvailable,
      condition: body.condition,
      sellerSku: body.sellerSku,
      sellerNote: body.sellerNote,
      status: body.status,
    });
    return NextResponse.json({
      ok: true,
      offer: {
        id: offer.id,
        status: offer.status,
        price: minorToTl(offer.price),
        stockQty: offer.stockQty,
      },
    });
  } catch (e) {
    const err = e as Error & { code?: string };
    const status = err.code === "FORBIDDEN_STATUS" ? 403 : 400;
    return NextResponse.json({ error: err.message || "Güncellenemedi", code: err.code }, { status });
  }
}
