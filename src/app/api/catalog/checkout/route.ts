import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { checkoutCatalogOffer } from "@/core/services/catalog/catalogOrderService";
import { CatalogCommerceError, tlToMinor, minorToTl } from "@/lib/catalogCommerce";

/**
 * POST /api/catalog/checkout
 * Body: { sellerOfferId, quantity, shipDays, expectedPriceTl? }
 * 1 Order = 1 Offer = 1 Item + EscrowDeal
 */
export async function POST(req: Request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Giriş gerekli" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  if (Array.isArray(body.items) || body.sellerOfferIds) {
    return NextResponse.json(
      { error: "Bu fazda tek ürün checkout desteklenir", code: "MULTI_ITEM_UNSUPPORTED" },
      { status: 400 }
    );
  }

  const expectedTl = body.expectedPriceTl ?? body.expectedEffectivePriceTl;
  try {
    const result = await checkoutCatalogOffer({
      buyer: { id: user.id, name: user.name },
      sellerOfferId: String(body.sellerOfferId || ""),
      quantity: Number(body.quantity ?? 1),
      shipDays: Number(body.shipDays ?? 7),
      expectedEffectiveUnitPriceMinor:
        expectedTl != null && expectedTl !== "" ? tlToMinor(Number(expectedTl)) : null,
    });
    return NextResponse.json({
      ok: true,
      orderId: result.order.id,
      orderNo: result.order.orderNo,
      orderItemId: result.item.id,
      dealId: result.deal.id,
      payUrl: result.payUrl,
      amountTl: result.amountTl,
      effectiveUnitPrice: minorToTl(result.effectiveUnitPriceMinor),
      stockQtyAfter: result.stockQtyAfter,
    });
  } catch (e) {
    if (e instanceof CatalogCommerceError) {
      const status =
        e.code === "INSUFFICIENT_STOCK" || e.code === "PRICE_CHANGED"
          ? 409
          : e.code === "SELF_PURCHASE"
            ? 403
            : 400;
      return NextResponse.json({ error: e.message, code: e.code }, { status });
    }
    const msg = e instanceof Error ? e.message : "Checkout başarısız";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
