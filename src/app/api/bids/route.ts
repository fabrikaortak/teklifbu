import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { placeBid, approveBid, republishListing, processExpiredListings, withdrawBidAfterListingChange, reviseBidAfterListingChange } from "@/core/services/bidService";

export async function GET(req: Request) {
  await processExpiredListings();
  const { searchParams } = new URL(req.url);
  const listingId = searchParams.get("listingId");
  if (!listingId) return NextResponse.json({ error: "listingId gerekli" }, { status: 400 });

  const bids = await prisma.bid.findMany({
    where: { listingId },
    include: { bidder: { select: { id: true, name: true } } },
    orderBy: [{ amount: "desc" }, { createdAt: "asc" }],
  });

  return NextResponse.json({
    bids: bids.map((b, i) => ({
      id: b.id,
      rank: i + 1,
      amount: Number(b.amount),
      status: b.status,
      durationDays: b.durationDays,
      expiresAt: b.expiresAt,
      createdAt: b.createdAt,
      bidderName: b.bidder.name,
      bidderId: b.bidderId,
    })),
  });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Giriş gerekli" }, { status: 401 });
  const body = await req.json();
  const action = body.action as string;

  if (action === "place") {
    const result = await placeBid({
      listingId: body.listingId,
      bidderId: session.id,
      amount: Number(body.amount),
      durationDays: Number(body.durationDays),
    });
    if (!result.ok) {
      const status = result.code === "INSUFFICIENT_TOKENS" ? 402 : 400;
      return NextResponse.json(
        {
          error: result.error,
          code: result.code,
          requiredTokens: result.requiredTokens,
          balance: result.balance,
        },
        { status }
      );
    }
    return NextResponse.json({ ok: true, bidId: result.bid.id });
  }

  if (action === "approve") {
    const result = await approveBid({
      listingId: body.listingId,
      bidId: body.bidId,
      sellerId: session.id,
    });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json(result);
  }

  if (action === "republish") {
    const result = await republishListing(body.listingId, session.id);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json(result);
  }

  if (action === "withdraw-after-change") {
    const result = await withdrawBidAfterListingChange({
      listingId: String(body.listingId),
      bidId: String(body.bidId),
      bidderId: session.id,
    });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json(result);
  }

  if (action === "revise-after-change") {
    const result = await reviseBidAfterListingChange({
      listingId: String(body.listingId),
      bidId: String(body.bidId),
      bidderId: session.id,
      amount: Number(body.amount),
      durationDays: Number(body.durationDays),
    });
    if (!result.ok) {
      const status = result.code === "INSUFFICIENT_TOKENS" ? 402 : 400;
      return NextResponse.json(result, { status });
    }
    return NextResponse.json(result);
  }

  return NextResponse.json({ error: "Bilinmeyen aksiyon" }, { status: 400 });
}
