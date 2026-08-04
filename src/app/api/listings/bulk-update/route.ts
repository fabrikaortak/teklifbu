import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { submitBulkListingUpdate } from "@/core/services/bulkListingUpdateService";
import { ensureDefaultTenant } from "@/core/services/tenantService";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Giriş gerekli" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const items = Array.isArray(body.items) ? body.items : [];

  try {
    const tenant = await ensureDefaultTenant();
    const result = await submitBulkListingUpdate({
      sellerId: session.id,
      items,
      tenantId: tenant.id,
    });
    return NextResponse.json({
      ok: true,
      requestId: result.request.id,
      count: result.count,
      message: `${result.count} ilan için toplu güncelleme yönetici onayına gönderildi`,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Talep oluşturulamadı";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
