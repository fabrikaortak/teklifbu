import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  buyerConfirmReceipt,
  buyerRejectOrDispute,
  createEscrowCheckout,
  sellerSubmitCargo,
} from "@/core/services/escrowService";

const DEAL_INCLUDE = {
  listing: {
    select: { id: true, title: true, listingNo: true, coverImage: true, askPrice: true, status: true },
  },
  linkedOrder: {
    select: {
      id: true,
      orderNo: true,
      status: true,
      items: {
        take: 1,
        select: {
          productNameSnapshot: true,
          variantTitleSnapshot: true,
          productImageSnapshot: true,
          productId: true,
          sellerOfferId: true,
        },
      },
    },
  },
  sellerOffer: {
    select: {
      id: true,
      product: { select: { id: true, name: true, mainImage: true } },
      variant: { select: { title: true } },
    },
  },
  buyer: { select: { id: true, name: true, phone: true } },
  seller: { select: { id: true, name: true, phone: true, iban: true } },
} as const;

function serializeDeal(deal: {
  listing?: { askPrice: bigint } & Record<string, unknown>;
  [key: string]: unknown;
}) {
  return {
    ...deal,
    listing: deal.listing ? { ...deal.listing, askPrice: Number(deal.listing.askPrice) } : deal.listing,
  };
}

/** GET ?dealId=id (tekil) veya ?role=buyer|seller&status=... (liste — oturum sahibinin işlemleri) */
export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Giriş gerekli" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const dealId = searchParams.get("dealId");

  if (dealId) {
    const deal = await prisma.escrowDeal.findUnique({ where: { id: dealId }, include: DEAL_INCLUDE });
    if (!deal) return NextResponse.json({ error: "Güvenli Öde işlemi bulunamadı" }, { status: 404 });
    if (deal.buyerId !== session.id && deal.sellerId !== session.id && session.role !== "ADMIN") {
      return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
    }
    return NextResponse.json({ deal: serializeDeal(deal) });
  }

  const role = searchParams.get("role");
  const status = searchParams.get("status");

  const where: Record<string, unknown> = {};
  if (role === "buyer") where.buyerId = session.id;
  else if (role === "seller") where.sellerId = session.id;
  else where.OR = [{ buyerId: session.id }, { sellerId: session.id }];
  if (status) where.status = status;

  const deals = await prisma.escrowDeal.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
    include: DEAL_INCLUDE,
  });

  return NextResponse.json({ deals: deals.map(serializeDeal) });
}

/** POST action=checkout|submit-cargo|confirm|dispute */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Giriş gerekli" }, { status: 401 });

  const body = await req.json();
  const action = String(body.action || "");

  if (action === "checkout") {
    const listingId = String(body.listingId || "");
    const shipDays = Number(body.shipDays);
    if (!listingId) return NextResponse.json({ error: "listingId gerekli" }, { status: 400 });
    const result = await createEscrowCheckout(session, listingId, shipDays);
    if (!result.ok) return NextResponse.json(result.body, { status: result.status });
    return NextResponse.json({
      ok: true,
      payUrl: result.payUrl,
      dealId: result.dealId,
      amountTl: result.amountTl,
      intentId: result.intentId,
    });
  }

  if (action === "submit-cargo") {
    const dealId = String(body.dealId || "");
    if (!dealId) return NextResponse.json({ error: "dealId gerekli" }, { status: 400 });
    const result = await sellerSubmitCargo(session, dealId, {
      trackingNo: body.trackingNo,
      carrier: body.carrier,
      receiptUrl: body.receiptUrl,
      note: body.note,
    });
    if (!result.ok) return NextResponse.json(result.body, { status: result.status });
    return NextResponse.json({ ok: true, deal: serializeDeal(result.deal) });
  }

  if (action === "confirm") {
    const dealId = String(body.dealId || "");
    if (!dealId) return NextResponse.json({ error: "dealId gerekli" }, { status: 400 });
    const result = await buyerConfirmReceipt(session, dealId);
    if (!result.ok) return NextResponse.json(result.body, { status: result.status });
    return NextResponse.json({ ok: true, deal: serializeDeal(result.deal) });
  }

  if (action === "dispute") {
    const dealId = String(body.dealId || "");
    const reason = String(body.reason || "");
    if (!dealId) return NextResponse.json({ error: "dealId gerekli" }, { status: 400 });
    const result = await buyerRejectOrDispute(session, dealId, reason);
    if (!result.ok) return NextResponse.json(result.body, { status: result.status });
    return NextResponse.json({ ok: true, deal: serializeDeal(result.deal) });
  }

  return NextResponse.json({ error: "Geçersiz action" }, { status: 400 });
}
