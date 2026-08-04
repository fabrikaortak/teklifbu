import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  listShopPackagesForUser,
  purchaseShopPackageForUser,
} from "@/core/services/shopPackagePurchaseService";

/** GET — aktif kurumsal paketler + mevcut abonelik */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Giriş gerekli" }, { status: 401 });

  try {
    const data = await listShopPackagesForUser(session);
    return NextResponse.json(data);
  } catch (e) {
    console.error("[GET /api/shop-packages]", e);
    return NextResponse.json({ error: "Paketler yüklenemedi" }, { status: 500 });
  }
}

/** POST action=purchase — paket satın al (demo ödeme) */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Giriş gerekli" }, { status: 401 });

  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "purchase");
    if (action !== "purchase") {
      return NextResponse.json({ error: "Geçersiz action" }, { status: 400 });
    }

    const packageId = String(body.packageId || "");
    if (!packageId) {
      return NextResponse.json({ error: "packageId gerekli" }, { status: 400 });
    }

    const result = await purchaseShopPackageForUser(session, packageId, {
      months: body.months,
      days: body.days,
      years: body.years,
      payWithTokens: Boolean(body.payWithTokens),
    });
    if (!result.ok) return NextResponse.json(result.body, { status: result.status });
    const msg = result.paidWithTokens
      ? `${result.packageName} paketi ${result.tokensSpent} jeton ile aktifleştirildi.`
      : `${result.packageName} paketi aktifleştirildi.`;
    return NextResponse.json({
      ok: true,
      subscriptionId: result.subscriptionId,
      endsAt: result.endsAt,
      amountTl: result.amountTl,
      tokensSpent: result.tokensSpent,
      paidWithTokens: result.paidWithTokens,
      packageName: result.packageName,
      message: msg,
    });
  } catch (e) {
    console.error("[POST /api/shop-packages]", e);
    return NextResponse.json({ error: "Satın alma başarısız" }, { status: 500 });
  }
}
