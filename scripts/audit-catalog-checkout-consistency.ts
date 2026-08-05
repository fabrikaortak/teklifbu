/**
 * Salt-okuma katalog checkout tutarlılık denetimi.
 * npx tsx scripts/audit-catalog-checkout-consistency.ts
 * npm run audit:catalog-checkout
 */
import "dotenv/config";
import { PrismaClient, OrderStatus, PaymentStatus, CatalogProjectionJobStatus } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

export type AuditFinding = {
  code: string;
  message: string;
  entity?: string;
  entityId?: string;
  meta?: Record<string, unknown>;
};

export type AuditScopeOptions = {
  /** full = tüm DB; phase2 = since + shop/buyer allowlist */
  scope?: "full" | "phase2";
  since?: Date | string | null;
  shopIds?: string[];
  buyerIds?: string[];
};

export type AuditReport = {
  generatedAt: string;
  scope: {
    mode: "full" | "phase2";
    since?: string | null;
    shopIds?: string[];
    buyerIds?: string[];
  };
  summary: {
    orders: number;
    payments: number;
    escrowDeals: number;
    orderItems: number;
    projectionJobs: number;
    criticalCount: number;
    warningCount: number;
  };
  critical: AuditFinding[];
  warnings: AuditFinding[];
  counts: Record<string, number>;
};

function isCatalogMeta(meta: unknown): boolean {
  return Boolean(meta && typeof meta === "object" && (meta as { catalogCheckout?: boolean }).catalogCheckout);
}

function parseSince(v?: Date | string | null): Date | null {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isFinite(d.getTime()) ? d : null;
}

export async function auditCatalogCheckoutConsistency(
  opts: AuditScopeOptions = {}
): Promise<AuditReport> {
  const mode = opts.scope === "phase2" ? "phase2" : "full";
  const since = parseSince(opts.since);
  const shopIds = (opts.shopIds || []).filter(Boolean);
  const buyerIds = (opts.buyerIds || []).filter(Boolean);

  const critical: AuditFinding[] = [];
  const warnings: AuditFinding[] = [];
  const counts: Record<string, number> = {};

  const pushC = (f: AuditFinding) => critical.push(f);
  const pushW = (f: AuditFinding) => warnings.push(f);

  let [orders, payments, deals, items, jobs, offers] = await Promise.all([
    prisma.order.findMany({
      include: {
        items: true,
        escrowDeal: true,
      },
    }),
    prisma.payment.findMany(),
    prisma.escrowDeal.findMany(),
    prisma.orderItem.findMany(),
    prisma.catalogProjectionJob.findMany(),
    prisma.sellerOffer.findMany({
      where: { stockQty: { lt: 0 } },
      select: { id: true, stockQty: true },
    }),
  ]);

  // Phase2 scope: kritik kurallar aynı — yalnız incelenen küme daralır
  if (mode === "phase2") {
    orders = orders.filter((o) => {
      if (since && o.createdAt < since) return false;
      if (buyerIds.length && !buyerIds.includes(o.buyerId)) return false;
      if (shopIds.length) {
        const hit = o.items.some((i) => i.shopId && shopIds.includes(i.shopId));
        if (!hit) return false;
      }
      return true;
    });
    const orderIdSet = new Set(orders.map((o) => o.id));
    const dealIdSet = new Set(
      orders.map((o) => o.escrowDealId).filter(Boolean) as string[]
    );
    items = items.filter((i) => orderIdSet.has(i.orderId));
    deals = deals.filter((d) => {
      if (dealIdSet.has(d.id)) return true;
      if (d.orderId && orderIdSet.has(d.orderId)) return true;
      if (since && d.createdAt >= since && shopIds.length === 0 && buyerIds.length === 0) {
        return true;
      }
      return false;
    });
    payments = payments.filter((p) => {
      const meta = (p.meta || {}) as Record<string, unknown>;
      if (meta.orderId && orderIdSet.has(String(meta.orderId))) return true;
      if (since && p.createdAt >= since && shopIds.length === 0) return true;
      return false;
    });
    const offerIdSet = new Set(items.map((i) => i.sellerOfferId));
    jobs = jobs.filter((j) => {
      if (j.sellerOfferId && offerIdSet.has(j.sellerOfferId)) return true;
      if (since && j.createdAt >= since) return true;
      return false;
    });
    // negative stock: only offers in scope shops
    if (shopIds.length) {
      offers = await prisma.sellerOffer.findMany({
        where: { stockQty: { lt: 0 }, shopId: { in: shopIds } },
        select: { id: true, stockQty: true },
      });
    }
    counts.phase2Scoped = 1;
    counts.phase2OrderCount = orders.length;
  }

  const paymentById = new Map(payments.map((p) => [p.id, p]));
  const dealById = new Map(deals.map((d) => [d.id, d]));
  const ordersByDealId = new Map<string, typeof orders>();
  for (const o of orders) {
    if (!o.escrowDealId) continue;
    const list = ordersByDealId.get(o.escrowDealId) || [];
    list.push(o);
    ordersByDealId.set(o.escrowDealId, list);
  }

  // --- A) Order / Payment ---
  for (const order of orders) {
    let payment =
      (order.paymentId && paymentById.get(order.paymentId)) ||
      null;
    if (!payment && order.escrowDealId) {
      const deal = dealById.get(order.escrowDealId);
      if (deal?.paymentId) payment = paymentById.get(deal.paymentId) || null;
    }
    if (!payment) {
      const viaMeta = payments.find((p) => {
        const m = (p.meta || {}) as Record<string, unknown>;
        return m.orderId === order.id;
      });
      if (viaMeta) payment = viaMeta;
    }

    if (order.paymentId && !paymentById.get(order.paymentId)) {
      pushC({
        code: "ORDER_PAYMENT_ID_MISSING",
        message: "Order.paymentId set but Payment row missing",
        entity: "Order",
        entityId: order.id,
        meta: { paymentId: order.paymentId },
      });
    }

    if (order.escrowDealId && !dealById.get(order.escrowDealId)) {
      pushC({
        code: "ORDER_ESCROW_ID_MISSING",
        message: "Order.escrowDealId set but EscrowDeal row missing",
        entity: "Order",
        entityId: order.id,
        meta: { escrowDealId: order.escrowDealId },
      });
    }

    if (order.status === OrderStatus.PAID) {
      if (!payment) {
        pushC({
          code: "ORDER_PAID_NO_PAYMENT",
          message: "Order PAID but no linked Payment found",
          entity: "Order",
          entityId: order.id,
        });
      } else if (payment.status !== PaymentStatus.PAID) {
        pushC({
          code: "ORDER_PAID_PAYMENT_NOT_PAID",
          message: `Order PAID but Payment status=${payment.status}`,
          entity: "Order",
          entityId: order.id,
          meta: { paymentId: payment.id, paymentStatus: payment.status },
        });
      }
    }
  }

  for (const payment of payments) {
    if (payment.status !== PaymentStatus.PAID) continue;
    if (payment.purpose !== "escrow_hold") continue;
    const meta = (payment.meta || {}) as Record<string, unknown>;
    const orderId = meta.orderId ? String(meta.orderId) : null;
    if (!orderId && !isCatalogMeta(meta)) continue;
    if (!orderId) {
      pushW({
        code: "PAYMENT_PAID_NO_ORDER_META",
        message: "PAID escrow Payment without orderId meta",
        entity: "Payment",
        entityId: payment.id,
      });
      continue;
    }
    const order = orders.find((o) => o.id === orderId);
    if (!order) {
      pushC({
        code: "PAYMENT_PAID_ORDER_MISSING",
        message: "Payment PAID but Order missing",
        entity: "Payment",
        entityId: payment.id,
        meta: { orderId },
      });
    } else if (order.status === OrderStatus.CANCELLED) {
      pushC({
        code: "PAYMENT_PAID_ORDER_CANCELLED",
        message: "Payment PAID but Order CANCELLED",
        entity: "Payment",
        entityId: payment.id,
        meta: { orderId, orderStatus: order.status },
      });
    } else if (order.status !== OrderStatus.PAID) {
      // Bilinen: catalog_order_payment_lifecycle_v2 OFF iken Payment PAID, Order PENDING kalabilir
      pushW({
        code: "PAYMENT_PAID_ORDER_NOT_PAID_LEGACY",
        message: `Payment PAID but Order status=${order.status} (lifecycle-off legacy?)`,
        entity: "Payment",
        entityId: payment.id,
        meta: { orderId, orderStatus: order.status, paidAt: order.paidAt },
      });
    }
  }

  // --- B) Order / Escrow ---
  for (const order of orders) {
    const deal = order.escrowDealId ? dealById.get(order.escrowDealId) : null;
    const catalog =
      Boolean(deal && isCatalogMeta(deal.meta)) ||
      order.items.some((i) => Boolean(i.sellerOfferId));

    if (catalog && deal) {
      if (deal.orderId && deal.orderId !== order.id) {
        pushC({
          code: "CATALOG_ORDER_DEAL_ORDERID_MISMATCH",
          message: "EscrowDeal.orderId does not match Order.id",
          entity: "EscrowDeal",
          entityId: deal.id,
          meta: { orderId: order.id, dealOrderId: deal.orderId },
        });
      }
      if (!deal.orderId) {
        // may be pre-faz1.5; warn if catalog meta
        if (isCatalogMeta(deal.meta)) {
          pushW({
            code: "CATALOG_DEAL_MISSING_ORDERID",
            message: "Catalog EscrowDeal missing orderId (legacy?)",
            entity: "EscrowDeal",
            entityId: deal.id,
          });
        }
      }
      if (deal.orderId && deal.listingId) {
        pushW({
          code: "CATALOG_DEAL_TRANSITION_BOTH_IDS",
          message: "Catalog deal has both orderId and listingId (transition)",
          entity: "EscrowDeal",
          entityId: deal.id,
        });
      }
    }
  }

  for (const deal of deals) {
    const catalog = isCatalogMeta(deal.meta);
    const classic = !catalog;

    if (!deal.orderId && !deal.listingId) {
      pushC({
        code: "DEAL_BOTH_IDS_NULL",
        message: "EscrowDeal has neither orderId nor listingId",
        entity: "EscrowDeal",
        entityId: deal.id,
      });
    }

    if (catalog) {
      if (!deal.orderId) {
        pushW({
          code: "CATALOG_META_NO_ORDERID",
          message: "catalogCheckout meta but orderId null",
          entity: "EscrowDeal",
          entityId: deal.id,
        });
      }
      if (deal.orderId && deal.listingId) {
        // already warned above; count
        counts.catalogTransitionBothIds = (counts.catalogTransitionBothIds || 0) + 1;
      }
    }

    if (classic) {
      if (!deal.listingId) {
        pushC({
          code: "CLASSIC_DEAL_NO_LISTING",
          message: "Classic EscrowDeal missing listingId",
          entity: "EscrowDeal",
          entityId: deal.id,
        });
      }
      if (deal.orderId) {
        pushW({
          code: "CLASSIC_DEAL_HAS_ORDERID",
          message: "Classic EscrowDeal unexpectedly has orderId",
          entity: "EscrowDeal",
          entityId: deal.id,
        });
      }
    }

    const linked = ordersByDealId.get(deal.id) || [];
    if (linked.length > 1) {
      pushC({
        code: "AMBIGUOUS_MULTI_ORDER_SAME_DEAL",
        message: "Multiple Orders point to same EscrowDeal",
        entity: "EscrowDeal",
        entityId: deal.id,
        meta: { orderIds: linked.map((o) => o.id) },
      });
    }
    if (deal.orderId) {
      const o = orders.find((x) => x.id === deal.orderId);
      if (o && o.escrowDealId && o.escrowDealId !== deal.id) {
        pushC({
          code: "ORDER_DEAL_REVERSE_MISMATCH",
          message: "EscrowDeal.orderId ↔ Order.escrowDealId mismatch",
          entity: "EscrowDeal",
          entityId: deal.id,
          meta: { orderEscrowDealId: o.escrowDealId },
        });
      }
      if (o && !o.escrowDealId) {
        pushW({
          code: "DEAL_ORDERID_BUT_ORDER_NO_ESCROW",
          message: "Deal.orderId set but Order.escrowDealId null",
          entity: "EscrowDeal",
          entityId: deal.id,
        });
      }
    }
  }

  // --- C) OrderItem ---
  for (const order of orders) {
    if (!order.items.length) {
      pushC({
        code: "ORDER_NO_ITEMS",
        message: "Order has no OrderItems",
        entity: "Order",
        entityId: order.id,
      });
      continue;
    }
    for (const item of order.items) {
      if (!item.sellerOfferId) {
        pushC({
          code: "ITEM_NO_SELLER_OFFER",
          message: "OrderItem missing sellerOfferId",
          entity: "OrderItem",
          entityId: item.id,
        });
      }
      if (item.quantity <= 0) {
        pushC({
          code: "ITEM_BAD_QUANTITY",
          message: `quantity=${item.quantity}`,
          entity: "OrderItem",
          entityId: item.id,
        });
      }
      if (item.stockReservedQty != null && item.stockReservedQty <= 0) {
        pushC({
          code: "ITEM_BAD_RESERVED_QTY",
          message: `stockReservedQty=${item.stockReservedQty}`,
          entity: "OrderItem",
          entityId: item.id,
        });
      }
      const expectedLine =
        item.effectiveUnitPriceSnapshot * BigInt(item.quantity) +
        item.shippingPriceSnapshot;
      // lineTotal may include tax; allow shipping+subtotal
      const expectedAlt = item.lineSubtotal + item.lineShipping + item.lineTax;
      if (item.lineTotal !== expectedAlt && item.lineTotal !== expectedLine) {
        pushW({
          code: "ITEM_LINE_TOTAL_MISMATCH",
          message: "lineTotal does not match snapshot arithmetic",
          entity: "OrderItem",
          entityId: item.id,
          meta: {
            lineTotal: item.lineTotal.toString(),
            expectedAlt: expectedAlt.toString(),
          },
        });
      }
    }
  }

  const offerIds = [...new Set(items.map((i) => i.sellerOfferId).filter(Boolean))];
  if (offerIds.length) {
    const softDeleted = await prisma.sellerOffer.findMany({
      where: { id: { in: offerIds }, deletedAt: { not: null } },
      select: { id: true },
    });
    for (const o of softDeleted) {
      pushW({
        code: "SELLER_OFFER_SOFT_DELETED",
        message: "OrderItem references soft-deleted SellerOffer",
        entity: "SellerOffer",
        entityId: o.id,
      });
    }
  }

  // --- D) Stock release ---
  for (const order of orders) {
    const catalog = order.items.some((i) => Boolean(i.sellerOfferId));
    if (!catalog) continue;
    // Faz1+ rezervasyon izi olanlar (stockReservedQty / expiresAt) — legacy CANCELLED hariç
    const faz1Plus = order.items.some((i) => i.stockReservedQty != null) || Boolean(order.expiresAt);
    for (const item of order.items) {
      if (
        faz1Plus &&
        order.status === OrderStatus.CANCELLED &&
        !item.stockReleasedAt
      ) {
        pushC({
          code: "CANCELLED_NO_STOCK_RELEASE",
          message: "CANCELLED catalog order item missing stockReleasedAt",
          entity: "OrderItem",
          entityId: item.id,
          meta: { orderId: order.id },
        });
      }
      if (order.status === OrderStatus.PAID && item.stockReleasedAt) {
        pushC({
          code: "PAID_HAS_STOCK_RELEASE",
          message: "PAID order item has stockReleasedAt",
          entity: "OrderItem",
          entityId: item.id,
          meta: { orderId: order.id },
        });
      }
    }
  }

  for (const o of offers) {
    pushC({
      code: "NEGATIVE_STOCK",
      message: `SellerOffer.stockQty=${o.stockQty}`,
      entity: "SellerOffer",
      entityId: o.id,
    });
  }
  counts.negativeStockOffers = offers.length;

  // --- E) Idempotency ---
  const keyGroups = new Map<string, string[]>();
  for (const o of orders) {
    if (!o.idempotencyKey) {
      pushW({
        code: "ORDER_NO_IDEMPOTENCY_KEY",
        message: "Order without idempotencyKey (legacy ok)",
        entity: "Order",
        entityId: o.id,
      });
      continue;
    }
    const k = `${o.buyerId}::${o.idempotencyKey}`;
    const list = keyGroups.get(k) || [];
    list.push(o.id);
    keyGroups.set(k, list);
  }
  for (const [k, ids] of keyGroups) {
    if (ids.length > 1) {
      pushC({
        code: "DUPLICATE_IDEMPOTENCY_KEY",
        message: "Duplicate buyerId+idempotencyKey",
        entity: "Order",
        entityId: ids[0],
        meta: { key: k, orderIds: ids },
      });
    }
  }

  const txGroups = new Map<string, string[]>();
  for (const p of payments) {
    if (!p.providerTransactionId) continue;
    const list = txGroups.get(p.providerTransactionId) || [];
    list.push(p.id);
    txGroups.set(p.providerTransactionId, list);
  }
  for (const [tx, ids] of txGroups) {
    if (ids.length > 1) {
      pushC({
        code: "DUPLICATE_PROVIDER_TX",
        message: "Duplicate providerTransactionId",
        entity: "Payment",
        entityId: ids[0],
        meta: { providerTransactionId: tx, paymentIds: ids },
      });
    }
  }

  // --- F) Projection jobs ---
  const now = Date.now();
  const openByOffer = new Map<string, string[]>();
  for (const job of jobs) {
    if (job.status === CatalogProjectionJobStatus.FAILED) {
      pushW({
        code: "PROJECTION_JOB_FAILED",
        message: job.lastError || "FAILED",
        entity: "CatalogProjectionJob",
        entityId: job.id,
        meta: { sellerOfferId: job.sellerOfferId, attempts: job.attempts },
      });
      counts.projectionFailed = (counts.projectionFailed || 0) + 1;
    }
    if (
      (job.status === CatalogProjectionJobStatus.PENDING ||
        job.status === CatalogProjectionJobStatus.PROCESSING) &&
      job.attempts >= job.maxAttempts
    ) {
      pushW({
        code: "PROJECTION_STUCK_AT_MAX",
        message: "Job at maxAttempts still PENDING/PROCESSING",
        entity: "CatalogProjectionJob",
        entityId: job.id,
      });
    }
    if (
      job.status === CatalogProjectionJobStatus.PROCESSING &&
      now - job.updatedAt.getTime() > 30 * 60_000
    ) {
      pushW({
        code: "PROJECTION_LONG_PROCESSING",
        message: "PROCESSING > 30 minutes",
        entity: "CatalogProjectionJob",
        entityId: job.id,
      });
    }
    if (
      job.sellerOfferId &&
      (job.status === CatalogProjectionJobStatus.PENDING ||
        job.status === CatalogProjectionJobStatus.PROCESSING)
    ) {
      const list = openByOffer.get(job.sellerOfferId) || [];
      list.push(job.id);
      openByOffer.set(job.sellerOfferId, list);
    }
  }
  for (const [offerId, ids] of openByOffer) {
    if (ids.length > 1) {
      pushW({
        code: "PROJECTION_DUPLICATE_OPEN",
        message: "Multiple open projection jobs for same offer",
        entity: "SellerOffer",
        entityId: offerId,
        meta: { jobIds: ids },
      });
    }
  }

  // --- G) Legacy extras ---
  counts.catalogDeals = deals.filter((d) => isCatalogMeta(d.meta)).length;
  counts.classicDeals = deals.filter((d) => !isCatalogMeta(d.meta)).length;
  counts.catalogListingIdNull = deals.filter(
    (d) => isCatalogMeta(d.meta) && !d.listingId
  ).length;
  counts.ordersPaid = orders.filter((o) => o.status === OrderStatus.PAID).length;
  counts.ordersCancelled = orders.filter((o) => o.status === OrderStatus.CANCELLED).length;

  const report: AuditReport = {
    generatedAt: new Date().toISOString(),
    scope: {
      mode,
      since: since?.toISOString() || null,
      shopIds: shopIds.length ? shopIds : undefined,
      buyerIds: buyerIds.length ? buyerIds : undefined,
    },
    summary: {
      orders: orders.length,
      payments: payments.length,
      escrowDeals: deals.length,
      orderItems: items.length,
      projectionJobs: jobs.length,
      criticalCount: critical.length,
      warningCount: warnings.length,
    },
    critical,
    warnings,
    counts,
  };

  return report;
}

function parseArg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
}

async function main() {
  const scope = (parseArg("scope") as "full" | "phase2") || "full";
  const since = parseArg("since") || null;
  const shopIds = (parseArg("shopIds") || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const buyerIds = (parseArg("buyerIds") || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const outName =
    parseArg("out") ||
    (scope === "phase2"
      ? "catalog-checkout-consistency-phase2.json"
      : "catalog-checkout-consistency-report.json");

  const report = await auditCatalogCheckoutConsistency({
    scope,
    since,
    shopIds,
    buyerIds,
  });
  const outDir = path.join(process.cwd(), "scripts", "output");
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, outName);
  fs.writeFileSync(outFile, JSON.stringify(report, null, 2), "utf8");
  console.log(JSON.stringify(report, null, 2));
  console.error(`\nWrote ${outFile}`);
  console.error(
    `scope=${report.scope.mode} critical=${report.summary.criticalCount} warnings=${report.summary.warningCount}`
  );
  if (report.summary.criticalCount > 0) process.exit(1);
}

// Yalnız CLI ile doğrudan çalıştırıldığında main; import edildiğinde çalışmaz
const invokedAsCli = process.argv[1]
  ? /audit-catalog-checkout-consistency\.(ts|js|mjs|cjs)$/i.test(
      process.argv[1].replace(/\\/g, "/")
    )
  : false;

if (invokedAsCli) {
  main()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
