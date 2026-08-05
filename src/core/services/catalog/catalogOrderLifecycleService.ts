/**
 * Katalog Order ödeme yaşam döngüsü (Faz 1).
 * Flag: catalog_order_payment_lifecycle_v2
 */
import {
  EscrowStatus,
  OrderStatus,
  PaymentStatus,
  Prisma,
  SellerOfferStatus,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSetting } from "@/core/settings";
import { writeAuditLog } from "@/core/services/tenantService";

function asJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export async function isCatalogLifecycleV2Enabled(): Promise<boolean> {
  return (await getSetting<boolean>("catalog_order_payment_lifecycle_v2", true)) !== false;
}

export async function isCatalogCheckoutIdempotencyEnabled(): Promise<boolean> {
  return (await getSetting<boolean>("catalog_checkout_idempotency", true)) !== false;
}

export async function isCatalogExpiredReconcileEnabled(): Promise<boolean> {
  return (await getSetting<boolean>("catalog_expired_order_reconcile", true)) !== false;
}

export async function getCatalogCheckoutPendingTtlMinutes(): Promise<number> {
  const n = Number(await getSetting<number>("catalog_checkout_pending_ttl_minutes", 15));
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 15;
}

/**
 * Escrow fund ile aynı tx içinde Order → PAID.
 * Conditional: yalnız PENDING_PAYMENT.
 */
export async function markOrderPaidInTx(
  tx: Prisma.TransactionClient,
  opts: { orderId: string | null | undefined; paymentId: string; now?: Date }
) {
  if (!opts.orderId) return { updated: false as const };
  const now = opts.now || new Date();
  const result = await tx.order.updateMany({
    where: { id: opts.orderId, status: OrderStatus.PENDING_PAYMENT },
    data: {
      status: OrderStatus.PAID,
      paidAt: now,
      paymentId: opts.paymentId,
    },
  });
  return { updated: result.count > 0 };
}

/**
 * Stok iadesi — OrderItem.stockReleasedAt ile tek seferlik.
 * REJECTED/PAUSED/ARCHIVED → ACTIVE yapılmaz.
 */
export async function releaseReservedStockInTx(
  tx: Prisma.TransactionClient,
  orderId: string
): Promise<{ releasedItems: number }> {
  const items = await tx.orderItem.findMany({
    where: { orderId, stockReleasedAt: null },
  });
  let releasedItems = 0;
  const now = new Date();

  for (const item of items) {
    const qty = item.stockReservedQty != null ? item.stockReservedQty : item.quantity;
    if (qty <= 0) {
      await tx.orderItem.update({
        where: { id: item.id },
        data: { stockReleasedAt: now },
      });
      releasedItems += 1;
      continue;
    }

    // Conditional release: only if still null
    const marked = await tx.orderItem.updateMany({
      where: { id: item.id, stockReleasedAt: null },
      data: { stockReleasedAt: now },
    });
    if (marked.count === 0) continue;

    await tx.$executeRaw`
      UPDATE "SellerOffer"
      SET
        "stockQty" = "stockQty" + ${qty},
        "status" = CASE
          WHEN "status" = 'SOLD_OUT'::"SellerOfferStatus"
            AND "approvedAt" IS NOT NULL
            AND "stockQty" + ${qty} > 0
          THEN 'ACTIVE'::"SellerOfferStatus"
          ELSE "status"
        END,
        "updatedAt" = NOW()
      WHERE "id" = ${item.sellerOfferId}
        AND "deletedAt" IS NULL
    `;
    releasedItems += 1;
  }

  return { releasedItems };
}

/**
 * Tek PENDING_PAYMENT order iptali (timeout / reconcile).
 * PAID order asla iptal edilmez. Row lock + conditional updates.
 */
export async function cancelExpiredCatalogOrder(
  orderId: string,
  attempt = 0
): Promise<{
  ok: boolean;
  reason: string;
  orderId: string;
}> {
  try {
    return await prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<Array<{ id: string; status: string }>>`
      SELECT id, status::text AS status
      FROM "Order"
      WHERE id = ${orderId}
      FOR UPDATE
    `;
    const row = rows[0];
    if (!row) return { ok: false, reason: "NOT_FOUND", orderId };

    if (row.status === OrderStatus.PAID || row.status === "PAID") {
      return { ok: false, reason: "ALREADY_PAID", orderId };
    }
    if (row.status !== OrderStatus.PENDING_PAYMENT && row.status !== "PENDING_PAYMENT") {
      return { ok: false, reason: "NOT_PENDING", orderId };
    }

    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!order) return { ok: false, reason: "NOT_FOUND", orderId };

    if (order.expiresAt && order.expiresAt > new Date()) {
      return { ok: false, reason: "NOT_EXPIRED", orderId };
    }

    // Lock Payment then EscrowDeal (consistent order with completeEscrowPayment: Order→Payment→Deal)
    const paymentIds: string[] = [];
    if (order.paymentId) paymentIds.push(order.paymentId);
    if (order.escrowDealId) {
      const dealPeek = await tx.escrowDeal.findUnique({
        where: { id: order.escrowDealId },
        select: { paymentId: true },
      });
      if (dealPeek?.paymentId && !paymentIds.includes(dealPeek.paymentId)) {
        paymentIds.push(dealPeek.paymentId);
      }
    }
    for (const pid of paymentIds) {
      await tx.$queryRaw`SELECT id FROM "Payment" WHERE id = ${pid} FOR UPDATE`;
      const pay = await tx.payment.findUnique({ where: { id: pid } });
      if (pay?.status === PaymentStatus.PAID) {
        return { ok: false, reason: "PAYMENT_PAID", orderId };
      }
    }
    if (order.escrowDealId) {
      await tx.$queryRaw`SELECT id FROM "EscrowDeal" WHERE id = ${order.escrowDealId} FOR UPDATE`;
    }

    const now = new Date();
    const cancelled = await tx.order.updateMany({
      where: { id: orderId, status: OrderStatus.PENDING_PAYMENT },
      data: {
        status: OrderStatus.CANCELLED,
        cancelledAt: now,
      },
    });
    if (cancelled.count === 0) {
      return { ok: false, reason: "RACE_LOST", orderId };
    }

    if (order.escrowDealId) {
      await tx.escrowDeal.updateMany({
        where: {
          id: order.escrowDealId,
          status: EscrowStatus.AWAITING_PAYMENT,
        },
        data: { status: EscrowStatus.CANCELLED },
      });
    }

    for (const pid of paymentIds) {
      const pay = await tx.payment.findUnique({ where: { id: pid } });
      if (!pay || pay.status !== PaymentStatus.PENDING) continue;
      const prevMeta =
        pay.meta && typeof pay.meta === "object" && !Array.isArray(pay.meta)
          ? (pay.meta as Record<string, unknown>)
          : {};
      await tx.payment.update({
        where: { id: pid },
        data: {
          status: PaymentStatus.CANCELLED,
          cancelledAt: now,
          meta: asJson({
            ...prevMeta,
            cancelReason: "EXPIRED_CHECKOUT",
            cancelledAt: now.toISOString(),
          }),
        },
      });
    }

    const { releasedItems } = await releaseReservedStockInTx(tx, orderId);

    await writeAuditLog({
      action: "catalog.order.expired_cancel",
      entity: "Order",
      entityId: orderId,
      meta: { releasedItems, reason: "EXPIRED_CHECKOUT" },
    });

    return { ok: true, reason: "CANCELLED", orderId };
    });
  } catch (e) {
    const msg = String(e);
    if ((msg.includes("40P01") || msg.includes("deadlock")) && attempt < 4) {
      await new Promise((r) => setTimeout(r, 30 + Math.floor(Math.random() * 80)));
      return cancelExpiredCatalogOrder(orderId, attempt + 1);
    }
    throw e;
  }
}

void SellerOfferStatus;
