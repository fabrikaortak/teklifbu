import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getSetting } from "@/core/settings";
import { isDemoPosEnabled, isPaymentTokensOnly } from "@/core/services/paymentModeService";
import {
  completeDemoPosPayment,
  createListingFeeIntent,
} from "@/core/services/listingCreateService";
import { completeEscrowPayment } from "@/core/services/escrowService";

/** GET ?intent=id — demo POS oturum bilgisi */
export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Giriş gerekli" }, { status: 401 });

  const intentId = new URL(req.url).searchParams.get("intent");
  if (!intentId) return NextResponse.json({ error: "intent gerekli" }, { status: 400 });

  const demoPosEnabled = await isDemoPosEnabled();
  const tokensOnly = await isPaymentTokensOnly();
  const provider = String((await getSetting<string>("payment_pos_provider", "demo")) || "demo");

  const payment = await prisma.payment.findUnique({ where: { id: intentId } });
  if (!payment || payment.userId !== session.id) {
    return NextResponse.json({ error: "Ödeme oturumu bulunamadı" }, { status: 404 });
  }

  const meta = (payment.meta || {}) as Record<string, unknown>;
  const listing = (meta.listing || {}) as Record<string, unknown>;
  const fee = (meta.fee || {}) as Record<string, unknown>;

  if (payment.purpose === "escrow_hold") {
    const escrowListing = meta.listingId
      ? await prisma.listing.findUnique({
          where: { id: String(meta.listingId) },
          select: { title: true },
        })
      : null;
    return NextResponse.json({
      intentId: payment.id,
      amountTl: payment.amountTl,
      status: payment.status,
      purpose: payment.purpose,
      demoPosEnabled: demoPosEnabled && !tokensOnly,
      tokensOnly,
      provider,
      title: "Güvenli Öde",
      listingId: meta.listingId || null,
      escrow: {
        dealId: meta.escrowDealId || null,
        shipDays: meta.shipDays || null,
        listingTitle: escrowListing?.title || null,
      },
      fee: {
        baseFeeTl: payment.amountTl,
        premiumFeeTl: 0,
        premiumBreakdown: [],
        totalFeeTl: payment.amountTl,
        invoice: null,
      },
    });
  }

  return NextResponse.json({
    intentId: payment.id,
    amountTl: payment.amountTl,
    status: payment.status,
    purpose: payment.purpose,
    demoPosEnabled: demoPosEnabled && !tokensOnly,
    tokensOnly,
    provider,
    title: String(listing.title || "İlan ücreti"),
    listingId: meta.listingId || null,
    fee: {
      baseFeeTl: Number(fee.baseFeeTl) || 0,
      premiumFeeTl: Number(fee.premiumFeeTl) || 0,
      premiumBreakdown: Array.isArray(fee.premiumBreakdown) ? fee.premiumBreakdown : [],
      totalFeeTl: Number(fee.feeTl) || payment.amountTl,
      invoice: fee.invoice && typeof fee.invoice === "object" ? fee.invoice : null,
    },
  });
}

/** POST action=intent | pay */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Giriş gerekli" }, { status: 401 });

  const body = await req.json();
  const action = String(body.action || "");

  if (action === "intent") {
    const result = await createListingFeeIntent(session, body.listing || {});
    if (!result.ok) return NextResponse.json(result.body, { status: result.status });
    return NextResponse.json({
      ok: true,
      intentId: result.intentId,
      amountTl: result.amountTl,
      payUrl: result.payUrl,
      fee: result.fee,
    });
  }

  if (action === "pay") {
    const intentId = String(body.intentId || "");
    if (!intentId) return NextResponse.json({ error: "intentId gerekli" }, { status: 400 });

    const intentPayment = await prisma.payment.findUnique({ where: { id: intentId } });
    if (intentPayment?.purpose === "escrow_hold") {
      const escrowResult = await completeEscrowPayment(session, intentId);
      if (!escrowResult.ok) return NextResponse.json(escrowResult.body, { status: escrowResult.status });
      return NextResponse.json({
        ok: true,
        dealId: escrowResult.dealId,
        message: escrowResult.message,
      });
    }

    const result = await completeDemoPosPayment(session, intentId);
    if (!result.ok) return NextResponse.json(result.body, { status: result.status });
    return NextResponse.json({
      ok: true,
      listingId: result.listingId,
      message: result.message,
      alreadyPaid: result.alreadyPaid,
    });
  }

  return NextResponse.json({ error: "Geçersiz action" }, { status: 400 });
}
