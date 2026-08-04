import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  getSellerReviewSettings,
  listApprovedSellerReviews,
  submitSellerReview,
} from "@/core/services/sellerReviewService";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sellerId = String(searchParams.get("sellerId") || "").trim();
  if (!sellerId) {
    return NextResponse.json({ error: "sellerId gerekli" }, { status: 400 });
  }

  const settings = await getSellerReviewSettings();
  if (!settings.enabled) {
    return NextResponse.json({
      enabled: false,
      comingSoon: true,
      reviews: [],
      message: "Çok yakında",
    });
  }

  const reviews = await listApprovedSellerReviews(sellerId);
  return NextResponse.json({ enabled: true, comingSoon: false, reviews });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.id) {
    return NextResponse.json({ error: "Giriş gerekli" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const result = await submitSellerReview({
    authorId: session.id,
    sellerId: String(body.sellerId || ""),
    listingId: body.listingId || null,
    body: String(body.body || ""),
    rating: body.rating ?? null,
    rulesAccepted: Boolean(body.rulesAccepted),
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({
    ok: true,
    message: result.message,
    review: result.review,
  });
}
