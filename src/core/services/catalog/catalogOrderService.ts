import {
  EscrowStatus,
  PaymentStatus,
  Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  CatalogCommerceError,
  effectiveOfferPriceMinor,
  assertValidOfferPrices,
  minorToTl,
} from "@/lib/catalogCommerce";
import { syncListingMirrorFromOffer, buildCategoryPathSnapshot } from "@/core/services/catalog/sellerOfferSyncService";
import { assertEscrowModuleAvailable } from "@/core/services/escrowService";
import { isDemoPosEnabled } from "@/core/services/paymentModeService";
import { getEscrowRuntimeSettings } from "@/core/services/escrowSettingsService";
import { isValidShipDays } from "@/lib/escrowTypes";
import { writeAuditLog } from "@/core/services/tenantService";
import {
  getCatalogCheckoutPendingTtlMinutes,
  isCatalogCheckoutIdempotencyEnabled,
  isCatalogExpiredReconcileEnabled,
} from "@/core/services/catalog/catalogOrderLifecycleService";
import { reconcileExpiredCatalogOrders } from "@/core/services/catalog/catalogOrderReconcileService";

type Buyer = { id: string; name?: string | null };

async function generateOrderNo(tx: Prisma.TransactionClient): Promise<string> {
  for (let attempt = 0; attempt < 24; attempt++) {
    let no = "ORD";
    for (let i = 0; i < 12; i++) no += String(Math.floor(Math.random() * 10));
    const exists = await tx.order.findUnique({ where: { orderNo: no }, select: { id: true } });
    if (!exists) return no;
  }
  throw new CatalogCommerceError("ORDER_NO", "Sipariş numarası üretilemedi");
}

function asJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export type CheckoutCatalogResult = {
  order: {
    id: string;
    orderNo: string;
    status: string;
    escrowDealId: string | null;
    paymentId?: string | null;
  };
  item: { id: string };
  deal: { id: string };
  payment: { id: string };
  payUrl: string;
  amountTl: number;
  /** Effective unit price in kuruş */
  effectiveUnitPriceMinor: bigint;
  /** alias */
  priceKurus: bigint;
  amountKurus: bigint;
  stockQtyAfter: number;
  idempotentReplay?: boolean;
};

/**
 * Katalog checkout: 1 Order = 1 SellerOffer = 1 OrderItem + zorunlu EscrowDeal.
 * Fiyat kaynağı yalnız SellerOffer (Listing.askPrice okunmaz).
 */
export async function checkoutCatalogOffer(input: {
  buyer: Buyer;
  sellerOfferId: string;
  quantity: number;
  shipDays: number;
  /** Opsiyonel: client önizleme fiyatı (kuruş) — uyuşmazsa PRICE_CHANGED */
  expectedEffectiveUnitPriceMinor?: bigint | null;
  /** Client idempotency key */
  idempotencyKey?: string | null;
}): Promise<CheckoutCatalogResult> {
  const quantity = Math.floor(Number(input.quantity));
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new CatalogCommerceError("INVALID_QUANTITY", "Adet pozitif tam sayı olmalı");
  }

  const avail = await assertEscrowModuleAvailable();
  if (!avail.allowed) {
    throw new CatalogCommerceError(avail.code || "ESCROW_DISABLED", avail.error);
  }
  const settings = await getEscrowRuntimeSettings();
  const demoEnabled = await isDemoPosEnabled();
  if (!demoEnabled) {
    throw new CatalogCommerceError("DEMO_POS_DISABLED", "Demo POS kapalı");
  }

  const shipDays = Math.floor(Number(input.shipDays));
  if (!isValidShipDays(shipDays, settings.shipDaysOptions)) {
    throw new CatalogCommerceError(
      "INVALID_SHIP_DAYS",
      `Kargo süresi şu seçeneklerden biri olmalı: ${settings.shipDaysOptions.join(", ")} gün`
    );
  }

  // Opportunistic reconcile (best-effort)
  if (await isCatalogExpiredReconcileEnabled()) {
    try {
      await reconcileExpiredCatalogOrders({ limit: 5 });
    } catch {
      /* ignore */
    }
  }

  const idempotencyOn = await isCatalogCheckoutIdempotencyEnabled();
  const idempotencyKey =
    idempotencyOn && input.idempotencyKey
      ? String(input.idempotencyKey).trim().slice(0, 120) || null
      : null;

  if (idempotencyKey) {
    const existing = await prisma.order.findFirst({
      where: { buyerId: input.buyer.id, idempotencyKey },
      include: {
        items: { take: 1 },
        escrowDeal: true,
      },
    });
    if (existing) {
      const deal = existing.escrowDeal;
      const paymentId =
        existing.paymentId ||
        deal?.paymentId ||
        (deal?.meta && typeof deal.meta === "object"
          ? String((deal.meta as Record<string, unknown>).paymentId || "")
          : "") ||
        null;
      let payment = paymentId
        ? await prisma.payment.findUnique({ where: { id: paymentId } })
        : null;
      if (!payment && deal?.id) {
        payment = await prisma.payment.findFirst({
          where: {
            purpose: "escrow_hold",
            meta: { path: ["orderId"], equals: existing.id },
          },
        });
      }
      const item = existing.items[0];
      const unit = item?.effectiveUnitPriceSnapshot ?? BigInt(0);
      return {
        order: {
          id: existing.id,
          orderNo: existing.orderNo,
          status: existing.status,
          escrowDealId: existing.escrowDealId,
          paymentId: payment?.id || existing.paymentId,
        },
        item: { id: item?.id || "" },
        deal: { id: deal?.id || "" },
        payment: { id: payment?.id || "" },
        payUrl: payment ? `/odeme/demo-pos?intent=${payment.id}` : "",
        amountTl: Math.round(minorToTl(existing.grandTotal)),
        effectiveUnitPriceMinor: unit,
        priceKurus: unit,
        amountKurus: existing.grandTotal,
        stockQtyAfter: 0,
        idempotentReplay: true,
      };
    }
  }

  const ttlMin = await getCatalogCheckoutPendingTtlMinutes();
  const reconcileOn = await isCatalogExpiredReconcileEnabled();
  const expiresAt = reconcileOn
    ? new Date(Date.now() + ttlMin * 60 * 1000)
    : null;

  return prisma.$transaction(async (tx) => {
    // Re-check idempotency inside tx
    if (idempotencyKey) {
      const again = await tx.order.findFirst({
        where: { buyerId: input.buyer.id, idempotencyKey },
        select: { id: true },
      });
      if (again) {
        throw new CatalogCommerceError("IDEMPOTENCY_RACE", "Tekrar deneyin");
      }
    }

    const offer = await tx.sellerOffer.findFirst({
      where: { id: input.sellerOfferId, deletedAt: null },
      include: {
        product: { include: { brand: true, model: true, category: true } },
        variant: true,
        shop: true,
        seller: { select: { id: true, name: true, iban: true } },
        listing: true,
      },
    });
    if (!offer) throw new CatalogCommerceError("OFFER_NOT_FOUND", "Teklif bulunamadı");
    if (offer.status !== "ACTIVE") {
      throw new CatalogCommerceError("OFFER_NOT_ACTIVE", "Teklif satın alınabilir değil");
    }
    if (offer.product.deletedAt || offer.product.status !== "ACTIVE") {
      throw new CatalogCommerceError("PRODUCT_INACTIVE", "Ürün aktif değil");
    }
    if (offer.variant.deletedAt || !offer.variant.isActive) {
      throw new CatalogCommerceError("VARIANT_INACTIVE", "Varyant aktif değil");
    }
    if (offer.sellerId === input.buyer.id) {
      throw new CatalogCommerceError("SELF_PURCHASE", "Kendi teklifinizi satın alamazsınız");
    }
    if (!offer.listingId || !offer.listing) {
      throw new CatalogCommerceError("LISTING_MIRROR_MISSING", "Vitrin ilanı yok");
    }

    // Fiyat yalnız SellerOffer (Listing.askPrice kullanılmaz)
    try {
      assertValidOfferPrices(offer.price, offer.discountedPrice);
    } catch (e) {
      const err = e as Error & { code?: string };
      throw new CatalogCommerceError(err.code || "INVALID_PRICE", err.message);
    }
    const unit = effectiveOfferPriceMinor(offer.price, offer.discountedPrice);
    if (
      input.expectedEffectiveUnitPriceMinor != null &&
      input.expectedEffectiveUnitPriceMinor !== unit
    ) {
      throw new CatalogCommerceError("PRICE_CHANGED", "Fiyat değişti; lütfen yenileyin");
    }

    const stockResult = await tx.$executeRaw`
      UPDATE "SellerOffer"
      SET
        "stockQty" = "stockQty" - ${quantity},
        "status" = CASE
          WHEN "stockQty" - ${quantity} = 0 THEN 'SOLD_OUT'::"SellerOfferStatus"
          ELSE "status"
        END,
        "updatedAt" = NOW()
      WHERE "id" = ${offer.id}
        AND "deletedAt" IS NULL
        AND "status" = 'ACTIVE'
        AND "stockQty" >= ${quantity}
    `;
    if (Number(stockResult) === 0) {
      throw new CatalogCommerceError("INSUFFICIENT_STOCK", "Yetersiz stok");
    }

    const fresh = await tx.sellerOffer.findUnique({ where: { id: offer.id } });
    if (!fresh) throw new CatalogCommerceError("OFFER_NOT_FOUND", "Teklif kayboldu");

    const shippingKurus =
      fresh.shippingPrice != null && fresh.shippingPrice > BigInt(0) ? fresh.shippingPrice : BigInt(0);
    const lineSubtotal = unit * BigInt(quantity);
    const lineShipping = shippingKurus;
    const lineTax = BigInt(0);
    const amountKurus = lineSubtotal + lineShipping + lineTax;
    const discountTotal =
      fresh.discountedPrice != null && fresh.discountedPrice < fresh.price
        ? (fresh.price - fresh.discountedPrice) * BigInt(quantity)
        : BigInt(0);

    const amountTl = Math.round(minorToTl(amountKurus));
    if (!Number.isFinite(amountTl) || amountTl <= 0) {
      throw new CatalogCommerceError("INVALID_AMOUNT", "Sipariş tutarı geçersiz");
    }
    if (settings.minAmountTl > 0 && amountTl < settings.minAmountTl) {
      throw new CatalogCommerceError("AMOUNT_TOO_LOW", `Minimum tutar ${settings.minAmountTl} TL`);
    }
    if (settings.maxAmountTl > 0 && amountTl > settings.maxAmountTl) {
      throw new CatalogCommerceError("AMOUNT_TOO_HIGH", `Maksimum tutar ${settings.maxAmountTl} TL`);
    }

    const commissionTl = Math.round((amountTl * settings.commissionPercent) / 100);
    const sellerPayoutTl = amountTl - commissionTl;

    const orderNo = await generateOrderNo(tx);
    const categoryPath = await buildCategoryPathSnapshot(offer.product.categoryId);
    const barcode = offer.variant.barcode || offer.product.barcode || null;

    const order = await tx.order.create({
      data: {
        orderNo,
        buyerId: input.buyer.id,
        status: "PENDING_PAYMENT",
        currency: "TRY",
        subtotal: lineSubtotal,
        shippingTotal: lineShipping,
        discountTotal,
        taxTotal: lineTax,
        grandTotal: amountKurus,
        idempotencyKey: idempotencyKey || undefined,
        expiresAt: expiresAt || undefined,
      },
    });

    const item = await tx.orderItem.create({
      data: {
        orderId: order.id,
        productId: offer.productId,
        variantId: offer.variantId,
        sellerOfferId: offer.id,
        listingId: offer.listingId,
        shopId: offer.shopId,
        sellerId: offer.sellerId,
        productNameSnapshot: offer.product.name,
        variantTitleSnapshot: offer.variant.title,
        sellerNameSnapshot: offer.seller.name || "Satıcı",
        shopNameSnapshot: offer.shop.name,
        sellerSkuSnapshot: fresh.sellerSku,
        productImageSnapshot: offer.product.mainImage,
        barcodeSnapshot: barcode,
        categoryPathSnapshot: categoryPath,
        invoiceAvailableSnapshot: fresh.invoiceAvailable,
        conditionSnapshot: fresh.condition,
        unitPriceSnapshot: fresh.price,
        discountedPriceSnapshot: fresh.discountedPrice,
        effectiveUnitPriceSnapshot: unit,
        shippingPriceSnapshot: shippingKurus,
        warrantyTypeSnapshot: fresh.warrantyType,
        warrantyMonthsSnapshot: fresh.warrantyMonths,
        taxRateSnapshot: null,
        quantity,
        stockReservedQty: quantity,
        lineSubtotal,
        lineShipping,
        lineTax,
        lineTotal: amountKurus,
      },
    });

    const deal = await tx.escrowDeal.create({
      data: {
        listingId: offer.listingId,
        buyerId: input.buyer.id,
        sellerId: offer.sellerId,
        amountTl,
        commissionTl,
        sellerPayoutTl,
        shipDays,
        status: EscrowStatus.AWAITING_PAYMENT,
        sellerIbanSnapshot: offer.seller.iban || null,
        meta: asJson({
          catalogCheckout: true,
          orderId: order.id,
          orderItemId: item.id,
          sellerOfferId: offer.id,
          quantity,
          amountKurus: amountKurus.toString(),
          priceKurus: unit.toString(),
          shippingKurus: shippingKurus.toString(),
        }),
      },
    });

    const payment = await tx.payment.create({
      data: {
        userId: input.buyer.id,
        amountTl,
        purpose: "escrow_hold",
        status: PaymentStatus.PENDING,
        meta: asJson({
          kind: "escrow",
          channel: "demo_pos",
          escrowDealId: deal.id,
          listingId: offer.listingId,
          orderId: order.id,
          shipDays,
          catalogCheckout: true,
          amountKurus: amountKurus.toString(),
        }),
      },
    });

    await tx.escrowDeal.update({
      where: { id: deal.id },
      data: { paymentId: payment.id },
    });

    await tx.order.update({
      where: { id: order.id },
      data: { escrowDealId: deal.id, paymentId: payment.id },
    });

    await syncListingMirrorFromOffer(tx, offer.id);

    await writeAuditLog({
      actorId: input.buyer.id,
      action: "catalog.checkout.create",
      entity: "Order",
      entityId: order.id,
      meta: { dealId: deal.id, offerId: offer.id, quantity, amountTl, amountKurus: amountKurus.toString() },
    });

    return {
      order: { ...order, escrowDealId: deal.id, paymentId: payment.id },
      item,
      deal,
      payment,
      payUrl: `/odeme/demo-pos?intent=${payment.id}`,
      amountTl,
      effectiveUnitPriceMinor: unit,
      priceKurus: unit,
      amountKurus,
      stockQtyAfter: fresh.stockQty,
      idempotentReplay: false,
    };
  });
}
