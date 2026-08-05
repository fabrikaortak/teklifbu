import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { reconcileExpiredCatalogOrders } from "@/core/services/catalog/catalogOrderReconcileService";

/** POST /api/admin/catalog/reconcile-orders — süresi dolan katalog siparişlerini iptal + stok iade */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  const report = await reconcileExpiredCatalogOrders({
    limit: Number(body.limit) || 50,
    force: Boolean(body.force),
  });
  return NextResponse.json({ ok: true, report });
}
