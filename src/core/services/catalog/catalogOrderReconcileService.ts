/**
 * Süresi dolan katalog siparişlerini reconcile eder (scheduler-ready).
 * Flag: catalog_expired_order_reconcile
 */
import { OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  cancelExpiredCatalogOrder,
  isCatalogExpiredReconcileEnabled,
} from "@/core/services/catalog/catalogOrderLifecycleService";

export type ReconcileReport = {
  scanned: number;
  cancelled: number;
  skipped: number;
  errors: Array<{ orderId: string; error: string }>;
  results: Array<{ orderId: string; ok: boolean; reason: string }>;
};

export async function reconcileExpiredCatalogOrders(opts?: {
  limit?: number;
  /** Flag’i yok say (admin/script zorla) */
  force?: boolean;
}): Promise<ReconcileReport> {
  const enabled = await isCatalogExpiredReconcileEnabled();
  if (!enabled && !opts?.force) {
    return { scanned: 0, cancelled: 0, skipped: 0, errors: [], results: [] };
  }

  const limit = Math.min(200, Math.max(1, Number(opts?.limit) || 50));
  const now = new Date();

  const orders = await prisma.order.findMany({
    where: {
      status: OrderStatus.PENDING_PAYMENT,
      expiresAt: { lte: now },
    },
    select: { id: true },
    orderBy: { expiresAt: "asc" },
    take: limit,
  });

  const report: ReconcileReport = {
    scanned: orders.length,
    cancelled: 0,
    skipped: 0,
    errors: [],
    results: [],
  };

  for (const o of orders) {
    try {
      const r = await cancelExpiredCatalogOrder(o.id);
      report.results.push({ orderId: o.id, ok: r.ok, reason: r.reason });
      if (r.ok) report.cancelled += 1;
      else report.skipped += 1;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      report.errors.push({ orderId: o.id, error: msg });
      report.results.push({ orderId: o.id, ok: false, reason: "ERROR" });
    }
  }

  return report;
}
